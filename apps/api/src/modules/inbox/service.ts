/**
 * inbox domain helpers.
 * Location: apps/api/src/modules/inbox/service.ts
 */
import { ensureTelegramAdapterRegistered } from '../../lib/integrations/telegram/adapter.js'
import { ensureUnipileAdapterRegistered } from '../../lib/integrations/unipile/adapter.js'

ensureTelegramAdapterRegistered()
ensureUnipileAdapterRegistered()

export function httpError(e: unknown): { status: number; error: string } {
  const err = e as Error & { statusCode?: number }
  return {
    status: err.statusCode && err.statusCode >= 400 ? err.statusCode : 500,
    error: err.message || 'error',
  }
}
