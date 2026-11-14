/**
 * Connection persistence — tenant-scoped CRUD for Integration Core.
 * Location: apps/api/src/lib/integrations/core/connections.ts
 */
import { and, eq } from 'drizzle-orm'
import type {
  BindingPurpose,
  CreateModuleBindingInput,
  IntegrationModule,
  SetModuleBindingInput,
  StructuredCapability,
} from '@bu2/shared'
import { db } from '../../../db/client.js'
import {
  connectionCredentials,
  connections,
  moduleBindings,
  syncCursors,
} from '../../../db/schema.js'
import { keyHint, openSecret, sealSecret } from '../../crypto.js'
import type { AdapterConnectResult } from './adapter.js'
import { getAdapter } from './adapter.js'
import { parseCapabilitiesCache, purposeAllowed } from './capabilities.js'
import { ensureMockAdapterRegistered } from './mockAdapter.js'
import { ensureImapAdapterRegistered } from '../imap/adapter.js'
import { ensureFinapiAdapterRegistered } from '../finapi/adapter.js'
import { ensureAdsKeyAdaptersRegistered } from '../adsKey/adapter.js'

ensureMockAdapterRegistered()
ensureImapAdapterRegistered()
ensureFinapiAdapterRegistered()
ensureAdsKeyAdaptersRegistered()

export type PublicConnection = {
  id: string
  businessId: string
  provider: string
  authMethod: string
  externalAccountId: string
  displayName: string | null
  status: string
  accountType: string | null
  health: Record<string, unknown>
  capabilities: StructuredCapability[]
  createdAt: Date
  updatedAt: Date
}

function toPublic(row: typeof connections.$inferSelect): PublicConnection {
  return {
    id: row.id,
    businessId: row.businessId,
    provider: row.provider,
    authMethod: row.authMethod,
    externalAccountId: row.externalAccountId,
    displayName: row.displayName,
    status: row.status,
    accountType: row.accountType,
    health: (row.health || {}) as Record<string, unknown>,
    capabilities: parseCapabilitiesCache(row.capabilitiesCache),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/** Fail-closed tenant load — wrong business ⇒ null. */
export async function getConnectionForBusiness(
  businessId: string,
  connectionId: string,
): Promise<PublicConnection | null> {
  const rows = await db
    .select()
    .from(connections)
    .where(and(eq(connections.id, connectionId), eq(connections.businessId, businessId)))
    .limit(1)
  const row = rows[0]
  return row ? toPublic(row) : null
}

export async function listConnections(businessId: string): Promise<PublicConnection[]> {
  const rows = await db.select().from(connections).where(eq(connections.businessId, businessId))
  return rows.map(toPublic)
}

export async function connectMockAccount(opts: {
  businessId: string
  userId: string
  externalAccountId: string
  displayName?: string
  credential: string
  accountType?: string
}): Promise<PublicConnection> {
  const adapter = getAdapter('mock')
  if (!adapter) throw Object.assign(new Error('adapter_unavailable'), { statusCode: 501 })

  const result = await adapter.connect({
    externalAccountId: opts.externalAccountId,
    displayName: opts.displayName,
    credential: opts.credential,
    accountType: opts.accountType,
  })

  try {
    const inserted = await db
      .insert(connections)
      .values({
        businessId: opts.businessId,
        provider: result.provider,
        authMethod: result.authMethod,
        externalAccountId: result.externalAccountId,
        displayName: result.displayName,
        status: 'active',
        accountType: result.accountType,
        health: result.health,
        capabilitiesCache: result.capabilities,
        createdByUserId: opts.userId,
      })
      .returning()

    const conn = inserted[0]
    if (!conn) throw new Error('insert_failed')

    for (const cred of result.credentials) {
      const sealed = sealSecret(cred.plaintext)
      await db.insert(connectionCredentials).values({
        connectionId: conn.id,
        kind: cred.kind,
        ciphertext: sealed.ciphertext,
        iv: sealed.iv,
        tag: sealed.tag,
        keyHint: keyHint(cred.plaintext),
      })
    }

    return toPublic(conn)
  } catch (e) {
    const msg = String(e)
    if (msg.includes('connections_biz_provider_ext_uidx') || msg.includes('unique')) {
      throw Object.assign(new Error('connection_exists'), { statusCode: 409 })
    }
    throw e
  }
}

/** Persist any adapter connect result (encrypted credentials + optional module bindings). */
export async function persistAdapterConnection(opts: {
  businessId: string
  userId: string
  result: AdapterConnectResult
  bindInbox?: boolean
  bindFinance?: boolean
}): Promise<PublicConnection> {
  try {
    const inserted = await db
      .insert(connections)
      .values({
        businessId: opts.businessId,
        provider: opts.result.provider,
        authMethod: opts.result.authMethod,
        externalAccountId: opts.result.externalAccountId,
        displayName: opts.result.displayName,
        status: 'active',
        accountType: opts.result.accountType,
        health: opts.result.health,
        capabilitiesCache: opts.result.capabilities,
        createdByUserId: opts.userId,
      })
      .returning()

    const conn = inserted[0]
    if (!conn) throw new Error('insert_failed')

    for (const cred of opts.result.credentials) {
      const sealed = sealSecret(cred.plaintext)
      await db.insert(connectionCredentials).values({
        connectionId: conn.id,
        kind: cred.kind,
        ciphertext: sealed.ciphertext,
        iv: sealed.iv,
        tag: sealed.tag,
        keyHint: keyHint(cred.plaintext),
      })
    }

    if (opts.bindInbox) {
      for (const purpose of ['read_mail', 'read_dm', 'sync'] as const) {
        const check = purposeAllowed(opts.result.capabilities, purpose)
        if (!check.allowed) continue
        await db.insert(moduleBindings).values({
          businessId: opts.businessId,
          connectionId: conn.id,
          module: 'inbox',
          purpose,
          enabled: true,
        })
      }
    }

    if (opts.bindFinance) {
      const check = purposeAllowed(opts.result.capabilities, 'sync')
      if (check.allowed) {
        await db.insert(moduleBindings).values({
          businessId: opts.businessId,
          connectionId: conn.id,
          module: 'finance',
          purpose: 'sync',
          enabled: true,
        })
      }
    }

    return toPublic(conn)
  } catch (e) {
    const msg = String(e)
    if (msg.includes('connections_biz_provider_ext_uidx') || msg.includes('unique')) {
      throw Object.assign(new Error('connection_exists'), { statusCode: 409 })
    }
    throw e
  }
}

export async function connectImapAccount(opts: {
  businessId: string
  userId: string
  host: string
  port?: number
  user: string
  password: string
  secure: boolean
  protocol: 'imap' | 'pop3'
  displayName?: string
}): Promise<PublicConnection> {
  const adapter = getAdapter('imap')
  if (!adapter) throw Object.assign(new Error('adapter_unavailable'), { statusCode: 501 })
  const port = opts.port ?? (opts.secure ? 993 : 143)
  const result = await adapter.connect({
    externalAccountId: 'pending',
    displayName: opts.displayName,
    credential: JSON.stringify({
      host: opts.host,
      port,
      user: opts.user,
      password: opts.password,
      secure: opts.secure,
      protocol: opts.protocol,
    }),
  })
  return persistAdapterConnection({
    businessId: opts.businessId,
    userId: opts.userId,
    result,
    bindInbox: true,
  })
}

export async function connectFinapiAccount(opts: {
  businessId: string
  userId: string
  displayName?: string
}): Promise<PublicConnection> {
  const adapter = getAdapter('finapi')
  if (!adapter) throw Object.assign(new Error('adapter_unavailable'), { statusCode: 501 })
  const result = await adapter.connect({
    externalAccountId: 'pending',
    displayName: opts.displayName,
    credential: 'env',
  })
  return persistAdapterConnection({
    businessId: opts.businessId,
    userId: opts.userId,
    result,
    bindFinance: true,
  })
}

/** @deprecated Paid ads use OAuth — kept to avoid broken imports. */
export async function connectAdsApiKeyAccount(_opts: {
  businessId: string
  userId: string
  provider: string
  apiKey: string
  displayName?: string
}): Promise<PublicConnection> {
  throw Object.assign(new Error('ads_api_key_retired'), { statusCode: 410 })
}

/** Soft-delete: revoke connection (credentials cascade via FK). */
export async function revokeConnection(
  businessId: string,
  connectionId: string,
): Promise<boolean> {
  const conn = await getConnectionForBusiness(businessId, connectionId)
  if (!conn) return false
  await db
    .delete(moduleBindings)
    .where(
      and(eq(moduleBindings.businessId, businessId), eq(moduleBindings.connectionId, connectionId)),
    )
  await db
    .delete(connectionCredentials)
    .where(eq(connectionCredentials.connectionId, connectionId))
  await db
    .delete(connections)
    .where(and(eq(connections.id, connectionId), eq(connections.businessId, businessId)))
  return true
}

/** Server-only — never expose via API. */
export async function readConnectionCredential(
  businessId: string,
  connectionId: string,
  kind: string,
): Promise<string | null> {
  const conn = await getConnectionForBusiness(businessId, connectionId)
  if (!conn) return null
  const rows = await db
    .select()
    .from(connectionCredentials)
    .where(
      and(
        eq(connectionCredentials.connectionId, connectionId),
        eq(connectionCredentials.kind, kind),
      ),
    )
    .limit(1)
  const row = rows[0]
  if (!row) return null
  return openSecret(row.ciphertext, row.iv, row.tag)
}

export async function createModuleBinding(
  businessId: string,
  input: CreateModuleBindingInput,
): Promise<typeof moduleBindings.$inferSelect> {
  const conn = await getConnectionForBusiness(businessId, input.connectionId)
  if (!conn) {
    throw Object.assign(new Error('connection_not_found'), { statusCode: 404 })
  }

  const check = purposeAllowed(conn.capabilities, input.purpose)
  if (input.enabled && !check.allowed) {
    throw Object.assign(new Error(check.reason || 'capability_denied'), { statusCode: 409 })
  }

  try {
    const rows = await db
      .insert(moduleBindings)
      .values({
        businessId,
        connectionId: input.connectionId,
        module: input.module,
        purpose: input.purpose,
        enabled: input.enabled,
      })
      .returning()
    const row = rows[0]
    if (!row) throw new Error('insert_failed')
    return row
  } catch (e) {
    const msg = String(e)
    if (msg.includes('module_bindings_conn_mod_purpose_uidx') || msg.includes('unique')) {
      throw Object.assign(new Error('binding_exists'), { statusCode: 409 })
    }
    throw e
  }
}

export async function listModuleBindings(
  businessId: string,
  opts?: { activeOnly?: boolean; module?: IntegrationModule },
) {
  const rows = await db
    .select()
    .from(moduleBindings)
    .where(eq(moduleBindings.businessId, businessId))
  return rows.filter((r) => {
    if (opts?.activeOnly && !r.enabled) return false
    if (opts?.module && r.module !== opts.module) return false
    return true
  })
}

/** Default purposes when enabling a module tag from Settings UX. */
const MODULE_ENABLE_PURPOSES: Record<
  Extract<IntegrationModule, 'inbox' | 'crm' | 'marketing'>,
  BindingPurpose[]
> = {
  inbox: ['read_dm', 'send_dm', 'read_mail', 'send_mail', 'sync'],
  crm: ['read_dm', 'read_mail'],
  marketing: ['send_dm', 'send_mail'],
}

/**
 * Toggle Verwendung tags (Inbox / CRM / Marketing).
 * Enable: upsert default purposes that pass capability check.
 * Disable: set enabled=false on all bindings for that connection+module.
 */
export async function setModuleBindingsEnabled(
  businessId: string,
  input: SetModuleBindingInput,
): Promise<{ module: string; enabled: boolean; bindings: (typeof moduleBindings.$inferSelect)[] }> {
  const mod = input.module
  if (mod !== 'inbox' && mod !== 'crm' && mod !== 'marketing') {
    throw Object.assign(new Error('module_not_toggleable'), { statusCode: 400 })
  }

  const conn = await getConnectionForBusiness(businessId, input.connectionId)
  if (!conn) {
    throw Object.assign(new Error('connection_not_found'), { statusCode: 404 })
  }

  if (!input.enabled) {
    await db
      .update(moduleBindings)
      .set({ enabled: false })
      .where(
        and(
          eq(moduleBindings.businessId, businessId),
          eq(moduleBindings.connectionId, input.connectionId),
          eq(moduleBindings.module, mod),
        ),
      )
    const bindings = await listModuleBindings(businessId).then((rows) =>
      rows.filter((r) => r.connectionId === input.connectionId && r.module === mod),
    )
    return { module: mod, enabled: false, bindings }
  }

  const purposes = MODULE_ENABLE_PURPOSES[mod]
  const created: (typeof moduleBindings.$inferSelect)[] = []
  for (const purpose of purposes) {
    const check = purposeAllowed(conn.capabilities, purpose)
    if (!check.allowed) continue

    const existing = await db
      .select()
      .from(moduleBindings)
      .where(
        and(
          eq(moduleBindings.connectionId, input.connectionId),
          eq(moduleBindings.module, mod),
          eq(moduleBindings.purpose, purpose),
        ),
      )
      .limit(1)

    if (existing[0]) {
      const updated = await db
        .update(moduleBindings)
        .set({ enabled: true })
        .where(eq(moduleBindings.id, existing[0].id))
        .returning()
      if (updated[0]) created.push(updated[0])
    } else {
      const inserted = await db
        .insert(moduleBindings)
        .values({
          businessId,
          connectionId: input.connectionId,
          module: mod,
          purpose,
          enabled: true,
        })
        .returning()
      if (inserted[0]) created.push(inserted[0])
    }
  }

  if (created.length === 0) {
    throw Object.assign(new Error('no_capable_purpose'), { statusCode: 409 })
  }

  return { module: mod, enabled: true, bindings: created }
}

export async function upsertSyncCursor(
  businessId: string,
  connectionId: string,
  stream: string,
  cursor: string,
) {
  const conn = await getConnectionForBusiness(businessId, connectionId)
  if (!conn) {
    throw Object.assign(new Error('connection_not_found'), { statusCode: 404 })
  }
  const existing = await db
    .select()
    .from(syncCursors)
    .where(and(eq(syncCursors.connectionId, connectionId), eq(syncCursors.stream, stream)))
    .limit(1)
  if (existing[0]) {
    const updated = await db
      .update(syncCursors)
      .set({ cursor, renewedAt: new Date(), updatedAt: new Date() })
      .where(eq(syncCursors.id, existing[0].id))
      .returning()
    return updated[0]!
  }
  const inserted = await db
    .insert(syncCursors)
    .values({ connectionId, stream, cursor, renewedAt: new Date() })
    .returning()
  return inserted[0]!
}

export async function resolveBindingCapability(
  businessId: string,
  connectionId: string,
  purpose: BindingPurpose,
) {
  const conn = await getConnectionForBusiness(businessId, connectionId)
  if (!conn) return null
  return purposeAllowed(conn.capabilities, purpose)
}
