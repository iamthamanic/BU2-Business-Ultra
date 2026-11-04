/**
 * Integration Core HTTP — connections, bindings, providers (no plaintext credentials).
 * Location: apps/api/src/modules/integrations/routes.ts
 */
import type { FastifyInstance } from 'fastify'
import {
  BindingPurposeSchema,
  ConnectImapSchema,
  ConnectMockSchema,
  CreateModuleBindingSchema,
  IntegrationModuleSchema,
  SetModuleBindingSchema,
  UpsertSyncCursorSchema,
  canManageCredentials,
} from '@bu2/shared'
import {
  connectImapAccount,
  connectMockAccount,
  createModuleBinding,
  getConnectionForBusiness,
  listConnections,
  listModuleBindings,
  resolveBindingCapability,
  setModuleBindingsEnabled,
  upsertSyncCursor,
} from '../../lib/integrations/core/connections.js'
import { PROVIDER_CATALOG } from '../../lib/integrations/core/providers.js'
import { ensureMockAdapterRegistered } from '../../lib/integrations/core/mockAdapter.js'
import { ensureImapAdapterRegistered } from '../../lib/integrations/imap/adapter.js'
import { oauthClientConfiguredForProvider } from '../../lib/integrations/oauth/config.js'
import { oauthRedirectUriForProvider } from '../../lib/integrations/oauth/redirects.js'
import { isUnipileConfigured } from '../../lib/integrations/unipile/inboxSync.js'
import { loadMembership, requireUser } from '../../plugins/auth.js'

ensureMockAdapterRegistered()
ensureImapAdapterRegistered()

function httpError(e: unknown): { status: number; error: string } {
  const err = e as Error & { statusCode?: number }
  return {
    status: err.statusCode && err.statusCode >= 400 ? err.statusCode : 500,
    error: err.message || 'error',
  }
}

export async function integrationRoutes(app: FastifyInstance) {
  app.get('/api/b/:slug/integrations/providers', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m && !user.isSuperadmin) return reply.code(403).send({ error: 'forbidden' })
    const providers = PROVIDER_CATALOG.filter((p) => p.id !== 'mock').map((p) => {
      const redirectUri = oauthRedirectUriForProvider(p.id)
      const oauthConfigured =
        p.connectKind === 'oauth' ? oauthClientConfiguredForProvider(p.id) : null
      let adapterReady = p.adapterReady
      if (p.id === 'unipile') adapterReady = isUnipileConfigured()
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
              : true,
      }
    })
    return {
      providers,
      unipileConfigured: isUnipileConfigured(),
    }
  })

  app.post('/api/b/:slug/integrations/connections/imap', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || (!canManageCredentials(m.role) && !user.isSuperadmin)) {
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
    if (!m || (!canManageCredentials(m.role) && !user.isSuperadmin)) {
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
    if (!m || (!canManageCredentials(m.role) && !user.isSuperadmin)) {
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
    if (!m || (!canManageCredentials(m.role) && !user.isSuperadmin)) {
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
    if (!m || (!canManageCredentials(m.role) && !user.isSuperadmin)) {
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
}
