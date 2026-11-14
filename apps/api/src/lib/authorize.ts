/**
 * Central company + platform AuthZ resolver (deny by default).
 * Location: apps/api/src/lib/authorize.ts
 */
import { and, eq, inArray } from 'drizzle-orm'
import {
  PERMISSION_KEYS,
  SYSTEM_BUNDLE_TEMPLATES,
  type MembershipAuthz,
  type PermissionKey,
  type PlatformCapability,
  hasPermission,
} from '@bu2/shared'
import { db } from '../db/client.js'
import {
  bundlePermissions,
  membershipBundles,
  memberships,
  permissionBundles,
  platformGrants,
} from '../db/schema.js'

const KNOWN = new Set<string>(PERMISSION_KEYS)

export type MembershipCtx = MembershipAuthz & {
  membershipId: string
  businessId: string
  slug: string
  status: string
  membershipStatus: string
}

export async function loadEffectivePermissions(membershipId: string): Promise<string[]> {
  const links = await db
    .select({ bundleId: membershipBundles.bundleId })
    .from(membershipBundles)
    .where(eq(membershipBundles.membershipId, membershipId))
  if (!links.length) return []
  const bundleIds = links.map((l) => l.bundleId)
  const rows = await db
    .select({ key: bundlePermissions.permissionKey })
    .from(bundlePermissions)
    .where(inArray(bundlePermissions.bundleId, bundleIds))
  const set = new Set<string>()
  for (const r of rows) {
    if (KNOWN.has(r.key)) set.add(r.key)
  }
  return [...set]
}

export async function buildMembershipCtx(row: {
  membershipId: string
  businessId: string
  slug: string
  businessStatus: string
  isOwner: boolean
  membershipStatus: string
}): Promise<MembershipCtx | null> {
  if (row.membershipStatus !== 'active') return null
  if (row.businessStatus !== 'active') return null
  const permissions = row.isOwner ? [] : await loadEffectivePermissions(row.membershipId)
  return {
    membershipId: row.membershipId,
    businessId: row.businessId,
    slug: row.slug,
    status: row.businessStatus,
    membershipStatus: row.membershipStatus,
    isOwner: row.isOwner,
    permissions,
  }
}

export function assertPermission(m: MembershipCtx, key: PermissionKey | string): void {
  if (!KNOWN.has(key) && !m.isOwner) {
    const err = new Error('Forbidden') as Error & { statusCode: number }
    err.statusCode = 403
    throw err
  }
  if (!hasPermission(m, key)) {
    const err = new Error('Forbidden') as Error & { statusCode: number }
    err.statusCode = 403
    throw err
  }
}

export async function hasPlatformCapability(
  userId: string,
  capability: PlatformCapability | string,
): Promise<boolean> {
  const rows = await db
    .select({ id: platformGrants.id })
    .from(platformGrants)
    .where(
      and(eq(platformGrants.userId, userId), eq(platformGrants.capabilityKey, capability)),
    )
    .limit(1)
  return Boolean(rows[0])
}

export async function assertCanCreateCompany(userId: string): Promise<void> {
  const ok = await hasPlatformCapability(userId, 'companies.create')
  if (!ok) {
    const err = new Error('Forbidden') as Error & { statusCode: number }
    err.statusCode = 403
    throw err
  }
}

/** Grant-subset: actor may only assign keys they themselves hold (owners bypass). */
export function assertGrantSubset(actor: MembershipCtx, keys: readonly string[]): void {
  if (actor.isOwner) return
  for (const key of keys) {
    if (!KNOWN.has(key) || !actor.permissions.includes(key)) {
      const err = new Error('Forbidden grant escalation') as Error & { statusCode: number }
      err.statusCode = 403
      throw err
    }
  }
}

export async function countActiveOwners(businessId: string): Promise<number> {
  const rows = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.businessId, businessId),
        eq(memberships.isOwner, true),
        eq(memberships.status, 'active'),
      ),
    )
  return rows.length
}

export async function seedSystemBundles(businessId: string): Promise<void> {
  for (const tpl of SYSTEM_BUNDLE_TEMPLATES) {
    const existing = await db
      .select({ id: permissionBundles.id })
      .from(permissionBundles)
      .where(and(eq(permissionBundles.businessId, businessId), eq(permissionBundles.key, tpl.key)))
      .limit(1)
    if (existing[0]) continue
    const [bundle] = await db
      .insert(permissionBundles)
      .values({
        businessId,
        key: tpl.key,
        name: tpl.nameDe,
        isSystem: true,
      })
      .returning()
    if (!bundle) continue
    if (tpl.permissions.length) {
      await db.insert(bundlePermissions).values(
        tpl.permissions.map((permissionKey) => ({
          bundleId: bundle.id,
          permissionKey,
        })),
      )
    }
  }
}
