/**
 * Finish OAuth: map tokens → AdapterConnectResult and persist (upsert) into Integration Core.
 * Location: apps/api/src/lib/integrations/oauth/complete.ts
 */
import { and, eq } from 'drizzle-orm'
import type { IntegrationProvider, StructuredCapability } from '@bu2/shared'
import { db } from '../../../db/client.js'
import { connectionCredentials, connections, moduleBindings } from '../../../db/schema.js'
import { keyHint, sealSecret } from '../../crypto.js'
import type { AdapterConnectResult } from '../core/adapter.js'
import { persistAdapterConnection, type PublicConnection } from '../core/connections.js'
import type { ExchangedTokens } from './exchange.js'
import { oauthRedirectKey } from './redirects.js'

type CapOp = {
  operation: StructuredCapability['operation']
  messageFormats: string[]
  window: StructuredCapability['window']
  reason?: string
}

function buildCapabilities(
  accountType: string,
  scopes: string[],
  ops: CapOp[],
): StructuredCapability[] {
  const base = {
    accountType,
    scopes,
    availability: 'available' as const,
  }
  return ops.map((op) => ({
    operation: op.operation,
    allowed: true,
    messageFormats: op.messageFormats,
    window: op.window,
    ...(op.reason ? { reason: op.reason } : {}),
    ...base,
  }))
}

const NONE_WINDOW = { kind: 'none' as const, freeReplyHours: null }
const CARE_WINDOW = { kind: 'customer_care_hours' as const, freeReplyHours: 24 }

function capabilitiesFor(
  provider: IntegrationProvider,
  tokens: ExchangedTokens,
): StructuredCapability[] {
  const { accountType, scopes } = tokens
  if (provider === 'youtube') {
    return buildCapabilities(accountType, scopes, [
      { operation: 'insights', messageFormats: [], window: NONE_WINDOW },
      { operation: 'publish', messageFormats: ['video', 'short'], window: NONE_WINDOW },
      { operation: 'sync', messageFormats: [], window: NONE_WINDOW },
    ])
  }
  if (
    provider === 'google_ads' ||
    provider === 'chatgpt_ads' ||
    provider === 'reddit_ads' ||
    provider === 'microsoft_ads'
  ) {
    return buildCapabilities(accountType, scopes, [
      { operation: 'insights', messageFormats: [], window: NONE_WINDOW },
      {
        operation: 'publish',
        messageFormats: [],
        window: NONE_WINDOW,
        reason: 'ads_mutate_when_ui_ready',
      },
      { operation: 'sync', messageFormats: [], window: NONE_WINDOW },
    ])
  }
  const key = oauthRedirectKey(provider)
  if (key === 'meta') {
    if (provider === 'meta_ads') {
      return buildCapabilities(accountType, scopes, [
        { operation: 'sync', messageFormats: [], window: NONE_WINDOW },
        {
          operation: 'publish',
          messageFormats: [],
          window: NONE_WINDOW,
          reason: 'ads_mutate_when_ui_ready',
        },
      ])
    }
    return buildCapabilities(accountType, scopes, [
      {
        operation: 'read_dm',
        messageFormats: ['text', 'image', 'file', 'audio'],
        window: CARE_WINDOW,
      },
      {
        operation: 'send_dm',
        messageFormats: ['text', 'image', 'file', 'audio', 'voice'],
        window: CARE_WINDOW,
      },
      { operation: 'sync', messageFormats: [], window: NONE_WINDOW },
    ])
  }
  if (
    key === 'linkedin' ||
    key === 'tiktok' ||
    key === 'x' ||
    key === 'pinterest' ||
    provider === 'tiktok_ads' ||
    provider === 'pinterest_ads'
  ) {
    return buildCapabilities(accountType, scopes, [
      { operation: 'insights', messageFormats: [], window: NONE_WINDOW },
      {
        operation: 'publish',
        messageFormats: ['text', 'image', 'video'],
        window: NONE_WINDOW,
        reason: 'publish_when_channel_ui_ready',
      },
      { operation: 'sync', messageFormats: [], window: NONE_WINDOW },
    ])
  }
  return buildCapabilities(accountType, scopes, [
    { operation: 'read_mail', messageFormats: ['text', 'html', 'file'], window: NONE_WINDOW },
    { operation: 'send_mail', messageFormats: ['text', 'html', 'file'], window: NONE_WINDOW },
    { operation: 'sync', messageFormats: [], window: NONE_WINDOW },
  ])
}

function shouldBindInbox(provider: IntegrationProvider): boolean {
  return (
    provider === 'google' ||
    provider === 'microsoft' ||
    provider === 'imap' ||
    provider === 'telegram' ||
    provider === 'unipile' ||
    provider === 'whatsapp' ||
    provider === 'instagram' ||
    provider === 'facebook' ||
    provider === 'meta'
  )
}

export function tokensToConnectResult(
  provider: IntegrationProvider,
  tokens: ExchangedTokens,
): AdapterConnectResult {
  const key = oauthRedirectKey(provider)
  const credentials: AdapterConnectResult['credentials'] = [
    { kind: 'access', plaintext: tokens.accessToken },
  ]
  if (tokens.refreshToken) {
    credentials.push({ kind: 'refresh', plaintext: tokens.refreshToken })
  }

  return {
    provider,
    authMethod: 'oauth_pkce',
    externalAccountId: tokens.externalAccountId,
    displayName: tokens.displayName,
    accountType: tokens.accountType,
    credentials,
    capabilities: capabilitiesFor(provider, tokens),
    health: {
      ok: true,
      adapter: `oauth_${key ?? provider}`,
      scopes: tokens.scopes,
      expiresAt: tokens.expiresAt?.toISOString() ?? null,
      checkedAt: new Date().toISOString(),
      pendingCustomerPick: provider === 'google_ads' ? true : undefined,
    },
  }
}

async function replaceCredentials(
  connectionId: string,
  result: AdapterConnectResult,
  expiresAt: Date | null,
): Promise<void> {
  // Atomic replace — avoid empty credentials if an insert fails mid-loop.
  await db.transaction(async (tx) => {
    await tx
      .delete(connectionCredentials)
      .where(eq(connectionCredentials.connectionId, connectionId))
    for (const cred of result.credentials) {
      const sealed = sealSecret(cred.plaintext)
      await tx.insert(connectionCredentials).values({
        connectionId,
        kind: cred.kind,
        ciphertext: sealed.ciphertext,
        iv: sealed.iv,
        tag: sealed.tag,
        keyHint: keyHint(cred.plaintext),
        expiresAt: cred.kind === 'access' ? expiresAt : null,
      })
    }
  })
}

/**
 * Insert or refresh an OAuth connection for the same business+provider+external id.
 */
export async function persistOAuthConnection(opts: {
  businessId: string
  userId: string
  provider: IntegrationProvider
  tokens: ExchangedTokens
}): Promise<PublicConnection> {
  const result = tokensToConnectResult(opts.provider, opts.tokens)
  const bindInbox = shouldBindInbox(opts.provider)

  const existing = await db
    .select()
    .from(connections)
    .where(
      and(
        eq(connections.businessId, opts.businessId),
        eq(connections.provider, result.provider),
        eq(connections.externalAccountId, result.externalAccountId),
      ),
    )
    .limit(1)

  if (existing[0]) {
    const updated = await db
      .update(connections)
      .set({
        displayName: result.displayName,
        status: 'active',
        accountType: result.accountType,
        authMethod: result.authMethod,
        health: result.health,
        capabilitiesCache: result.capabilities,
        updatedAt: new Date(),
      })
      .where(eq(connections.id, existing[0].id))
      .returning()

    const row = updated[0]
    if (!row) throw new Error('update_failed')
    await replaceCredentials(row.id, result, opts.tokens.expiresAt)

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
      capabilities: result.capabilities,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }

  const created = await persistAdapterConnection({
    businessId: opts.businessId,
    userId: opts.userId,
    result,
    bindInbox,
  })

  if (opts.tokens.expiresAt) {
    await db
      .update(connectionCredentials)
      .set({ expiresAt: opts.tokens.expiresAt })
      .where(
        and(
          eq(connectionCredentials.connectionId, created.id),
          eq(connectionCredentials.kind, 'access'),
        ),
      )
  }

  if (opts.provider === 'youtube' || opts.provider === 'google_ads') {
    const module = opts.provider === 'youtube' ? 'marketing' : 'ads'
    for (const purpose of ['insights', 'publish', 'sync'] as const) {
      const existingBind = await db
        .select()
        .from(moduleBindings)
        .where(
          and(
            eq(moduleBindings.connectionId, created.id),
            eq(moduleBindings.module, module),
            eq(moduleBindings.purpose, purpose),
          ),
        )
        .limit(1)
      if (!existingBind[0]) {
        await db.insert(moduleBindings).values({
          businessId: opts.businessId,
          connectionId: created.id,
          module,
          purpose,
          enabled: true,
        })
      }
    }
  }

  return created
}
