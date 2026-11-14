/**
 * Unit tests for AuthZ helpers (no DB).
 * Location: apps/api/src/lib/authorize.test.ts
 */
import { describe, expect, it } from 'vitest'
import { hasPermission } from '@bu2/shared'
import { assertGrantSubset, assertPermission, type MembershipCtx } from './authorize.js'

function ctx(partial: Partial<MembershipCtx> & Pick<MembershipCtx, 'isOwner' | 'permissions'>): MembershipCtx {
  return {
    membershipId: 'm1',
    businessId: 'b1',
    slug: 'demo',
    status: 'active',
    membershipStatus: 'active',
    ...partial,
  }
}

describe('hasPermission / assertPermission', () => {
  it('owners pass any known key', () => {
    const m = ctx({ isOwner: true, permissions: [] })
    expect(hasPermission(m, 'finance.write')).toBe(true)
    expect(() => assertPermission(m, 'finance.write')).not.toThrow()
  })

  it('members need the key in their union', () => {
    const m = ctx({ isOwner: false, permissions: ['finance.read'] })
    expect(hasPermission(m, 'finance.read')).toBe(true)
    expect(hasPermission(m, 'finance.write')).toBe(false)
    expect(() => assertPermission(m, 'finance.write')).toThrow(/Forbidden/)
  })

  it('unknown keys deny for non-owners', () => {
    const m = ctx({ isOwner: false, permissions: ['finance.write'] })
    expect(() => assertPermission(m, 'not.a.real.key')).toThrow(/Forbidden/)
  })
})

describe('assertGrantSubset', () => {
  it('owners may assign any keys', () => {
    const actor = ctx({ isOwner: true, permissions: [] })
    expect(() => assertGrantSubset(actor, ['finance.write', 'members.invite'])).not.toThrow()
  })

  it('members cannot escalate beyond own keys', () => {
    const actor = ctx({ isOwner: false, permissions: ['finance.read'] })
    expect(() => assertGrantSubset(actor, ['finance.read'])).not.toThrow()
    expect(() => assertGrantSubset(actor, ['finance.write'])).toThrow(/grant escalation/)
  })

  it('unknown keys are rejected for members', () => {
    const actor = ctx({ isOwner: false, permissions: ['finance.read'] })
    expect(() => assertGrantSubset(actor, ['totally.fake'])).toThrow(/grant escalation/)
  })
})
