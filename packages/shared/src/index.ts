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
  // Local/dev: min 4 (e.g. 1234). Raise for production.
  password: z.string().min(4).max(200),
})

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200).optional(),
  newPassword: z.string().min(4).max(200),
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

export const ProductCostDeptSchema = z.enum([
  'marketing',
  'sales',
  'operations',
  'support',
  'overhead',
])

export const ProductCostPositionSchema = z.object({
  id: z.string().min(1).max(80),
  dept: ProductCostDeptSchema,
  label: z.string().min(1).max(200),
  amountCents: z.number().int().nonnegative().default(0),
  enabled: z.boolean().default(true),
  note: z.string().max(400).optional(),
})

export const ProductJourneyMapSchema = z.object({
  phases: z
    .array(
      z.object({
        id: z.string(),
        title: z.string().max(80),
        lifecycle: z.enum([
          'awareness',
          'consideration',
          'conversion',
          'delivery',
          'advocacy',
        ]),
      }),
    )
    .default([]),
  items: z.record(z.array(z.string().max(200))).default({}),
})

export const ProductJourneyCanvasSchema = z.object({
  nodes: z
    .array(
      z.object({
        id: z.string(),
        kind: z.enum(['product', 'persona', 'stage']).default('persona'),
        label: z.string().max(200),
        x: z.number(),
        y: z.number(),
        refId: z.string().optional(),
      }),
    )
    .default([]),
  edges: z
    .array(
      z.object({
        id: z.string(),
        source: z.string(),
        target: z.string(),
      }),
    )
    .default([]),
  map: ProductJourneyMapSchema.optional(),
})

export const ProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(4000),
  market: z.enum(['b2b', 'b2c']),
  coverPath: z.string().max(500).nullable().optional(),
  currency: z.string().length(3).default('EUR'),
  sellingPriceCents: z.number().int().nonnegative().default(0),
  priceKind: z.enum(['gross', 'net']).default('gross'),
  taxRateBps: z.number().int().min(0).max(10000).default(1900),
  costPositions: z.array(ProductCostPositionSchema).default([]),
  personaIds: z.array(z.string().uuid()).default([]),
  personaDraft: z.record(z.unknown()).default({}),
  journeyCanvas: ProductJourneyCanvasSchema.default({ nodes: [], edges: [] }),
})

export const ProductPatchSchema = ProductSchema.partial()

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

/** Structured postal / billing address for CRM customers. */
export const CustomerAddressSchema = z.object({
  street: z.string().max(200).nullable().optional(),
  postalCode: z.string().max(32).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  country: z.string().max(120).nullable().optional(),
})

/** CRM customer create/update. */
export const CustomerSchema = z.object({
  kind: z.enum(['person', 'org']).default('person'),
  displayName: z.string().min(1).max(200),
  email: z.string().email().max(320).nullable().optional(),
  phone: z.string().max(64).nullable().optional(),
  /** @deprecated Prefer street/postalCode/city/country — kept for legacy payloads. */
  address: z.string().max(2000).nullable().optional(),
  street: z.string().max(200).nullable().optional(),
  postalCode: z.string().max(32).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  country: z.string().max(120).nullable().optional(),
  billingStreet: z.string().max(200).nullable().optional(),
  billingPostalCode: z.string().max(32).nullable().optional(),
  billingCity: z.string().max(120).nullable().optional(),
  billingCountry: z.string().max(120).nullable().optional(),
  relationStatus: z.enum(['lead', 'prospect', 'customer']).default('lead'),
  /** ISO date YYYY-MM-DD */
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  photoUrl: z.string().max(2000).nullable().optional(),
  buyerPersonaId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string().max(40)).max(40).default([]),
})
export const CustomerPatchSchema = CustomerSchema.partial()

export const BusinessLabelScopeSchema = z.enum([
  'customer',
  'project',
  'marketing',
  'product',
])
export type BusinessLabelScope = z.infer<typeof BusinessLabelScopeSchema>

export const BusinessLabelSchema = z.object({
  scope: BusinessLabelScopeSchema.default('customer'),
  name: z.string().trim().min(1).max(40),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullable()
    .optional(),
})
export const BusinessLabelPatchSchema = BusinessLabelSchema.omit({ scope: true }).partial()
/** @deprecated use BusinessLabelSchema */
export const BusinessTagSchema = BusinessLabelSchema
/** @deprecated use BusinessLabelPatchSchema */
export const BusinessTagPatchSchema = BusinessLabelPatchSchema

export const CustomerStatsPatchSchema = z.object({
  buyerPersonaId: z.string().uuid().nullable().optional(),
})

export const CustomerPurchaseSchema = z
  .object({
    label: z.string().max(200).default(''),
    amountCents: z.number().int().min(0).max(1_000_000_000),
    currency: z.string().length(3).default('EUR'),
    productId: z.string().uuid().nullable().optional(),
    purchasedAt: z.string().datetime().optional(),
  })
  .refine((v) => Boolean(v.label.trim()) || Boolean(v.productId), {
    message: 'label_or_product_required',
  })

export const CustomerNoteSchema = z.object({
  body: z.string().min(1).max(8000),
})
export const CustomerNotePatchSchema = CustomerNoteSchema.partial()

export const CustomerConsentSchema = z.object({
  purpose: z.string().min(1).max(120),
  channel: z.enum(['email', 'phone', 'whatsapp', 'post', 'other']).default('email'),
  granted: z.boolean().default(true),
  evidence: z.string().max(2000).nullable().optional(),
})

export const CustomerCommLogSchema = z.object({
  channel: z.enum(['email', 'phone', 'whatsapp', 'meeting', 'other']),
  summary: z.string().min(1).max(2000),
  note: z.string().max(8000).optional(),
})

export const BoardLaneOrderSchema = z
  .array(z.enum(['open', 'in_progress', 'blocked', 'done']))
  .min(1)
  .max(8)

export const ProjectSchema = z.object({
  type: z.enum(['area', 'custom']).default('custom'),
  name: z.string().min(1).max(200),
  description: z.string().max(4000).default(''),
  area: z.string().max(120).nullable().optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
  memberUserIds: z.array(z.string().uuid()).max(40).optional(),
  status: z.enum(['planned', 'active', 'done']).default('planned'),
  startAt: z.string().datetime().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  parentAreaProjectId: z.string().uuid().nullable().optional(),
  boardLaneOrder: BoardLaneOrderSchema.nullable().optional(),
})
export const ProjectPatchSchema = ProjectSchema.partial()

/** Team-only project access: owner/admin always; else ownerUserId or memberUserIds. */
export function canAccessProjectTeam(
  role: Role,
  userId: string,
  project: { ownerUserId?: string | null; memberUserIds?: string[] | null },
): boolean {
  if (role === 'owner' || role === 'admin') return true
  if (project.ownerUserId === userId) return true
  const members = Array.isArray(project.memberUserIds) ? project.memberUserIds : []
  return members.includes(userId)
}

export const TaskSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(8000).default(''),
  projectId: z.string().uuid().nullable().optional(),
  customerId: z.string().uuid().nullable().optional(),
  status: z.enum(['open', 'in_progress', 'blocked', 'done']).default('open'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  assigneeUserId: z.string().uuid().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  sortOrder: z.number().int().default(0),
})
export const TaskPatchSchema = TaskSchema.partial().extend({
  version: z.number().int().positive().optional(),
})
export const TaskStatusSchema = z.object({
  status: z.enum(['open', 'in_progress', 'blocked', 'done']),
  version: z.number().int().positive().optional(),
  sortOrder: z.number().int().optional(),
})

export const TaskCommentSchema = z.object({
  body: z.string().min(1).max(4000),
})

export const TaskChecklistItemSchema = z.object({
  title: z.string().min(1).max(300),
  done: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
})

export const RecurrenceRuleSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(4000).default(''),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  projectId: z.string().uuid().nullable().optional(),
  customerId: z.string().uuid().nullable().optional(),
  assigneeUserId: z.string().uuid().nullable().optional(),
  freq: z.enum(['daily', 'weekly', 'monthly']).default('weekly'),
  weekday: z.number().int().min(0).max(6).nullable().optional(),
  monthDay: z.number().int().min(1).max(31).nullable().optional(),
  timezone: z.string().max(64).default('Europe/Berlin'),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().nullable().optional(),
})
export const RecurrenceRulePatchSchema = RecurrenceRuleSchema.partial().extend({
  paused: z.boolean().optional(),
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

/**
 * Legacy `ME.tabs`-style nav keys (match shell `data-ic` / channel ids).
 * Marketing Hub uses `overview` (or `home`); SEO/GEO under Marketing department.
 * `null` from resolveEntitledTabs = unrestricted (owner/admin).
 */
export const NAV_TAB_KEYS = [
  'home',
  'catalog',
  'overview',
  'product',
  'customer',
  'projects',
  'instagram',
  'facebook',
  'tiktok',
  'linkedin',
  'youtube',
  'google_ads',
  'meta_ads',
  'tiktok_ads',
  'linkedin_ads',
  'chatgpt_ads',
  'microsoft_ads',
  'email',
  'offline',
  'cmb',
  'sortanize',
  'personas',
  'checkmap',
  'seo',
  'geo',
  'settings',
] as const
export type NavTabKey = (typeof NAV_TAB_KEYS)[number]

/** Stub member entitlements until agency rights are stored on memberships. */
export const STUB_MEMBER_NAV_TABS: NavTabKey[] = [
  'home',
  'catalog',
  'overview',
  'product',
  'customer',
  'projects',
  'instagram',
  'facebook',
  'tiktok',
  'linkedin',
  'youtube',
  'google_ads',
  'meta_ads',
  'tiktok_ads',
  'linkedin_ads',
  'chatgpt_ads',
  'microsoft_ads',
  'email',
  'offline',
  'cmb',
  'sortanize',
  'personas',
  'checkmap',
  // seo/geo gated separately via grantSeoOpen; settings owner/admin only in shell
]

/**
 * Resolve nav tabs for a membership role.
 * - owner/admin → null (see all)
 * - editor/viewer → stub list (or explicit `stored` when agency rights land)
 */
export function resolveEntitledTabs(
  role: Role,
  stored?: string[] | null,
): string[] | null {
  if (role === 'owner' || role === 'admin') return null
  if (stored && stored.length) return stored
  return [...STUB_MEMBER_NAV_TABS]
}

export function canSeeNavTab(tabs: string[] | null | undefined, tabKey: string): boolean {
  if (tabs == null) return true
  return tabs.includes(tabKey)
}

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

/** Canonical funnel surfaces for company settings matrix (legacy parity). */
export type FunnelSurfaceDef = {
  key: string
  label: string
  group: 'Organic' | 'Paid'
  direct: string
  directProvider?: string
  directReady?: boolean
}

export const FUNNEL_SURFACES: FunnelSurfaceDef[] = [
  { key: 'organic.instagram', label: 'Instagram', group: 'Organic', direct: 'Meta Connector' },
  { key: 'organic.facebook', label: 'Facebook', group: 'Organic', direct: 'Meta Connector' },
  { key: 'organic.tiktok', label: 'TikTok', group: 'Organic', direct: 'TikTok Connector' },
  { key: 'organic.linkedin', label: 'LinkedIn', group: 'Organic', direct: 'LinkedIn Connector' },
  { key: 'organic.youtube', label: 'YouTube', group: 'Organic', direct: 'YouTube Connector' },
  { key: 'paid.google', label: 'Google Ads', group: 'Paid', direct: 'Google Ads Connector' },
  { key: 'paid.meta', label: 'Meta Ads', group: 'Paid', direct: 'Meta Ads Connector' },
  { key: 'paid.tiktok', label: 'TikTok Ads', group: 'Paid', direct: 'TikTok Ads Connector' },
  {
    key: 'paid.chatgpt',
    label: 'ChatGPT Ads',
    group: 'Paid',
    direct: 'ChatGPT Ads Connector',
    directProvider: 'chatgpt_ads',
    directReady: true,
  },
]

export type FunnelSurfaceKey = (typeof FUNNEL_SURFACES)[number]['key']

export const FunnelSurfaceKeySchema = z.enum([
  'organic.instagram',
  'organic.facebook',
  'organic.tiktok',
  'organic.linkedin',
  'organic.youtube',
  'paid.google',
  'paid.meta',
  'paid.tiktok',
  'paid.chatgpt',
])

export const FunnelBindingSchema = z.object({
  surface: FunnelSurfaceKeySchema,
  provider: z.string().min(1).max(40),
  status: z.enum(['active', 'disabled', 'unavailable']).default('active'),
  integrationId: z.string().uuid().nullable().optional(),
})

export const FunnelBindingsPutSchema = z.object({
  bindings: z.array(FunnelBindingSchema).max(FUNNEL_SURFACES.length),
})

/** Marketing brand styleguide document (per business). */
export const StyleguideColorSchema = z.object({
  id: z.string().min(1).max(40),
  hex: z
    .string()
    .regex(/^#[0-9a-fA-F]{3,8}$/, 'invalid_hex')
    .transform((v) => v.toLowerCase()),
  role: z.string().min(1).max(80),
  cmyk: z.string().max(48).optional().nullable(),
})

export const StyleguideDocSchema = z.object({
  version: z.literal(1).default(1),
  lede: z.string().max(600).optional().nullable(),
  heroMeta: z.string().max(160).optional().nullable(),
  companySub: z.string().max(160).optional().nullable(),
  companyBody1: z.string().max(2400).optional().nullable(),
  companyBody2: z.string().max(2400).optional().nullable(),
  logoSub: z.string().max(160).optional().nullable(),
  logoClearSpace: z.string().max(500).optional().nullable(),
  logoNoteDark: z.string().max(160).optional().nullable(),
  logoNoteLight: z.string().max(160).optional().nullable(),
  colorsSub: z.string().max(160).optional().nullable(),
  colors: z.array(StyleguideColorSchema).max(24).optional().nullable(),
  typeSub: z.string().max(160).optional().nullable(),
  typeDisplay: z.string().max(80).optional().nullable(),
  typeBody: z.string().max(80).optional().nullable(),
  typeMono: z.string().max(80).optional().nullable(),
  typeBodySample: z.string().max(500).optional().nullable(),
  surfacesSub: z.string().max(160).optional().nullable(),
  iconsSub: z.string().max(240).optional().nullable(),
  rulesSub: z.string().max(160).optional().nullable(),
  dos: z.array(z.string().max(240)).max(12).optional().nullable(),
  donts: z.array(z.string().max(240)).max(12).optional().nullable(),
})

export type StyleguideDoc = z.infer<typeof StyleguideDocSchema>
export type StyleguideColor = z.infer<typeof StyleguideColorSchema>

export const StyleguidePutSchema = StyleguideDocSchema
