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

/** Route mapping for #18 (authz-module-fine-keys) — fine keys vs coarse canMutateContent. */
const MODULE_FINE_KEY_MAP = [
  { module: 'customers', read: 'customers.read', write: 'customers.write' },
  { module: 'tags', read: 'customers.read', write: 'customers.write' },
  { module: 'inbox', read: 'inbox.read', send: 'inbox.send', manage: 'inbox.manage' },
  { module: 'projects', read: 'projects.read', write: 'projects.write' },
  { module: 'marketing', read: 'marketing.campaign.read', write: 'marketing.campaign.write', publish: 'marketing.campaign.publish' },
  { module: 'ads', read: 'ads.campaign.read', write: 'ads.campaign.write' },
  { module: 'catalog', read: 'catalog.read', write: 'catalog.write' },
  { module: 'products', read: 'products.read', write: 'products.write' },
  { module: 'settings', read: 'settings.read' },
  { module: 'integrations', read: 'integrations.connections.read' },
  { module: 'cmb', read: 'finance.read', write: 'finance.write' },
  { module: 'sortanize', use: 'tools.use', manage: 'tools.manage' },
] as const

describe('module fine-key mapping (#18)', () => {
  it('documents read/write keys and denies cross-module writes', () => {
    const crmOnly = ctx({ isOwner: false, permissions: ['customers.read', 'customers.write'] })
    expect(hasPermission(crmOnly, 'customers.read')).toBe(true)
    expect(hasPermission(crmOnly, 'customers.write')).toBe(true)
    expect(hasPermission(crmOnly, 'projects.write')).toBe(false)
    expect(hasPermission(crmOnly, 'marketing.campaign.publish')).toBe(false)
    expect(() => assertPermission(crmOnly, 'inbox.send')).toThrow(/Forbidden/)
  })

  it('inbox send does not imply read or manage', () => {
    const sender = ctx({ isOwner: false, permissions: ['inbox.send'] })
    expect(hasPermission(sender, 'inbox.send')).toBe(true)
    expect(hasPermission(sender, 'inbox.read')).toBe(false)
    expect(hasPermission(sender, 'inbox.manage')).toBe(false)
  })

  it('keeps mapping table stable for route audits', () => {
    expect(MODULE_FINE_KEY_MAP.map((r) => r.module)).toEqual([
      'customers',
      'tags',
      'inbox',
      'projects',
      'marketing',
      'ads',
      'catalog',
      'products',
      'settings',
      'integrations',
      'cmb',
      'sortanize',
    ])
  })
})
