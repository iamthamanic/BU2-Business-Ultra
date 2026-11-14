/**
 * Omnichannel inbox sync — every inbox-bound connection, by provider.
 * Location: apps/api/src/lib/integrations/inbox/syncAll.ts
 */
import { listTelegramConnections, syncTelegramConnection } from '../telegram/inboxSync.js'
import { syncGmailConnection } from '../gmail/inboxSync.js'
import { syncUnipileConnection } from '../unipile/inboxSync.js'

export type InboxSyncResult = {
  connectionId: string
  provider: string
  ok: boolean
  imported?: number
  error?: string
  skipped?: boolean
}

/**
 * Providers that can ingest into Omnichannel Inbox today.
 * Meta/WhatsApp/IG native messaging + Outlook/IMAP: bind OK, sync later / via Unipile.
 */
const SYNCABLE = new Set(['google', 'telegram', 'unipile'])

export async function syncAllInboxConnections(businessId: string): Promise<{
  results: InboxSyncResult[]
  synced: number
  failed: number
  skipped: number
}> {
  const connections = await listTelegramConnections(businessId)
  const results: InboxSyncResult[] = []

  for (const c of connections) {
    if (!SYNCABLE.has(c.provider)) {
      results.push({
        connectionId: c.id,
        provider: c.provider,
        ok: true,
        skipped: true,
        error: 'inbox_sync_not_implemented',
      })
      continue
    }
    try {
      let imported = 0
      if (c.provider === 'google') {
        imported = (await syncGmailConnection(businessId, c.id)).imported
      } else if (c.provider === 'telegram') {
        imported = (await syncTelegramConnection(businessId, c.id)).imported
      } else if (c.provider === 'unipile') {
        imported = (await syncUnipileConnection(businessId, c.id)).imported
      }
      results.push({ connectionId: c.id, provider: c.provider, ok: true, imported })
    } catch (e) {
      const err = e as Error
      results.push({
        connectionId: c.id,
        provider: c.provider,
        ok: false,
        error: err.message || 'sync_failed',
      })
    }
  }

  return {
    results,
    synced: results.filter((r) => r.ok && !r.skipped).length,
    failed: results.filter((r) => !r.ok).length,
    skipped: results.filter((r) => r.skipped).length,
  }
}
