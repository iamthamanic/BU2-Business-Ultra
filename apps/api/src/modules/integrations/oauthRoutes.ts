/**
 * OAuth start (tenant-scoped) + shared callbacks (PUBLIC_API_URL).
 * Location: apps/api/src/modules/integrations/oauthRoutes.ts
 */
import type { FastifyInstance } from 'fastify'
import { OAuthProviderParamSchema, canManageCredentials } from '@bu2/shared'
import { loadEnv } from '../../lib/env.js'
import { buildOAuthAuthorizeUrl } from '../../lib/integrations/oauth/authorize.js'
import { persistOAuthConnection } from '../../lib/integrations/oauth/complete.js'
import { oauthClientConfiguredForProvider } from '../../lib/integrations/oauth/config.js'
import { exchangeOAuthCode } from '../../lib/integrations/oauth/exchange.js'
import { setPkceCookie, takePkceFromRequest } from '../../lib/integrations/oauth/pkceStore.js'
import {
  allOauthRedirectUris,
  OAUTH_CALLBACK_PROVIDERS,
  oauthRedirectKey,
  oauthRedirectUriForProvider,
} from '../../lib/integrations/oauth/redirects.js'
import { parseOAuthState } from '../../lib/integrations/oauth/state.js'
import { loadMembership, requireUser } from '../../plugins/auth.js'
import { httpError, oauthFailRedirect, settingsReturnUrl } from './oauthService.js'

const oauthStartLimit = { max: 20, timeWindow: '1 minute' as const }
const oauthCallbackLimit = { max: 40, timeWindow: '1 minute' as const }
const oauthMetaLimit = { max: 30, timeWindow: '1 minute' as const }

export async function oauthIntegrationRoutes(app: FastifyInstance) {
  /** Redirect URIs for consoles — session required (recon hygiene). */
  app.get('/api/oauth/redirect-uris', { config: { rateLimit: oauthMetaLimit } }, async (req, reply) => {
    try {
      await requireUser(req)
    } catch {
      return reply.code(401).send({ error: 'unauthorized' })
    }
    return { redirectUris: allOauthRedirectUris() }
  })

  app.post(
    '/api/b/:slug/integrations/oauth/:provider/start',
    { config: { rateLimit: oauthStartLimit } },
    async (req, reply) => {
      const user = await requireUser(req)
      const { slug, provider: rawProvider } = req.params as { slug: string; provider: string }
      const m = await loadMembership(user.id, slug)
      if (!m || !canManageCredentials(m)) {
        return reply.code(403).send({ error: 'forbidden' })
      }
      const parsed = OAuthProviderParamSchema.safeParse(rawProvider)
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_provider' })
      }
      const provider = parsed.data
      const redirectUri = oauthRedirectUriForProvider(provider)
      if (!oauthClientConfiguredForProvider(provider)) {
        return reply.code(503).send({
          error: 'oauth_client_not_configured',
          redirectUri,
          hint: 'Set OAuth client id/secret in server .env, then register redirectUri in the provider console.',
        })
      }
      try {
        const started = buildOAuthAuthorizeUrl({
          provider,
          businessId: m.businessId,
          slug,
          userId: user.id,
        })
        setPkceCookie(reply, started.state, started.codeVerifier)
        return {
          authorizeUrl: started.authorizeUrl,
          redirectUri: started.redirectUri,
        }
      } catch (e) {
        const { status, error } = httpError(e)
        return reply.code(status).send({ error, redirectUri })
      }
    },
  )

  for (const provider of OAUTH_CALLBACK_PROVIDERS) {
    app.get(
      `/api/oauth/${provider}/callback`,
      { config: { rateLimit: oauthCallbackLimit } },
      async (req, reply) => {
        const q = req.query as {
          code?: string
          state?: string
          error?: string
          error_description?: string
        }
        if (q.error) {
          const web = loadEnv().PUBLIC_WEB_URL.replace(/\/$/, '')
          const target = new URL(`${web}/`)
          const code = String(q.error).slice(0, 80).replace(/[^\w.-]/g, '_')
          target.searchParams.set('oauth_error', code || 'oauth_denied')
          return reply.redirect(target.toString())
        }
        if (!q.state) {
          return reply.code(400).send({ error: 'missing_state' })
        }

        let state
        try {
          state = parseOAuthState(q.state)
        } catch (e) {
          const { status, error } = httpError(e)
          return reply.code(status).send({ error })
        }

        const returnTo = settingsReturnUrl(state.slug)
        if (!q.code) {
          return reply.redirect(oauthFailRedirect(returnTo, 'missing_code', state.provider))
        }

        const redirectKey = oauthRedirectKey(state.provider)
        if (!redirectKey || redirectKey !== provider) {
          return reply.redirect(oauthFailRedirect(returnTo, 'provider_mismatch', state.provider))
        }

        let user
        try {
          user = await requireUser(req)
        } catch {
          return reply.redirect(oauthFailRedirect(returnTo, 'session_required', state.provider))
        }
        if (user.id !== state.userId) {
          return reply.redirect(oauthFailRedirect(returnTo, 'state_user_mismatch', state.provider))
        }
        const m = await loadMembership(user.id, state.slug)
        if (
          !m ||
          m.businessId !== state.businessId ||
          !canManageCredentials(m)
        ) {
          return reply.redirect(oauthFailRedirect(returnTo, 'forbidden', state.provider))
        }

        const codeVerifier = takePkceFromRequest(req, reply, q.state)
        try {
          const tokens = await exchangeOAuthCode({
            redirectKey,
            provider: state.provider,
            code: q.code,
            codeVerifier,
          })
          const conn = await persistOAuthConnection({
            businessId: m.businessId,
            userId: user.id,
            provider: state.provider,
            tokens,
          })
          const u = new URL(returnTo)
          u.searchParams.set('oauth', provider)
          u.searchParams.set('oauth_status', 'connected')
          u.searchParams.set('oauth_provider', state.provider)
          u.searchParams.set('connection_id', conn.id)
          return reply.redirect(u.toString())
        } catch (e) {
          const { error } = httpError(e)
          return reply.redirect(oauthFailRedirect(returnTo, error, state.provider))
        }
      },
    )
  }
}
