/**
 * OAuth start (tenant-scoped) + shared callbacks (PUBLIC_API_URL).
 * Location: apps/api/src/modules/integrations/oauthRoutes.ts
 */
import type { FastifyInstance } from 'fastify'
import { OAuthProviderParamSchema, canManageCredentials } from '@bu2/shared'
import { loadEnv } from '../../lib/env.js'
import { buildOAuthAuthorizeUrl } from '../../lib/integrations/oauth/authorize.js'
import { oauthClientConfiguredForProvider } from '../../lib/integrations/oauth/config.js'
import { putPkceVerifier } from '../../lib/integrations/oauth/pkceStore.js'
import {
  allOauthRedirectUris,
  oauthRedirectUriForProvider,
} from '../../lib/integrations/oauth/redirects.js'
import { parseOAuthState } from '../../lib/integrations/oauth/state.js'
import { loadMembership, requireUser } from '../../plugins/auth.js'
import { httpError, settingsReturnUrl } from './oauthService.js'

export async function oauthIntegrationRoutes(app: FastifyInstance) {
  /** Public helper — redirect URIs to paste into Google / Azure / Meta consoles. */
  app.get('/api/oauth/redirect-uris', async () => {
    return { redirectUris: allOauthRedirectUris() }
  })

  app.post('/api/b/:slug/integrations/oauth/:provider/start', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, provider: rawProvider } = req.params as { slug: string; provider: string }
    const m = await loadMembership(user.id, slug)
    if (!m || (!canManageCredentials(m.role) && !user.isSuperadmin)) {
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
      putPkceVerifier(started.state, started.codeVerifier)
      return {
        authorizeUrl: started.authorizeUrl,
        redirectUri: started.redirectUri,
      }
    } catch (e) {
      const { status, error } = httpError(e)
      return reply.code(status).send({ error, redirectUri })
    }
  })

  for (const provider of ['google', 'microsoft', 'meta'] as const) {
    app.get(`/api/oauth/${provider}/callback`, async (req, reply) => {
      const q = req.query as { code?: string; state?: string; error?: string; error_description?: string }
      if (q.error) {
        const slugGuess = ''
        const web = loadEnv().PUBLIC_WEB_URL.replace(/\/$/, '')
        const target = new URL(`${web}/`)
        target.searchParams.set('oauth_error', q.error)
        if (q.error_description) target.searchParams.set('oauth_error_detail', q.error_description)
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
        const u = new URL(returnTo)
        u.searchParams.set('oauth_error', 'missing_code')
        return reply.redirect(u.toString())
      }

      // Token exchange + connection persist: next slice when client secrets are live.
      // PKCE verifier is available via takePkceVerifier(q.state) once exchange is wired.
      const u = new URL(returnTo)
      u.searchParams.set('oauth', provider)
      u.searchParams.set('oauth_status', 'pending_token_exchange')
      u.searchParams.set('oauth_provider', state.provider)
      return reply.redirect(u.toString())
    })
  }
}
