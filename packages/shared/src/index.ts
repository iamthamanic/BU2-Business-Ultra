import { z } from 'zod'
import { type MembershipAuthz, hasPermission } from './permissions.js'

export {
  CUSTOMER_NUMBER_START,
  PARTNER_NUMBER_START,
  ORDER_NUMBER_START,
  formatCustomerNumber,
  formatPartnerNumber,
  formatOrderNumber,
} from './numbering.js'

export {
  PERMISSION_KEYS,
  type PermissionKey,
  PermissionKeySchema,
  type MembershipAuthz,
  hasPermission,
  hasAnyPermission,
  SYSTEM_BUNDLE_TEMPLATES,
  canManageMembers,
  canSendMail,
  canManageCredentials,
  canMutateContent,
  canOpenSeo,
  canUseTools,
  canManageTools,
  PLATFORM_CAPABILITIES,
  type PlatformCapability,
  BootstrapSetupSchema,
  type BootstrapSetupInput,
  InviteSchema,
  BundleCreateSchema,
  BundleUpdateSchema,
  MembershipBundlesAssignSchema,
} from './permissions.js'

export const LocaleSchema = z.enum(['de', 'en'])
export type Locale = z.infer<typeof LocaleSchema>

export const SecretProviderSchema = z.enum([
  'metricool',
  'brevo',
  'google_ads',
  'meta_ads',
  'tiktok_ads',
  'chatgpt_ads',
  'reddit_ads',
  'pinterest_ads',
  'microsoft_ads',
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

export const UpdateBusinessSchema = z.object({
  name: z.string().min(1).max(120),
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

/** Order template block types for Auftragsgestaltung. */
export const OrderTemplateBlockTypeSchema = z.enum(['text', 'heading', 'divider'])
export const OrderTemplateBlockSchema = z.object({
  id: z.string().min(1).max(64),
  type: OrderTemplateBlockTypeSchema,
  body: z.string().max(8000).default(''),
})
export type OrderTemplateBlock = z.infer<typeof OrderTemplateBlockSchema>

export const OrderTemplateSnapshotSchema = z.object({
  title: z.string().max(200),
  blocks: z.array(OrderTemplateBlockSchema).max(50),
})
export type OrderTemplateSnapshot = z.infer<typeof OrderTemplateSnapshotSchema>

export const OrderTemplatePutSchema = z.object({
  title: z.string().max(200),
  blocks: z.array(OrderTemplateBlockSchema).max(50),
})
export type OrderTemplatePutInput = z.infer<typeof OrderTemplatePutSchema>

export const OrderStatusSchema = z.enum(['draft', 'open', 'done'])
export type OrderStatus = z.infer<typeof OrderStatusSchema>

export const OrderCreateSchema = z.object({
  productId: z.string().uuid(),
  customerId: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  amountCents: z.number().int().nonnegative().optional(),
  notes: z.string().max(4000).nullable().optional(),
})
export type OrderCreateInput = z.infer<typeof OrderCreateSchema>

export const OrderPatchSchema = z.object({
  status: OrderStatusSchema.optional(),
  title: z.string().min(1).max(200).optional(),
  amountCents: z.number().int().nonnegative().optional(),
  notes: z.string().max(4000).nullable().optional(),
})
export type OrderPatchInput = z.infer<typeof OrderPatchSchema>

/** Template is ready to spawn orders: non-empty title + ≥1 block. */
export function isOrderTemplateReady(t: {
  title?: string | null
  blocks?: unknown
}): boolean {
  const title = (t.title || '').trim()
  const blocks = Array.isArray(t.blocks) ? t.blocks : []
  return title.length > 0 && blocks.length > 0
}

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

/** Product-style journey matrix (phases × lanes) — also accepted as legacy cell array. */
export const PersonaJourneyMapSchema = z.object({
  phases: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        title: z.string().min(1).max(120),
        lifecycle: z.enum([
          'awareness',
          'consideration',
          'conversion',
          'delivery',
          'advocacy',
        ]),
      }),
    )
    .optional(),
  items: z.record(z.array(z.string().max(200))).default({}),
})

export const PersonaSchema = z.object({
  name: z.string().min(1).max(120),
  summary: z.string().max(2000).optional(),
  goals: z.array(z.string()).default([]),
  pains: z.array(z.string()).default([]),
  channels: z.array(z.string()).default([]),
  journey: z
    .union([
      PersonaJourneyMapSchema,
      z.array(
        z.object({
          stage: z.enum(['aware', 'consider', 'decide', 'use', 'advocate']),
          lane: z.string(),
          note: z.string().max(1000).optional(),
        }),
      ),
    ])
    .default({ items: {} }),
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

/** Suggested partner categories (UI chips; free text still allowed). */
export const PARTNER_CATEGORY_SUGGESTIONS = [
  'Dienstleister',
  'Lieferant',
  'Subunternehmer',
  'Kooperationspartner',
  'Behörde',
  'Sonstige',
] as const

/** CRM contact fields (shared by create + patch). Table: contacts. */
const CustomerFieldsSchema = z.object({
  kind: z.enum(['person', 'org']).default('person'),
  displayName: z.string().max(200).optional(),
  firstName: z.string().max(100).nullable().optional(),
  lastName: z.string().max(100).nullable().optional(),
  orgCustomerId: z.string().uuid().nullable().optional(),
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
  /** Customer lifecycle — ignored for partner-only KPI filters. */
  relationStatus: z.enum(['lead', 'prospect', 'customer']).default('lead'),
  /** Dual roles — at least one required on create. Defaults preserve legacy customer create. */
  isCustomer: z.boolean().default(true),
  isPartner: z.boolean().default(false),
  partnerCategory: z.string().max(80).nullable().optional(),
  partnerStatus: z.enum(['active', 'inactive']).default('active'),
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

function refineContactName(
  v: {
    kind?: string
    displayName?: string | null
    firstName?: string | null
    lastName?: string | null
  },
  ctx: z.RefinementCtx,
) {
  const dn = (v.displayName || '').trim()
  const fn = (v.firstName || '').trim()
  const ln = (v.lastName || '').trim()
  if (v.kind === 'org') {
    if (!dn && !fn && !ln) {
      ctx.addIssue({ code: 'custom', message: 'displayName_required', path: ['displayName'] })
    }
    return
  }
  if (!dn && !fn && !ln) {
    ctx.addIssue({ code: 'custom', message: 'name_required', path: ['firstName'] })
  }
}

/** CRM contact create (legacy route name: customers). */
export const CustomerSchema = CustomerFieldsSchema.superRefine((v, ctx) => {
  refineContactName(v, ctx)
  if (!v.isCustomer && !v.isPartner) {
    ctx.addIssue({ code: 'custom', message: 'role_required', path: ['isCustomer'] })
  }
})
export type CustomerInput = z.infer<typeof CustomerSchema>
export const CustomerPatchSchema = CustomerFieldsSchema.partial().superRefine((v, ctx) => {
  if (v.isCustomer === false && v.isPartner === false) {
    ctx.addIssue({ code: 'custom', message: 'role_required', path: ['isCustomer'] })
  }
})
export type CustomerPatchInput = z.infer<typeof CustomerPatchSchema>

/** Alias — contacts are the SoR; API still speaks "customer" for compat. */
export const ContactSchema = CustomerSchema
export const ContactPatchSchema = CustomerPatchSchema
export type ContactInput = CustomerInput
export type ContactPatchInput = CustomerPatchInput

/** CRM contact row as returned by API. */
export const CustomerDtoSchema = CustomerFieldsSchema.extend({
  id: z.string().uuid(),
  customerNumber: z.number().int().nullable().optional(),
  customerNumberLabel: z.string().nullable().optional(),
  partnerNumber: z.number().int().nullable().optional(),
  partnerNumberLabel: z.string().nullable().optional(),
  isCustomer: z.boolean(),
  isPartner: z.boolean(),
  partnerCategory: z.string().nullable().optional(),
  partnerStatus: z.string(),
  displayName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  street: z.string().nullable(),
  postalCode: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  billingStreet: z.string().nullable(),
  billingPostalCode: z.string().nullable(),
  billingCity: z.string().nullable(),
  billingCountry: z.string().nullable(),
  relationStatus: z.string(),
  birthDate: z.string().nullable(),
  photoUrl: z.string().nullable(),
  buyerPersonaId: z.string().uuid().nullable(),
  tags: z.array(z.string()),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  kind: z.string(),
  orgCustomerId: z.string().uuid().nullable().optional(),
  orgCustomer: z
    .object({ id: z.string().uuid(), displayName: z.string() })
    .nullable()
    .optional(),
})
export type CustomerDto = z.infer<typeof CustomerDtoSchema>
export type ContactDto = CustomerDto

export const CustomerNoteDtoSchema = z.object({
  id: z.string().uuid(),
  body: z.string(),
  authorUserId: z.string().uuid().nullable(),
  authorDisplayName: z.string().nullable().optional(),
  parentNoteId: z.string().uuid().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
})
export type CustomerNoteDto = z.infer<typeof CustomerNoteDtoSchema>

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
  description: z.string().trim().max(500).optional().default(''),
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
  parentNoteId: z.string().uuid().nullable().optional(),
})
export const CustomerNotePatchSchema = z.object({
  body: z.string().min(1).max(8000).optional(),
})

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
export type ProjectInput = z.infer<typeof ProjectSchema>
export const ProjectPatchSchema = ProjectSchema.partial()
export type ProjectPatchInput = z.infer<typeof ProjectPatchSchema>

export const ProjectStatsDtoSchema = z.object({
  total: z.number().int(),
  done: z.number().int(),
  open: z.number().int(),
  overdue: z.number().int(),
})
export type ProjectStatsDto = z.infer<typeof ProjectStatsDtoSchema>

export const ProjectDtoSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  name: z.string(),
  description: z.string(),
  area: z.string().nullable(),
  ownerUserId: z.string().uuid().nullable(),
  memberUserIds: z.array(z.string().uuid()).optional(),
  status: z.string(),
  startAt: z.string().nullable(),
  dueAt: z.string().nullable(),
  parentAreaProjectId: z.string().uuid().nullable(),
  boardLaneOrder: z.array(z.string()).nullable(),
  archivedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  stats: ProjectStatsDtoSchema.optional(),
})
export type ProjectDto = z.infer<typeof ProjectDtoSchema>

/** Team-only project access: owner/admin always; else ownerUserId or memberUserIds. */
export function canAccessProjectTeam(
  membership: MembershipAuthz,
  userId: string,
  project: { ownerUserId?: string | null; memberUserIds?: string[] | null },
): boolean {
  if (membership.isOwner || hasPermission(membership, 'projects.write')) return true
  if (project.ownerUserId === userId) return true
  const members = Array.isArray(project.memberUserIds) ? project.memberUserIds : []
  return members.includes(userId)
}

/** Relative reminder before due / next occurrence (Google Calendar style). */
export const TaskReminderSchema = z.object({
  offsetValue: z.number().int().min(0).max(9999),
  offsetUnit: z.enum(['minutes', 'hours', 'days', 'weeks']),
  channel: z.enum(['notification', 'email']).default('notification'),
})
export type TaskReminder = z.infer<typeof TaskReminderSchema>

export const TaskRemindersSchema = z.array(TaskReminderSchema).max(20).default([])

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
  reminders: TaskRemindersSchema,
})
export type TaskInput = z.infer<typeof TaskSchema>
export const TaskPatchSchema = TaskSchema.partial().extend({
  version: z.number().int().positive().optional(),
})
export type TaskPatchInput = z.infer<typeof TaskPatchSchema>

export const TaskDtoSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid().nullable(),
  customerId: z.string().uuid().nullable(),
  title: z.string(),
  description: z.string(),
  status: z.string(),
  priority: z.string(),
  assigneeUserId: z.string().uuid().nullable(),
  dueAt: z.string().nullable(),
  reminders: z.array(TaskReminderSchema).optional(),
  mode: z.enum(['once', 'recurring']).optional(),
  source: z.enum(['task', 'rule']).optional(),
  freq: z.string().nullable().optional(),
  weekday: z.number().int().nullable().optional(),
  monthDay: z.number().int().nullable().optional(),
  reopensAt: z.string().nullable().optional(),
  lastCompletedAt: z.string().nullable().optional(),
  sortOrder: z.number().int(),
  version: z.number().int(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type TaskDto = z.infer<typeof TaskDtoSchema>
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

export const RecurrenceFreqSchema = z.enum(['hourly', 'daily', 'weekly', 'monthly', 'yearly'])
export type RecurrenceFreq = z.infer<typeof RecurrenceFreqSchema>

export const RecurrenceRuleSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(4000).default(''),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  projectId: z.string().uuid().nullable().optional(),
  customerId: z.string().uuid().nullable().optional(),
  assigneeUserId: z.string().uuid().nullable().optional(),
  freq: RecurrenceFreqSchema.default('weekly'),
  /** 0 = Sunday … 6 = Saturday (weekly). */
  weekday: z.number().int().min(0).max(6).nullable().optional(),
  /** Day of month 1–31 (monthly / yearly). */
  monthDay: z.number().int().min(1).max(31).nullable().optional(),
  timezone: z.string().max(64).default('Europe/Berlin'),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  reminders: TaskRemindersSchema,
})
export const RecurrenceRulePatchSchema = RecurrenceRuleSchema.partial().extend({
  paused: z.boolean().optional(),
  /** Next materialization / deadline for the series. */
  nextAt: z.string().datetime().optional(),
})

export const MODULE_KEYS = [
  'overview',
  'catalog',
  'marketing',
  'ads',
  'cmb',
  'personas',
  'sortanize',
  'tools',
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
  'finance',
  'inbox',
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
  'tools',
  'sortanize',
  'personas',
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
  'finance',
  'inbox',
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
  'tools',
  'personas',
  // seo/geo → seo.open; tools → tools.use / tools.manage; settings → settings.manage (bundles / owner)
]

/**
 * Resolve nav tabs for a membership.
 * - owner → null (see all)
 * - others → stub list (or explicit `stored` when agency rights land)
 */
export function resolveEntitledTabs(
  membership: MembershipAuthz,
  stored?: string[] | null,
): string[] | null {
  if (membership.isOwner) return null
  if (stored && stored.length) return stored
  return [...STUB_MEMBER_NAV_TABS]
}

export function canSeeNavTab(tabs: string[] | null | undefined, tabKey: string): boolean {
  if (tabs == null) return true
  return tabs.includes(tabKey)
}

/** BU2 resources that custom tools may request (visual scope matrix). */
export const TOOL_SCOPE_RESOURCES = [
  'customers',
  'projects',
  'inbox',
  'marketing',
  'products',
  'finance',
  'settings',
  'integrations',
] as const
export type ToolScopeResource = (typeof TOOL_SCOPE_RESOURCES)[number]

export const ToolScopeAccessSchema = z.object({
  read: z.boolean().optional(),
  write: z.boolean().optional(),
})

export const ToolScopesSchema = z.record(z.string(), ToolScopeAccessSchema)

export const ToolManifestIdSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

export const CreateToolInstallSchema = z.object({
  manifestId: ToolManifestIdSchema,
  name: z.string().min(1).max(120),
  entryUrl: z
    .string()
    .url()
    .refine((u) => u.startsWith('https://'), { message: 'entry_url_https_required' }),
  iconKey: z.string().min(1).max(40).optional(),
  scopes: ToolScopesSchema.default({}),
})
export type CreateToolInstallInput = z.infer<typeof CreateToolInstallSchema>

export const UpdateToolInstallSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  entryUrl: z
    .string()
    .url()
    .refine((u) => u.startsWith('https://'), { message: 'entry_url_https_required' })
    .optional(),
  iconKey: z.string().min(1).max(40).optional(),
  scopes: ToolScopesSchema.optional(),
})
export type UpdateToolInstallInput = z.infer<typeof UpdateToolInstallSchema>

export const ToolInstallDtoSchema = z.object({
  id: z.string().uuid(),
  manifestId: z.string(),
  name: z.string(),
  entryUrl: z.string(),
  iconKey: z.string(),
  scopes: ToolScopesSchema,
  kind: z.enum(['custom', 'system']),
  openMode: z.enum(['route', 'external']),
  openPath: z.string().nullable(),
})
export type ToolInstallDto = z.infer<typeof ToolInstallDtoSchema>

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
  {
    key: 'organic.tiktok',
    label: 'TikTok',
    group: 'Organic',
    direct: 'TikTok Connector',
    directProvider: 'tiktok',
    directReady: true,
  },
  {
    key: 'organic.linkedin',
    label: 'LinkedIn',
    group: 'Organic',
    direct: 'LinkedIn Connector',
    directProvider: 'linkedin',
    directReady: true,
  },
  {
    key: 'organic.youtube',
    label: 'YouTube',
    group: 'Organic',
    direct: 'YouTube Connector',
    directProvider: 'youtube',
    directReady: true,
  },
  {
    key: 'paid.google',
    label: 'Google Ads',
    group: 'Paid',
    direct: 'Google Ads Connector',
    directProvider: 'google_ads',
    directReady: true,
  },
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

/** Integration Core — provider catalog (code registry, not settings_secrets). */
export const IntegrationProviderSchema = z.enum([
  'mock',
  'google',
  'youtube',
  'google_ads',
  'meta_ads',
  'tiktok_ads',
  'chatgpt_ads',
  'reddit_ads',
  'pinterest_ads',
  'microsoft_ads',
  'microsoft',
  'imap',
  'whatsapp',
  'instagram',
  'facebook',
  /** @deprecated Prefer whatsapp / instagram / facebook in the connect UI. */
  'meta',
  'telegram',
  'unipile',
  /** Open-banking aggregator (DE) — credentials-first; sync later. */
  'finapi',
  /** Organic social — platform OAuth client in env (same model as Google/Meta). */
  'linkedin',
  'tiktok',
  'x',
  'pinterest',
])
export type IntegrationProvider = z.infer<typeof IntegrationProviderSchema>

export const ConnectionAuthMethodSchema = z.enum([
  'oauth_pkce',
  'bot_token',
  'api_key',
  'aggregator_session',
  'password',
  'mock',
])
export type ConnectionAuthMethod = z.infer<typeof ConnectionAuthMethodSchema>

export const ConnectionStatusSchema = z.enum([
  'pending',
  'active',
  'degraded',
  'revoked',
  'error',
])
export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>

/** BU2 modules that may bind a connection. */
export const IntegrationModuleSchema = z.enum([
  'inbox',
  'marketing',
  'ads',
  'crm',
  'projects',
  'calendar',
  'finance',
])
export type IntegrationModule = z.infer<typeof IntegrationModuleSchema>

export const BindingPurposeSchema = z.enum([
  'read_mail',
  'send_mail',
  'read_dm',
  'send_dm',
  'publish',
  'insights',
  'calendar_read',
  'calendar_write',
  'sync',
])
export type BindingPurpose = z.infer<typeof BindingPurposeSchema>

/** Structured capability — not a boolean map. */
export const CapabilityWindowSchema = z.object({
  kind: z.enum(['none', 'customer_care_hours', 'custom']),
  /** Hours after last inbound customer message (e.g. WhatsApp 24). */
  freeReplyHours: z.number().nonnegative().nullable().optional(),
  notes: z.string().max(500).optional(),
})

export const StructuredCapabilitySchema = z.object({
  operation: z.string().min(1).max(64),
  allowed: z.boolean(),
  reason: z.string().max(240).optional(),
  scopes: z.array(z.string().max(120)).max(40).default([]),
  accountType: z.string().max(80).optional(),
  messageFormats: z.array(z.string().max(40)).max(20).default([]),
  window: CapabilityWindowSchema.optional(),
  availability: z.enum(['available', 'degraded', 'unavailable']).default('available'),
})
export type StructuredCapability = z.infer<typeof StructuredCapabilitySchema>

export const ConnectMockSchema = z.object({
  provider: z.literal('mock').default('mock'),
  externalAccountId: z.string().min(1).max(160),
  displayName: z.string().min(1).max(160).optional(),
  /** Opaque mock credential — stored encrypted; never returned. */
  credential: z.string().min(4).max(500),
  accountType: z.string().max(80).optional(),
})
export type ConnectMockInput = z.infer<typeof ConnectMockSchema>

export const CreateModuleBindingSchema = z.object({
  connectionId: z.string().uuid(),
  module: IntegrationModuleSchema,
  purpose: BindingPurposeSchema,
  enabled: z.boolean().default(true),
})
export type CreateModuleBindingInput = z.infer<typeof CreateModuleBindingSchema>

/** UX: enable/disable all bindings for a connection × module (Inbox / CRM / Marketing tags). */
export const SetModuleBindingSchema = z.object({
  connectionId: z.string().uuid(),
  module: IntegrationModuleSchema,
  enabled: z.boolean(),
})
export type SetModuleBindingInput = z.infer<typeof SetModuleBindingSchema>

export const UpsertSyncCursorSchema = z.object({
  stream: z.string().min(1).max(80),
  cursor: z.string().max(4000),
})
export type UpsertSyncCursorInput = z.infer<typeof UpsertSyncCursorSchema>

export const ConnectTelegramSchema = z.object({
  /** Bot token from @BotFather — stored encrypted; never returned. */
  botToken: z.string().min(20).max(200),
  displayName: z.string().min(1).max(160).optional(),
})
export type ConnectTelegramInput = z.infer<typeof ConnectTelegramSchema>

export const ConnectImapSchema = z.object({
  host: z.string().min(1).max(200),
  port: z.number().int().min(1).max(65535).optional(),
  user: z.string().min(1).max(200),
  password: z.string().min(1).max(500),
  secure: z.boolean().default(true),
  protocol: z.enum(['imap', 'pop3']).default('imap'),
  displayName: z.string().min(1).max(160).optional(),
})
export type ConnectImapInput = z.infer<typeof ConnectImapSchema>

/**
 * finAPI connect — platform client id/secret come from env (`FINAPI_*`).
 * Body only carries optional display label; bank Web Form is the next slice.
 */
export const ConnectFinapiSchema = z.object({
  displayName: z.string().min(1).max(160).optional(),
})
export type ConnectFinapiInput = z.infer<typeof ConnectFinapiSchema>

export const OAuthProviderParamSchema = z.enum([
  'google',
  'youtube',
  'google_ads',
  'meta_ads',
  'microsoft',
  'microsoft_ads',
  'whatsapp',
  'instagram',
  'facebook',
  'linkedin',
  'tiktok',
  'tiktok_ads',
  'x',
  'pinterest',
  'pinterest_ads',
  'reddit_ads',
  'chatgpt_ads',
])
export type OAuthProviderParam = z.infer<typeof OAuthProviderParamSchema>

/**
 * @deprecated Paid ads use OAuth (`chatgpt_ads` / `reddit_ads` / `microsoft_ads`).
 * Kept for typecompat; route returns 410.
 */
export const ConnectAdsApiKeySchema = z.object({
  provider: z.enum(['chatgpt_ads', 'reddit_ads', 'microsoft_ads']),
  apiKey: z.string().min(8).max(2000),
  displayName: z.string().min(1).max(160).optional(),
})
export type ConnectAdsApiKeyInput = z.infer<typeof ConnectAdsApiKeySchema>

/** Link personal Telegram via Unipile (existing account_id or after QR finalize). */
export const LinkUnipileTelegramSchema = z.object({
  accountId: z.string().min(4).max(160),
  displayName: z.string().min(1).max(160).optional(),
})
export type LinkUnipileTelegramInput = z.infer<typeof LinkUnipileTelegramSchema>

export const FinalizeUnipileTelegramSchema = z.object({
  accountId: z.string().min(4).max(160),
  displayName: z.string().min(1).max(160).optional(),
})
export type FinalizeUnipileTelegramInput = z.infer<typeof FinalizeUnipileTelegramSchema>

export const InboxChannelSchema = z.enum([
  'telegram',
  'telegram_user',
  'email',
  'whatsapp',
  'instagram',
  'mock',
])
export type InboxChannel = z.infer<typeof InboxChannelSchema>

export const ConversationStatusSchema = z.enum(['open', 'closed'])
export type ConversationStatus = z.infer<typeof ConversationStatusSchema>

export const MessageDirectionSchema = z.enum(['inbound', 'outbound'])
export type MessageDirection = z.infer<typeof MessageDirectionSchema>

export const DeliveryStatusSchema = z.enum(['pending', 'sent', 'failed', 'received'])
export type DeliveryStatus = z.infer<typeof DeliveryStatusSchema>

/** Composer / capability messageFormats for inbox send. */
export const InboxMessageFormatSchema = z.enum([
  'text',
  'html',
  'image',
  'file',
  'audio',
  'voice',
])
export type InboxMessageFormat = z.infer<typeof InboxMessageFormatSchema>

/**
 * Provider defaults when capabilitiesCache is stale or incomplete.
 * Media send may still be 501 until the adapter wires it.
 */
export const INBOX_COMPOSER_FORMATS_BY_PROVIDER: Record<string, InboxMessageFormat[]> = {
  telegram: ['text', 'image', 'file', 'audio', 'voice'],
  unipile: ['text', 'image', 'file', 'audio', 'voice'],
  google: ['text', 'html', 'file'],
  microsoft: ['text', 'html', 'file'],
  imap: ['text', 'html', 'file'],
  whatsapp: ['text', 'image', 'file', 'audio', 'voice'],
  instagram: ['text', 'image'],
  facebook: ['text', 'image', 'file'],
  meta: ['text', 'image', 'file'],
}

export function inboxComposerFormatsForProvider(
  provider: string | null | undefined,
  cachedFormats?: string[] | null,
): InboxMessageFormat[] {
  const defaults = INBOX_COMPOSER_FORMATS_BY_PROVIDER[(provider || '').toLowerCase()] || ['text']
  const fromCache = (cachedFormats || []).filter((f): f is InboxMessageFormat =>
    InboxMessageFormatSchema.safeParse(f).success,
  )
  if (fromCache.length === 0) return [...defaults]
  const merged = new Set<InboxMessageFormat>([...fromCache, ...defaults])
  // Keep stable order from defaults, then extras
  const ordered: InboxMessageFormat[] = []
  for (const f of defaults) {
    if (merged.has(f)) ordered.push(f)
  }
  for (const f of fromCache) {
    if (!ordered.includes(f)) ordered.push(f)
  }
  return ordered
}

export const InboxReplyAttachmentSchema = z.object({
  format: z.enum(['image', 'file', 'audio', 'voice']),
  filename: z.string().min(1).max(200),
  /** data:<mime>;base64,… — max enforced in API route (~4 MiB decoded). */
  dataUrl: z.string().startsWith('data:').max(7_000_000),
})

export const InboxReplySchema = z
  .object({
    body: z.string().max(4000).default(''),
    attachment: InboxReplyAttachmentSchema.optional(),
  })
  .superRefine((val, ctx) => {
    if (!val.body.trim() && !val.attachment) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'body_or_attachment_required',
        path: ['body'],
      })
    }
  })
export type InboxReplyInput = z.infer<typeof InboxReplySchema>

/** Patch conversation assignee (null = unassign). */
export const InboxConversationPatchSchema = z.object({
  assigneeUserId: z.string().uuid().nullable(),
})
export type InboxConversationPatchInput = z.infer<typeof InboxConversationPatchSchema>

export const ContactIdentityKindSchema = z.enum([
  'telegram_user',
  'email',
  'phone',
  'instagram',
  'other',
])
export type ContactIdentityKind = z.infer<typeof ContactIdentityKindSchema>

/* ─── Finance SoR ───────────────────────────────────────────── */

export const FinanceTxKindSchema = z.enum(['income', 'expense'])
export type FinanceTxKind = z.infer<typeof FinanceTxKindSchema>

export const FinanceTxStatusSchema = z.enum(['paid', 'overdue', 'planned'])
export type FinanceTxStatus = z.infer<typeof FinanceTxStatusSchema>

/** UI-facing German status labels (snapshot contract). */
export const FinanceTxStatusLabelSchema = z.enum(['Bezahlt', 'Überfällig', 'Geplant'])
export type FinanceTxStatusLabel = z.infer<typeof FinanceTxStatusLabelSchema>

export const FinancePeriodSchema = z.enum(['current', 'prev', '90d'])
export type FinancePeriod = z.infer<typeof FinancePeriodSchema>

export const FinanceAccountCreateSchema = z.object({
  name: z.string().min(1).max(160),
  iban: z.string().min(15).max(34).optional().nullable(),
  bankName: z.string().min(1).max(120).optional().nullable(),
  currency: z.string().length(3).default('EUR'),
  balanceCents: z.number().int().default(0),
  connectionId: z.string().uuid().optional().nullable(),
  source: z.enum(['manual', 'finapi', 'demo', 'import']).default('manual'),
})
export type FinanceAccountCreateInput = z.infer<typeof FinanceAccountCreateSchema>

export const FinanceAccountPatchSchema = FinanceAccountCreateSchema.partial()
export type FinanceAccountPatchInput = z.infer<typeof FinanceAccountPatchSchema>

export const FinanceTransactionCreateSchema = z.object({
  accountId: z.string().uuid(),
  bookedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().min(1).max(200),
  description: z.string().max(4000).optional().default(''),
  category: z.string().min(1).max(80).default('Sonstiges'),
  projectLabel: z.string().max(160).optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  status: FinanceTxStatusSchema.default('paid'),
  kind: FinanceTxKindSchema,
  source: z.string().min(1).max(80).default('manual'),
  amountCents: z.number().int().nonnegative(),
  recurring: z.boolean().default(false),
  externalId: z.string().max(160).optional().nullable(),
})
export type FinanceTransactionCreateInput = z.infer<typeof FinanceTransactionCreateSchema>

export const FinanceTransactionPatchSchema = FinanceTransactionCreateSchema.partial().omit({
  accountId: true,
})
export type FinanceTransactionPatchInput = z.infer<typeof FinanceTransactionPatchSchema>

export const FinanceSettingsPatchSchema = z.object({
  taxReserveCents: z.number().int().nonnegative().optional(),
  opsBufferCurrentCents: z.number().int().nonnegative().optional(),
  opsBufferTargetCents: z.number().int().nonnegative().optional(),
})
export type FinanceSettingsPatchInput = z.infer<typeof FinanceSettingsPatchSchema>

export const FinanceAccountClientSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  iban: z.string().nullable(),
  bankName: z.string().nullable(),
  currency: z.string(),
  balanceCents: z.number().int(),
  connectionId: z.string().uuid().nullable(),
  source: z.string(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type FinanceAccountClient = z.infer<typeof FinanceAccountClientSchema>

export const FinanceTxClientSchema = z.object({
  id: z.string().uuid(),
  date: z.string(),
  name: z.string(),
  desc: z.string(),
  category: z.string(),
  project: z.string(),
  status: FinanceTxStatusLabelSchema,
  kind: FinanceTxKindSchema,
  source: z.string(),
  amount: z.number(),
  recurring: z.boolean(),
  accountId: z.string().uuid(),
  contactId: z.string().uuid().nullable(),
})
export type FinanceTxClient = z.infer<typeof FinanceTxClientSchema>

export const FinanceSnapshotSchema = z.object({
  freeAvailable: z.number().nullable(),
  balance: z.number().nullable(),
  obligations: z.number().nullable(),
  reserves: z.number().nullable(),
  liquidityOutlook: z.number().nullable(),
  reserveProgress: z
    .object({ current: z.number(), target: z.number() })
    .nullable(),
  nextPayment: z.string().nullable(),
  openIncoming: z.number().nullable(),
  revenue: z.number().nullable(),
  costs: z.number().nullable(),
  result: z.number().nullable(),
  revenueDeltaPct: z.number().nullable(),
  topCostShare: z.string().nullable(),
  alerts: z.array(
    z.object({
      id: z.string(),
      tone: z.enum(['red', 'warn', 'blue']),
      title: z.string(),
      detail: z.string(),
      go: z.enum(['transactions', 'analysis', 'settings']),
    }),
  ),
  transactions: z.array(FinanceTxClientSchema),
  recurring: z.array(
    z.object({
      name: z.string(),
      detail: z.string(),
      amount: z.number(),
    }),
  ),
  analysis: z.object({
    cost: z.array(z.number()),
    revenue: z.array(z.number()),
    result: z.array(z.number()),
    categories: z.array(
      z.object({
        name: z.string(),
        amount: z.number(),
        pct: z.number(),
        color: z.string(),
      }),
    ),
    marginPct: z.number().nullable(),
    topDriverPct: z.number().nullable(),
    topDriverName: z.string().nullable(),
  }),
  liquidityFlows: z.array(
    z.object({
      date: z.string(),
      title: z.string(),
      detail: z.string(),
      amount: z.number(),
    }),
  ),
  liquidityMinByHorizon: z.object({
    30: z.number().nullable(),
    60: z.number().nullable(),
    90: z.number().nullable(),
  }),
  taxReserve: z.number().nullable(),
  opsBuffer: z
    .object({ current: z.number(), target: z.number() })
    .nullable(),
  profitability: z.object({
    customers: z.array(z.tuple([z.string(), z.number(), z.number()])),
    products: z.array(z.tuple([z.string(), z.number(), z.number()])),
    projects: z.array(z.tuple([z.string(), z.number(), z.number()])),
    directCosts: z.number().nullable(),
    contribution: z.number().nullable(),
    breakEven: z.number().nullable(),
  }),
  planningBaseBalance: z.number(),
  planningMonthlyDrift: z.number(),
  accounts: z.array(FinanceAccountClientSchema),
  period: FinancePeriodSchema,
  hasData: z.boolean(),
})
export type FinanceSnapshot = z.infer<typeof FinanceSnapshotSchema>
