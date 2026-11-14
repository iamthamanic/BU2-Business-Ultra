/**
 * Central AuthZ decision helper + typed permission catalog (scopes).
 * Builds on bundles/`hasPermission` — not a second role engine.
 * Location: packages/shared/src/authz.ts
 */
import { hasPermission, PERMISSION_KEYS, type MembershipAuthz, type PermissionKey } from './permissions.js'

/** Resource access scopes resolved server-side from trusted relations. */
export const AUTHZ_SCOPES = [
  'own',
  'assigned',
  'project_member',
  'explicitly_granted',
  'company',
] as const

export type AuthzScope = (typeof AUTHZ_SCOPES)[number]

/**
 * Optional resource context for scope checks.
 * When omitted, `can()` only checks the permission key (company-level grant).
 */
export type AuthzResourceContext = {
  ownerUserId?: string | null
  assigneeUserIds?: readonly string[]
  memberUserIds?: readonly string[]
  /** Project/list visibility; default treated as members-only when scope requires it. */
  visibility?: 'company' | 'members' | 'confidential'
}

export type PermissionCatalogEntry = {
  key: PermissionKey
  module: string
  resource: string
  action: string
  scopes: readonly AuthzScope[]
  /** Must never be implied by unrelated generic read keys. */
  sensitive: boolean
  labelDe: string
  labelEn: string
}

export type AuthzActor = MembershipAuthz & {
  /** Required when evaluating own/assigned/project_member scopes. */
  userId?: string
}

export type CanDecision = {
  allowed: boolean
  reason:
    | 'ok'
    | 'unknown_key'
    | 'missing_permission'
    | 'scope_denied'
    | 'missing_actor_user_id'
}

const SENSITIVE_KEYS = new Set<PermissionKey>([
  'finance.read',
  'finance.write',
  'finance.export',
  'integrations.connections.manage',
  'members.permissions.manage',
  'settings.manage',
])

/** Default scopes by action suffix — company-wide unless narrowed. */
function defaultScopesForKey(key: PermissionKey): readonly AuthzScope[] {
  if (key.startsWith('projects.')) {
    return ['company', 'project_member', 'own']
  }
  if (key.startsWith('inbox.')) {
    return ['company', 'assigned', 'own']
  }
  if (key.startsWith('finance.') || key.startsWith('integrations.')) {
    return ['company']
  }
  return ['company']
}

function splitKey(key: PermissionKey): { module: string; resource: string; action: string } {
  const parts = key.split('.')
  if (parts.length === 2) {
    return { module: parts[0]!, resource: parts[0]!, action: parts[1]! }
  }
  if (parts.length >= 3) {
    return {
      module: parts[0]!,
      resource: parts.slice(1, -1).join('.'),
      action: parts[parts.length - 1]!,
    }
  }
  return { module: key, resource: key, action: 'manage' }
}

function labelFor(key: PermissionKey): { labelDe: string; labelEn: string } {
  return { labelDe: key, labelEn: key }
}

function buildCatalog(): Record<PermissionKey, PermissionCatalogEntry> {
  const out = {} as Record<PermissionKey, PermissionCatalogEntry>
  for (const key of PERMISSION_KEYS) {
    const { module, resource, action } = splitKey(key)
    const labels = labelFor(key)
    out[key] = {
      key,
      module,
      resource,
      action,
      scopes: defaultScopesForKey(key),
      sensitive: SENSITIVE_KEYS.has(key),
      labelDe: labels.labelDe,
      labelEn: labels.labelEn,
    }
  }
  return out
}

/** Typed catalog: every `PERMISSION_KEYS` entry with module/resource/action + scopes. */
export const PERMISSION_CATALOG: Readonly<Record<PermissionKey, PermissionCatalogEntry>> =
  buildCatalog()

export function getPermissionCatalogEntry(key: string): PermissionCatalogEntry | null {
  if (!(PERMISSION_KEYS as readonly string[]).includes(key)) return null
  return PERMISSION_CATALOG[key as PermissionKey]
}

function scopeAllows(actor: AuthzActor, scopes: readonly AuthzScope[], ctx: AuthzResourceContext): CanDecision {
  const hasCompany = scopes.includes('company')
  const vis = ctx.visibility

  // Pure company-scoped keys: permission key alone is enough.
  if (scopes.length === 1 && hasCompany) {
    return { allowed: true, reason: 'ok' }
  }

  // Company-visible resources: any grantee of the key may access.
  if (hasCompany && vis === 'company') {
    return { allowed: true, reason: 'ok' }
  }

  const relational = scopes.filter((s) => s !== 'company')
  if (relational.length === 0) {
    // Only company in scopes but visibility is members/confidential → deny
    return { allowed: false, reason: 'scope_denied' }
  }

  if (!actor.userId) {
    return { allowed: false, reason: 'missing_actor_user_id' }
  }
  const uid = actor.userId

  if (scopes.includes('own') && ctx.ownerUserId === uid) {
    return { allowed: true, reason: 'ok' }
  }
  if (scopes.includes('assigned') && ctx.assigneeUserIds?.includes(uid)) {
    return { allowed: true, reason: 'ok' }
  }
  if (scopes.includes('project_member') || scopes.includes('explicitly_granted')) {
    if (ctx.ownerUserId === uid || ctx.memberUserIds?.includes(uid)) {
      return { allowed: true, reason: 'ok' }
    }
  }

  // No visibility set + company also allowed → treat as company-wide (route omitted visibility).
  if (hasCompany && vis == null) {
    return { allowed: true, reason: 'ok' }
  }

  return { allowed: false, reason: 'scope_denied' }
}

/**
 * Deny-by-default AuthZ decision.
 * 1) Unknown key → deny
 * 2) Missing permission key (owners bypass via hasPermission) → deny
 * 3) Optional resource scope check when `ctx` is provided
 *
 * Owner note (v1): `hasPermission` grants all catalog keys to owners (admin control).
 * Sensitive keys are flagged in the catalog for UI warnings and future tightening — not blocked for owners here.
 */
export function can(
  actor: AuthzActor,
  key: PermissionKey | string,
  ctx?: AuthzResourceContext,
): CanDecision {
  const entry = getPermissionCatalogEntry(key)
  if (!entry) return { allowed: false, reason: 'unknown_key' }
  if (!hasPermission(actor, entry.key)) {
    return { allowed: false, reason: 'missing_permission' }
  }
  if (!ctx) return { allowed: true, reason: 'ok' }
  return scopeAllows(actor, entry.scopes, ctx)
}

export function assertCan(
  actor: AuthzActor,
  key: PermissionKey | string,
  ctx?: AuthzResourceContext,
): void {
  const decision = can(actor, key, ctx)
  if (decision.allowed) return
  const err = new Error(`Forbidden: ${decision.reason}`) as Error & { statusCode: number; reason: string }
  err.statusCode = 403
  err.reason = decision.reason
  throw err
}
