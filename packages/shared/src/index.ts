import { z } from 'zod'

export const RoleSchema = z.enum(['owner', 'admin', 'editor', 'viewer'])
export type Role = z.infer<typeof RoleSchema>

export const LocaleSchema = z.enum(['de', 'en'])
export type Locale = z.infer<typeof LocaleSchema>

export const SecretProviderSchema = z.enum([
  'metricool',
  'brevo',
  'google_ads',
  'meta_ads',
  'tiktok_ads',
  'chatgpt_ads',
])
export type SecretProvider = z.infer<typeof SecretProviderSchema>

export const BusinessStatusSchema = z.enum(['active', 'archived'])
export type BusinessStatus = z.infer<typeof BusinessStatusSchema>

export const slugSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

export const CreateBusinessSchema = z.object({
  name: z.string().min(1).max(120),
  slug: slugSchema,
})

export const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'editor', 'viewer']),
})

export const MagicLinkRequestSchema = z.object({
  email: z.string().email(),
})

export const MagicLinkVerifySchema = z.object({
  token: z.string().min(16),
})

export const OtpVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
})

export const PasswordLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
})

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200).optional(),
  newPassword: z.string().min(8).max(200),
})

export const CatalogProductSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  sku: z.string().max(80).optional(),
  description: z.string().max(4000).optional(),
  currency: z.string().length(3).default('EUR'),
  netPriceCents: z.number().int().nonnegative().default(0),
  taxRateBps: z.number().int().min(0).max(10000).default(1900),
  active: z.boolean().default(true),
})

export const SocialNetworkSchema = z.enum([
  'facebook',
  'instagram',
  'linkedin',
  'tiktok',
  'youtube',
  'x',
])
export type SocialNetwork = z.infer<typeof SocialNetworkSchema>

export const SocialDraftVariantSchema = z.object({
  network: SocialNetworkSchema,
  text: z.string().max(5000).optional(),
  mediaUrls: z.array(z.string().url()).max(10).optional(),
  format: z.string().max(40).optional(),
  scheduledAt: z.string().datetime().optional(),
  enabled: z.boolean().default(true),
})

export const SocialMasterDraftSchema = z.object({
  title: z.string().min(1).max(200),
  masterText: z.string().max(5000).default(''),
  variants: z.array(SocialDraftVariantSchema).default([]),
})

export const ConfirmMutationSchema = z.object({
  confirm: z.literal(true),
  reason: z.string().max(500).optional(),
})

export const CheckMapNodeSchema = z.object({
  id: z.string(),
  type: z.enum(['milestone', 'todo', 'note']),
  title: z.string().min(1).max(200),
  x: z.number(),
  y: z.number(),
  status: z.enum(['open', 'doing', 'done', 'blocked']).default('open'),
  priority: z.enum(['p0', 'p1', 'p2', 'p3']).default('p2'),
  dueAt: z.string().datetime().optional(),
})

export const CheckMapEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
})

export const CheckMapBoardSchema = z.object({
  title: z.string().min(1).max(200),
  nodes: z.array(CheckMapNodeSchema).default([]),
  edges: z.array(CheckMapEdgeSchema).default([]),
})

export const PersonaSchema = z.object({
  name: z.string().min(1).max(120),
  summary: z.string().max(2000).optional(),
  goals: z.array(z.string()).default([]),
  pains: z.array(z.string()).default([]),
  channels: z.array(z.string()).default([]),
  journey: z
    .array(
      z.object({
        stage: z.enum(['aware', 'consider', 'decide', 'use', 'advocate']),
        lane: z.string(),
        note: z.string().max(1000).optional(),
      }),
    )
    .default([]),
})

export const AdsCampaignDraftSchema = z.object({
  provider: z.enum(['google_ads', 'meta_ads', 'tiktok_ads', 'chatgpt_ads']),
  name: z.string().min(1).max(200),
  budgetDailyCents: z.number().int().nonnegative().optional(),
  objective: z.string().max(120).optional(),
  payload: z.record(z.unknown()).default({}),
})

export const MODULE_KEYS = [
  'overview',
  'catalog',
  'marketing',
  'ads',
  'cmb',
  'checkmap',
  'personas',
  'sortanize',
  'openseo',
  'settings',
] as const
export type ModuleKey = (typeof MODULE_KEYS)[number]

export function canManageMembers(role: Role): boolean {
  return role === 'owner' || role === 'admin'
}

export function canSendMail(role: Role): boolean {
  return role === 'owner' || role === 'admin'
}

export function canManageCredentials(role: Role): boolean {
  return role === 'owner' || role === 'admin'
}

export function canMutateContent(role: Role): boolean {
  return role === 'owner' || role === 'admin' || role === 'editor'
}

export function canOpenSeo(role: Role, grantSeoOpen: boolean): boolean {
  if (role === 'owner' || role === 'admin') return true
  if (role === 'editor' && grantSeoOpen) return true
  return false
}
