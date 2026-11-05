/**
 * OAuth helpers.
 * Location: apps/api/src/modules/integrations/oauthService.ts
 */
import { loadEnv } from '../../lib/env.js'

export function httpError(e: unknown): { status: number; error: string } {
  const err = e as Error & { statusCode?: number }
  return {
    status: err.statusCode && err.statusCode >= 400 ? err.statusCode : 500,
    error: err.message || 'error',
  }
}

export function settingsReturnUrl(slug: string): string {
  const web = loadEnv().PUBLIC_WEB_URL.replace(/\/$/, '')
  return `${web}/co/${encodeURIComponent(slug)}/settings?tab=connections&oauth=1`
}
