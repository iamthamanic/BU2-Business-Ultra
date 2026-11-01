import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  displayName: varchar('display_name', { length: 160 }),
  /** bcrypt hash; null until password is set (OTP/magic-link-only users) */
  passwordHash: text('password_hash'),
  isSuperadmin: boolean('is_superadmin').notNull().default(false),
  isBreakglassOperator: boolean('is_breakglass_operator').notNull().default(false),
  locale: varchar('locale', { length: 8 }).notNull().default('de'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
})

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
})

export const authChallenges = pgTable('auth_challenges', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 320 }).notNull(),
  tokenHash: text('token_hash').notNull(),
  otpHash: text('otp_hash'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const businesses = pgTable(
  'businesses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 120 }).notNull(),
    slug: varchar('slug', { length: 64 }).notNull(),
    status: varchar('status', { length: 16 }).notNull().default('active'),
    logoPath: text('logo_path'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('businesses_slug_uidx').on(t.slug)],
)

export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 16 }).notNull(),
    grantSeoOpen: boolean('grant_seo_open').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('memberships_business_user_uidx').on(t.businessId, t.userId)],
)

export const invites = pgTable('invites', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 320 }).notNull(),
  role: varchar('role', { length: 16 }).notNull(),
  tokenHash: text('token_hash').notNull(),
  invitedByUserId: uuid('invited_by_user_id').references(() => users.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Encrypted-at-rest provider secrets (ciphertext only). */
export const settingsSecrets = pgTable(
  'settings_secrets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 40 }).notNull(),
    ciphertext: text('ciphertext').notNull(),
    iv: text('iv').notNull(),
    tag: text('tag').notNull(),
    keyHint: varchar('key_hint', { length: 12 }),
    valid: boolean('valid').notNull().default(false),
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
    updatedByUserId: uuid('updated_by_user_id').references(() => users.id),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('settings_secrets_biz_provider_uidx').on(t.businessId, t.provider)],
)

export const auditLog = pgTable('audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id'),
  actorUserId: uuid('actor_user_id'),
  action: varchar('action', { length: 80 }).notNull(),
  resourceRef: varchar('resource_ref', { length: 200 }),
  status: varchar('status', { length: 40 }).notNull().default('ok'),
  meta: jsonb('meta').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const catalogProducts = pgTable('catalog_products', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  sku: varchar('sku', { length: 80 }),
  description: text('description'),
  currency: varchar('currency', { length: 3 }).notNull().default('EUR'),
  netPriceCents: integer('net_price_cents').notNull().default(0),
  taxRateBps: integer('tax_rate_bps').notNull().default(1900),
  active: boolean('active').notNull().default(true),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const socialDrafts = pgTable('social_drafts', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull(),
  masterText: text('master_text').notNull().default(''),
  variants: jsonb('variants').$type<unknown[]>().notNull().default([]),
  remoteStatus: jsonb('remote_status').$type<Record<string, unknown>>().default({}),
  createdByUserId: uuid('created_by_user_id').references(() => users.id),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const adsCampaigns = pgTable('ads_campaigns', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  provider: varchar('provider', { length: 40 }).notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  budgetDailyCents: integer('budget_daily_cents'),
  objective: varchar('objective', { length: 120 }),
  payload: jsonb('payload').$type<Record<string, unknown>>().default({}),
  remoteId: varchar('remote_id', { length: 120 }),
  status: varchar('status', { length: 40 }).notNull().default('draft'),
  createdByUserId: uuid('created_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const cmbModels = pgTable('cmb_models', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  model: jsonb('model').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const cmbSnapshots = pgTable('cmb_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  modelId: uuid('model_id')
    .notNull()
    .references(() => cmbModels.id, { onDelete: 'cascade' }),
  snapshot: jsonb('snapshot').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const checkmapBoards = pgTable('checkmap_boards', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull(),
  nodes: jsonb('nodes').$type<unknown[]>().notNull().default([]),
  edges: jsonb('edges').$type<unknown[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const checkmapAttachments = pgTable('checkmap_attachments', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  boardId: uuid('board_id')
    .notNull()
    .references(() => checkmapBoards.id, { onDelete: 'cascade' }),
  nodeId: varchar('node_id', { length: 80 }),
  filename: varchar('filename', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 120 }).notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  storagePath: text('storage_path').notNull(),
  createdByUserId: uuid('created_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const personas = pgTable('personas', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 120 }).notNull(),
  summary: text('summary'),
  goals: jsonb('goals').$type<string[]>().default([]),
  pains: jsonb('pains').$type<string[]>().default([]),
  channels: jsonb('channels').$type<string[]>().default([]),
  journey: jsonb('journey').$type<unknown[]>().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const openseoInstances = pgTable('openseo_instances', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' })
    .unique(),
  status: varchar('status', { length: 40 }).notNull().default('not_provisioned'),
  baseUrl: text('base_url'),
  provisionMeta: jsonb('provision_meta').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const openseoIdentities = pgTable(
  'openseo_identities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    openseoUserRef: varchar('openseo_user_ref', { length: 120 }).notNull(),
    roleMapped: varchar('role_mapped', { length: 40 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('openseo_identities_biz_user_uidx').on(t.businessId, t.userId)],
)

export const openseoHandoffs = pgTable('openseo_handoffs', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const brevoCampaigns = pgTable('brevo_campaigns', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  subject: varchar('subject', { length: 300 }),
  htmlContent: text('html_content'),
  status: varchar('status', { length: 40 }).notNull().default('draft'),
  remoteId: varchar('remote_id', { length: 120 }),
  createdByUserId: uuid('created_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Linked provider brands / projects (e.g. Metricool blogId). */
export const businessIntegrations = pgTable(
  'business_integrations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 40 }).notNull(),
    externalId: varchar('external_id', { length: 120 }).notNull(),
    label: varchar('label', { length: 160 }),
    config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('business_integrations_biz_provider_ext_uidx').on(
      t.businessId,
      t.provider,
      t.externalId,
    ),
  ],
)

/** Per-surface data source (Metricool brand vs Direct API). */
export const funnelBindings = pgTable(
  'funnel_bindings',
  {
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    surface: varchar('surface', { length: 80 }).notNull(),
    provider: varchar('provider', { length: 40 }).notNull().default('metricool'),
    integrationId: uuid('integration_id').references(() => businessIntegrations.id, {
      onDelete: 'set null',
    }),
    status: varchar('status', { length: 24 }).notNull().default('active'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.surface] })],
)
