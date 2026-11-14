/**
 * Stable company permission catalog + AuthZ helpers.
 * Location: packages/shared/src/permissions.ts
 */
import { z } from 'zod'

export const PERMISSION_KEYS = [
  'members.read',
  'members.invite',
  'members.permissions.manage',
  'members.remove',
  'marketing.campaign.read',
  'marketing.campaign.write',
  'marketing.campaign.publish',
  'ads.campaign.read',
  'ads.campaign.write',
  'ads.budget.manage',
  'customers.read',
  'customers.write',
  'customers.export',
  'projects.read',
  'projects.write',
  'projects.delete',
  'inbox.read',
  'inbox.send',
  'inbox.manage',
  'finance.read',
  'finance.write',
  'finance.export',
  'integrations.connections.read',
  'integrations.connections.manage',
  'apps.install',
  'apps.manage',
  'apps.use',
  'catalog.read',
  'catalog.write',
  'products.read',
  'products.write',
  'settings.read',
  'settings.manage',
  'tools.use',
  'tools.manage',
  'seo.open',
  'mail.send',
] as const

export type PermissionKey = (typeof PERMISSION_KEYS)[number]

export const PermissionKeySchema = z.enum(PERMISSION_KEYS)

export type MembershipAuthz = {
  isOwner: boolean
  permissions: readonly string[]
}

export function hasPermission(m: MembershipAuthz, key: PermissionKey | string): boolean {
  if (m.isOwner) return true
  return m.permissions.includes(key)
}

export function hasAnyPermission(
  m: MembershipAuthz,
  keys: readonly (PermissionKey | string)[],
): boolean {
  if (m.isOwner) return true
  return keys.some((k) => m.permissions.includes(k))
}

/** System bundle templates copied per company on create. */
export const SYSTEM_BUNDLE_TEMPLATES: ReadonlyArray<{
  key: string
  nameDe: string
  nameEn: string
  permissions: readonly PermissionKey[]
}> = [
  {
    key: 'administration',
    nameDe: 'Administration',
    nameEn: 'Administration',
    permissions: [
      'members.read',
      'members.invite',
      'members.permissions.manage',
      'members.remove',
      'settings.read',
      'settings.manage',
      'integrations.connections.read',
      'integrations.connections.manage',
      'apps.install',
      'apps.manage',
      'apps.use',
      'tools.use',
      'tools.manage',
      'seo.open',
      'mail.send',
    ],
  },
  {
    key: 'marketing',
    nameDe: 'Marketing',
    nameEn: 'Marketing',
    permissions: [
      'marketing.campaign.read',
      'marketing.campaign.write',
      'marketing.campaign.publish',
      'ads.campaign.read',
      'ads.campaign.write',
      'inbox.read',
      'inbox.send',
    ],
  },
  {
    key: 'projects',
    nameDe: 'Projekte',
    nameEn: 'Projects',
    permissions: ['projects.read', 'projects.write', 'projects.delete'],
  },
  {
    key: 'crm',
    nameDe: 'CRM',
    nameEn: 'CRM',
    permissions: ['customers.read', 'customers.write', 'customers.export'],
  },
  {
    key: 'finance_read',
    nameDe: 'Finanzen (Lesen)',
    nameEn: 'Finance (read)',
    permissions: ['finance.read', 'finance.export'],
  },
]

export function canManageMembers(m: MembershipAuthz): boolean {
  return hasAnyPermission(m, ['members.invite', 'members.permissions.manage', 'members.remove'])
}

export function canSendMail(m: MembershipAuthz): boolean {
  return hasPermission(m, 'mail.send')
}

export function canManageCredentials(m: MembershipAuthz): boolean {
  return hasPermission(m, 'integrations.connections.manage')
}

export function canMutateContent(m: MembershipAuthz): boolean {
  return hasAnyPermission(m, [
    'marketing.campaign.write',
    'marketing.campaign.publish',
    'ads.campaign.write',
    'customers.write',
    'projects.write',
    'catalog.write',
    'products.write',
    'inbox.send',
    'finance.write',
  ])
}

export function canOpenSeo(m: MembershipAuthz): boolean {
  return hasPermission(m, 'seo.open')
}

export function canUseTools(m: MembershipAuthz): boolean {
  return hasAnyPermission(m, ['tools.use', 'tools.manage', 'apps.use'])
}

export function canManageTools(m: MembershipAuthz): boolean {
  return hasAnyPermission(m, ['tools.manage', 'apps.manage', 'apps.install'])
}

export const PLATFORM_CAPABILITIES = ['companies.create'] as const
export type PlatformCapability = (typeof PLATFORM_CAPABILITIES)[number]

export const BootstrapSetupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(160).optional(),
  companyName: z.string().min(1).max(120),
  companySlug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
})
export type BootstrapSetupInput = z.infer<typeof BootstrapSetupSchema>

export const InviteSchema = z.object({
  email: z.string().email(),
  bundleIds: z.array(z.string().uuid()).default([]),
})

export const BundleCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  permissions: z.array(PermissionKeySchema).min(1),
})

export const BundleUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  permissions: z.array(PermissionKeySchema).min(1).optional(),
  version: z.number().int().positive(),
})

export const MembershipBundlesAssignSchema = z.object({
  userId: z.string().uuid(),
  bundleIds: z.array(z.string().uuid()),
})
