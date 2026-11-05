/**
 * openseo domain helpers.
 * Location: apps/api/src/modules/openseo/service.ts
 */
import { timingSafeEqual } from 'node:crypto'
import { loadEnv } from '../../lib/env.js'

export function mapRole(role: string): 'admin' | 'member' | 'viewer' {
  if (role === 'owner' || role === 'admin') return 'admin'
  if (role === 'editor') return 'member'
  return 'viewer'
}

export function editorCapabilities() {
  return {
    allowed: ['research', 'analyze', 'audit', 'reports'] as const,
    denied: [
      'team_admin',
      'credentials',
      'global_integrations',
      'budgets',
      'irreversible_delete',
    ] as const,
  }
}

export function verifyInternalSecret(header: string | undefined): boolean {
  const env = loadEnv()
  if (!header) return false
  const expected = `Bearer ${env.OPENSEO_SSO_SHARED_SECRET}`
  const a = Buffer.from(header)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
