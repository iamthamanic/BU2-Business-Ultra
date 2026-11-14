import { describe, expect, it } from 'vitest'
import {
  AUTHZ_SCOPES,
  assertCan,
  can,
  getPermissionCatalogEntry,
  PERMISSION_CATALOG,
} from './authz.js'
import { PERMISSION_KEYS } from './permissions.js'

describe('PERMISSION_CATALOG', () => {
  it('covers every permission key exactly once', () => {
    for (const key of PERMISSION_KEYS) {
      expect(PERMISSION_CATALOG[key]?.key).toBe(key)
      for (const scope of PERMISSION_CATALOG[key].scopes) {
        expect(AUTHZ_SCOPES).toContain(scope)
      }
    }
    expect(Object.keys(PERMISSION_CATALOG).sort()).toEqual([...PERMISSION_KEYS].sort())
  })

  it('marks finance and credential keys sensitive', () => {
    expect(PERMISSION_CATALOG['finance.write'].sensitive).toBe(true)
    expect(PERMISSION_CATALOG['integrations.connections.manage'].sensitive).toBe(true)
    expect(PERMISSION_CATALOG['customers.read'].sensitive).toBe(false)
  })
})

describe('can()', () => {
  const member = { isOwner: false, permissions: ['projects.read', 'finance.read'], userId: 'u1' }
  const stranger = { isOwner: false, permissions: ['customers.read'], userId: 'u2' }
  const owner = { isOwner: true, permissions: [], userId: 'owner' }

  it('denies unknown keys (deny-by-default)', () => {
    expect(can(member, 'not.a.key').reason).toBe('unknown_key')
    expect(can(owner, 'not.a.key').allowed).toBe(false)
  })

  it('denies missing permission for members', () => {
    expect(can(member, 'customers.write')).toEqual({ allowed: false, reason: 'missing_permission' })
  })

  it('allows key-only checks when no context', () => {
    expect(can(member, 'finance.read')).toEqual({ allowed: true, reason: 'ok' })
  })

  it('owners pass known keys without listing permissions', () => {
    expect(can(owner, 'finance.write').allowed).toBe(true)
  })

  it('enforces project_member / own scopes', () => {
    const ctx = {
      visibility: 'members' as const,
      ownerUserId: 'u9',
      memberUserIds: ['u1'],
    }
    expect(can(member, 'projects.read', ctx).allowed).toBe(true)
    expect(can(stranger, 'projects.read', ctx).reason).toBe('missing_permission')
    const withKeyNoMembership = {
      isOwner: false,
      permissions: ['projects.read'],
      userId: 'u3',
    }
    expect(can(withKeyNoMembership, 'projects.read', ctx).reason).toBe('scope_denied')
    expect(
      can(withKeyNoMembership, 'projects.read', {
        visibility: 'company',
      }).allowed,
    ).toBe(true)
  })

  it('requires userId for relational scopes on members-only resources', () => {
    expect(
      can(
        { isOwner: false, permissions: ['projects.read'] },
        'projects.read',
        { visibility: 'members', memberUserIds: ['u1'] },
      ).reason,
    ).toBe('missing_actor_user_id')
  })

  it('assertCan throws 403', () => {
    expect(() => assertCan(stranger, 'finance.read')).toThrow(/missing_permission/)
  })
})

describe('getPermissionCatalogEntry', () => {
  it('returns null for unknown', () => {
    expect(getPermissionCatalogEntry('nope')).toBeNull()
    expect(getPermissionCatalogEntry('inbox.read')?.module).toBe('inbox')
  })
})
