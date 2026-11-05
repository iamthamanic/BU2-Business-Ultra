/**
 * integrations domain helpers.
 * Location: apps/api/src/modules/integrations/service.ts
 */
import { ensureMockAdapterRegistered } from '../../lib/integrations/core/mockAdapter.js'
import { ensureImapAdapterRegistered } from '../../lib/integrations/imap/adapter.js'

ensureMockAdapterRegistered()
ensureImapAdapterRegistered()

export function httpError(e: unknown): { status: number; error: string } {
  const err = e as Error & { statusCode?: number }
  return {
    status: err.statusCode && err.statusCode >= 400 ? err.statusCode : 500,
    error: err.message || 'error',
  }
}
