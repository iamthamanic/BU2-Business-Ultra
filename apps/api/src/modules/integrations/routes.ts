/**
 * Integration Core HTTP — connections, bindings, providers (no plaintext credentials).
 * Location: apps/api/src/modules/integrations/routes.ts — helpers in ./service.ts
 */
import type { FastifyInstance } from 'fastify'
import {
  BindingPurposeSchema,
  ConnectFinapiSchema,
  ConnectImapSchema,
  ConnectMockSchema,
  CreateModuleBindingSchema,
  IntegrationModuleSchema,
  SetModuleBindingSchema,
  UpsertSyncCursorSchema,
  canManageCredentials,
  canMutateContent,
} from '@bu2/shared'
import {
  connectFinapiAccount,
  connectImapAccount,
  connectMockAccount,
  createModuleBinding,
  getConnectionForBusiness,
  listConnections,
  listModuleBindings,
  resolveBindingCapability,
  revokeConnection,
  setModuleBindingsEnabled,
  upsertSyncCursor,
} from '../../lib/integrations/core/connections.js'
import { PROVIDER_CATALOG } from '../../lib/integrations/core/providers.js'
import { ensureAdsKeyAdaptersRegistered } from '../../lib/integrations/adsKey/adapter.js'
import { ensureFinapiAdapterRegistered } from '../../lib/integrations/finapi/adapter.js'
import { getFinapiPlatformConfig } from '../../lib/integrations/finapi/config.js'
import { ensureImapAdapterRegistered } from '../../lib/integrations/imap/adapter.js'
import { and, eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { connections } from '../../db/schema.js'
import { httpError } from '../../lib/httpError.js'
import { getGoogleAccessToken } from '../../lib/integrations/google/tokens.js'
import { listAccessibleCustomers, listCampaigns } from '../../lib/integrations/googleAds/client.js'
import {
  getGoogleOAuthConfig,
  getMetaOAuthConfig,
  getMicrosoftOAuthConfig,
  oauthClientConfiguredForProvider,
} from '../../lib/integrations/oauth/config.js'
import {
  allOauthRedirectUris,
  oauthRedirectUriForProvider,
} from '../../lib/integrations/oauth/redirects.js'
import { isUnipileConfigured } from '../../lib/integrations/unipile/inboxSync.js'
import { uploadYoutubeVideo } from '../../lib/integrations/youtube/client.js'
import { loadMembership, requireUser } from '../../plugins/auth.js'
import { loadEnv } from '../../lib/env.js'

ensureImapAdapterRegistered()
ensureFinapiAdapterRegistered()
ensureAdsKeyAdaptersRegistered()

export async function integrationRoutes(app: FastifyInstance) {
  app.get('/api/b/:slug/integrations/providers', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(403).send({ error: 'forbidden' })
    const providers = PROVIDER_CATALOG.filter((p) => p.id !== 'mock').map((p) => {
      const redirectUri = oauthRedirectUriForProvider(p.id)
      const oauthConfigured =
        p.connectKind === 'oauth' ? oauthClientConfiguredForProvider(p.id) : null
      let adapterReady = p.adapterReady
      if (p.id === 'unipile') adapterReady = isUnipileConfigured()
      if (p.id === 'finapi') adapterReady = getFinapiPlatformConfig().configured
      // OAuth / Unipile stay openable so admins can copy redirect URIs or see env setup hints.
      const selectable =
        p.connectKind === 'oauth' || p.connectKind === 'aggregator' || adapterReady
      return {
        ...p,
        adapterReady,
        selectable,
        redirectUri,
        oauthConfigured,
        clientConfigured:
          p.connectKind === 'oauth'
            ? Boolean(oauthConfigured)
            : p.id === 'unipile'
              ? isUnipileConfigured()
              : p.id === 'finapi'
                ? getFinapiPlatformConfig().configured
                : true,
      }
    })
    return {
      providers,
      unipileConfigured: isUnipileConfigured(),
    }
  })

  /** Platform app readiness — env developer credentials only (no secrets returned). */
  app.get('/api/b/:slug/integrations/platform-status', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(403).send({ error: 'forbidden' })
    const env = loadEnv()
    const finapi = getFinapiPlatformConfig()
    return {
      redirectUris: allOauthRedirectUris(),
      publicApiUrl: env.PUBLIC_API_URL,
      google: getGoogleOAuthConfig().configured,
      microsoft: getMicrosoftOAuthConfig().configured,
      meta: getMetaOAuthConfig().configured,
      unipile: isUnipileConfigured(),
      finapi: finapi.configured,
      finapiBaseUrl: finapi.baseUrl,
      googleAdsDeveloperToken: Boolean(process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim()),
      brevo: Boolean(process.env.BREVO_API_KEY?.trim()),
      openseo: Boolean(env.OPENSEO_BASE_URL && env.OPENSEO_SSO_SHARED_SECRET),
    }
  })

  app.post('/api/b/:slug/integrations/connections/imap', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canManageCredentials(m)) {
      return reply.code(403).send({ error: 'forbidden' })
    }
    const body = ConnectImapSchema.safeParse(req.body)
    if (!body.success) {
      return reply.code(400).send({ error: 'invalid_body', issues: body.error.issues })
    }
    try {
      const connection = await connectImapAccount({
        businessId: m.businessId,
        userId: user.id,
        ...body.data,
      })
      return reply.code(201).send({ connection })
    } catch (e) {
      const { status, error } = httpError(e)
      return reply.code(status).send({ error })
    }
  })

  app.post('/api/b/:slug/integrations/connections/finapi', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canManageCredentials(m)) {
      return reply.code(403).send({ error: 'forbidden' })
    }
    const raw = req.body && typeof req.body === 'object' ? req.body : {}
    const body = ConnectFinapiSchema.safeParse(raw)
    if (!body.success) {
      return reply.code(400).send({ error: 'invalid_body', issues: body.error.issues })
    }
    try {
      const connection = await connectFinapiAccount({
        businessId: m.businessId,
        userId: user.id,
        displayName: body.data.displayName,
      })
      return reply.code(201).send({ connection })
    } catch (e) {
      const { status, error } = httpError(e)
      return reply.code(status).send({ error })
    }
  })

  app.post('/api/b/:slug/integrations/connections/ads-api-key', async (_req, reply) => {
    return reply.code(410).send({
      error: 'ads_api_key_retired',
      hint: 'Use OAuth start for chatgpt_ads / reddit_ads / microsoft_ads.',
    })
  })

  app.delete('/api/b/:slug/integrations/connections/:id', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canManageCredentials(m)) {
      return reply.code(403).send({ error: 'forbidden' })
    }
    const ok = await revokeConnection(m.businessId, id)
    if (!ok) return reply.code(404).send({ error: 'not_found' })
    return { ok: true }
  })

  app.get('/api/b/:slug/integrations/connections', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(403).send({ error: 'forbidden' })
    const connections = await listConnections(m.businessId)
    return { connections }
  })

  app.get('/api/b/:slug/integrations/connections/:id', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(403).send({ error: 'forbidden' })
    const connection = await getConnectionForBusiness(m.businessId, id)
    if (!connection) return reply.code(404).send({ error: 'not_found' })
    return { connection }
  })

  /** Mock connect — Step 01 only. Real OAuth/bot flows land in later tickets. */
  app.post('/api/b/:slug/integrations/connections/mock', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canManageCredentials(m)) {
      return reply.code(403).send({ error: 'forbidden' })
    }
    const body = ConnectMockSchema.safeParse(req.body)
    if (!body.success) {
      return reply.code(400).send({ error: 'invalid_body', issues: body.error.issues })
    }
    try {
      const connection = await connectMockAccount({
        businessId: m.businessId,
        userId: user.id,
        externalAccountId: body.data.externalAccountId,
        displayName: body.data.displayName,
        credential: body.data.credential,
        accountType: body.data.accountType,
      })
      return reply.code(201).send({ connection })
    } catch (e) {
      const { status, error } = httpError(e)
      return reply.code(status).send({ error })
    }
  })

  app.get('/api/b/:slug/integrations/bindings', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const q = req.query as { activeOnly?: string; module?: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(403).send({ error: 'forbidden' })
    const mod = q.module ? IntegrationModuleSchema.safeParse(q.module) : null
    if (q.module && !mod?.success) {
      return reply.code(400).send({ error: 'invalid_module' })
    }
    const bindings = await listModuleBindings(m.businessId, {
      activeOnly: q.activeOnly === '1' || q.activeOnly === 'true',
      module: mod?.success ? mod.data : undefined,
    })
    return { bindings }
  })

  app.post('/api/b/:slug/integrations/bindings', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canManageCredentials(m)) {
      return reply.code(403).send({ error: 'forbidden' })
    }
    const body = CreateModuleBindingSchema.safeParse(req.body)
    if (!body.success) {
      return reply.code(400).send({ error: 'invalid_body', issues: body.error.issues })
    }
    try {
      const binding = await createModuleBinding(m.businessId, body.data)
      return reply.code(201).send({ binding })
    } catch (e) {
      const { status, error } = httpError(e)
      return reply.code(status).send({ error })
    }
  })

  /** Enable/disable Verwendung tags (Inbox / CRM / Marketing) for a connection. */
  app.put('/api/b/:slug/integrations/module-bindings', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canManageCredentials(m)) {
      return reply.code(403).send({ error: 'forbidden' })
    }
    const body = SetModuleBindingSchema.safeParse(req.body)
    if (!body.success) {
      return reply.code(400).send({ error: 'invalid_body', issues: body.error.issues })
    }
    try {
      const result = await setModuleBindingsEnabled(m.businessId, body.data)
      return { result }
    } catch (e) {
      const { status, error } = httpError(e)
      return reply.code(status).send({ error })
    }
  })

  app.get(
    '/api/b/:slug/integrations/connections/:id/capabilities/:purpose',
    async (req, reply) => {
      const user = await requireUser(req)
      const { slug, id, purpose } = req.params as {
        slug: string
        id: string
        purpose: string
      }
      const m = await loadMembership(user.id, slug)
      if (!m) return reply.code(403).send({ error: 'forbidden' })
      const purposeParsed = BindingPurposeSchema.safeParse(purpose)
      if (!purposeParsed.success) {
        return reply.code(400).send({ error: 'invalid_purpose' })
      }
      const resolved = await resolveBindingCapability(
        m.businessId,
        id,
        purposeParsed.data,
      )
      if (!resolved) return reply.code(404).send({ error: 'not_found' })
      return { purpose: purposeParsed.data, ...resolved }
    },
  )

  app.put('/api/b/:slug/integrations/connections/:id/cursors/:stream', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id, stream } = req.params as { slug: string; id: string; stream: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canManageCredentials(m)) {
      return reply.code(403).send({ error: 'forbidden' })
    }
    const body = UpsertSyncCursorSchema.safeParse({
      stream,
      cursor: (req.body as { cursor?: string })?.cursor,
    })
    if (!body.success) {
      return reply.code(400).send({ error: 'invalid_body', issues: body.error.issues })
    }
    try {
      const cursor = await upsertSyncCursor(
        m.businessId,
        id,
        body.data.stream,
        body.data.cursor,
      )
      return { cursor: { stream: cursor.stream, updatedAt: cursor.updatedAt, renewedAt: cursor.renewedAt } }
    } catch (e) {
      const { status, error } = httpError(e)
      return reply.code(status).send({ error })
    }
  })

  /** Google Ads — list accessible customer IDs (OAuth; Cloud project must have Ads API enabled). */
  app.get('/api/b/:slug/integrations/google-ads/connections/:id/customers', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(403).send({ error: 'forbidden' })
    const conn = await getConnectionForBusiness(m.businessId, id)
    if (!conn || conn.provider !== 'google_ads') {
      return reply.code(404).send({ error: 'not_found' })
    }
    try {
      const { accessToken } = await getGoogleAccessToken(m.businessId, id)
      const customers = await listAccessibleCustomers(accessToken)
      return { customers }
    } catch (e) {
      const { status, error } = httpError(e)
      return reply.code(status).send({ error })
    }
  })

  /** Bind selected Google Ads customer id onto the connection (multi-account picker). */
  app.post('/api/b/:slug/integrations/google-ads/connections/:id/select-customer', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canManageCredentials(m)) {
      return reply.code(403).send({ error: 'forbidden' })
    }
    const customerId = String((req.body as { customerId?: string })?.customerId || '')
      .replace(/-/g, '')
      .trim()
    if (!/^\d{6,12}$/.test(customerId)) {
      return reply.code(400).send({ error: 'invalid_customer_id' })
    }
    const conn = await getConnectionForBusiness(m.businessId, id)
    if (!conn || conn.provider !== 'google_ads') {
      return reply.code(404).send({ error: 'not_found' })
    }
    const health = { ...(conn.health || {}), customerId, pendingCustomerPick: false }
    await db
      .update(connections)
      .set({
        health,
        displayName: conn.displayName || `Ads ${customerId}`,
        updatedAt: new Date(),
      })
      .where(and(eq(connections.id, id), eq(connections.businessId, m.businessId)))
    return { ok: true, customerId }
  })

  app.get('/api/b/:slug/integrations/google-ads/connections/:id/campaigns', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(403).send({ error: 'forbidden' })
    const conn = await getConnectionForBusiness(m.businessId, id)
    if (!conn || conn.provider !== 'google_ads') {
      return reply.code(404).send({ error: 'not_found' })
    }
    const customerId = String((conn.health as { customerId?: string })?.customerId || '')
    if (!customerId) {
      return reply.code(409).send({ error: 'customer_not_selected' })
    }
    try {
      const { accessToken } = await getGoogleAccessToken(m.businessId, id)
      const campaigns = await listCampaigns(accessToken, customerId)
      return { campaigns, customerId, mode: 'live' as const }
    } catch (e) {
      const { status, error } = httpError(e)
      return reply.code(status).send({ error })
    }
  })

  /** YouTube — upload / schedule from Planen (multipart: file + title/description/publishAt). */
  app.post('/api/b/:slug/integrations/youtube/connections/:id/upload', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m)) {
      return reply.code(403).send({ error: 'forbidden' })
    }
    const conn = await getConnectionForBusiness(m.businessId, id)
    if (!conn || conn.provider !== 'youtube') {
      return reply.code(404).send({ error: 'not_found' })
    }
    const data = await req.file()
    if (!data) return reply.code(400).send({ error: 'file_required' })
    const chunks: Buffer[] = []
    for await (const c of data.file) chunks.push(Buffer.from(c))
    const body = Buffer.concat(chunks)
    if (body.length === 0) return reply.code(400).send({ error: 'empty_file' })
    if (body.length > 256 * 1024 * 1024) {
      return reply.code(413).send({ error: 'file_too_large' })
    }
    const fields = data.fields as Record<string, { value?: string } | undefined>
    const title = String(fields.title?.value || data.filename || 'Untitled').slice(0, 100)
    const description = String(fields.description?.value || '').slice(0, 5000)
    const publishAt = fields.publishAt?.value ? String(fields.publishAt.value) : null
    try {
      const { accessToken } = await getGoogleAccessToken(m.businessId, id)
      const uploaded = await uploadYoutubeVideo({
        accessToken,
        title,
        description,
        mimeType: data.mimetype || 'video/mp4',
        body,
        publishAt,
      })
      return { ok: true, videoId: uploaded.id, status: uploaded.status }
    } catch (e) {
      const { status, error } = httpError(e)
      return reply.code(status).send({ error })
    }
  })
}
