/**
 * Drizzle schema — identity, memberships, platform grants, permission bundles.
 * Location: apps/api/src/db/schema/identity.ts
 */
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

/** BU2 user profile — id aligned with Better Auth `user.id`. */
export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  displayName: varchar('display_name', { length: 160 }),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  /** Retained for breakglass infra flags — never grants company content. */
  isSuperadmin: boolean('is_superadmin').notNull().default(false),
  isBreakglassOperator: boolean('is_breakglass_operator').notNull().default(false),
  locale: varchar('locale', { length: 8 }).notNull().default('de'),
  status: varchar('status', { length: 16 }).notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
})

/** Better Auth core tables (official column names). */
export const baUser = pgTable('user', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const baSession = pgTable('session', {
  id: uuid('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: uuid('user_id')
    .notNull()
    .references(() => baUser.id, { onDelete: 'cascade' }),
})

export const baAccount = pgTable('account', {
  id: uuid('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: uuid('user_id')
    .notNull()
    .references(() => baUser.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const baVerification = pgTable('verification', {
  id: uuid('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const businesses = pgTable(
  'businesses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 120 }).notNull(),
    slug: varchar('slug', { length: 64 }).notNull(),
    status: varchar('status', { length: 16 }).notNull().default('active'),
    logoPath: text('logo_path'),
    styleguide: jsonb('styleguide').$type<Record<string, unknown>>().notNull().default({}),
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
    isOwner: boolean('is_owner').notNull().default(false),
    status: varchar('status', { length: 16 }).notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('memberships_business_user_uidx').on(t.businessId, t.userId)],
)

export const platformGrants = pgTable(
  'platform_grants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    capabilityKey: varchar('capability_key', { length: 100 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
  },
  (t) => [uniqueIndex('platform_grants_user_cap_uidx').on(t.userId, t.capabilityKey)],
)

export const permissionBundles = pgTable(
  'permission_bundles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 64 }),
    name: varchar('name', { length: 120 }).notNull(),
    description: varchar('description', { length: 500 }),
    isSystem: boolean('is_system').notNull().default(false),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('permission_bundles_biz_key_uidx').on(t.businessId, t.key)],
)

export const bundlePermissions = pgTable(
  'bundle_permissions',
  {
    bundleId: uuid('bundle_id')
      .notNull()
      .references(() => permissionBundles.id, { onDelete: 'cascade' }),
    permissionKey: varchar('permission_key', { length: 160 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.bundleId, t.permissionKey] })],
)

export const membershipBundles = pgTable(
  'membership_bundles',
  {
    membershipId: uuid('membership_id')
      .notNull()
      .references(() => memberships.id, { onDelete: 'cascade' }),
    bundleId: uuid('bundle_id')
      .notNull()
      .references(() => permissionBundles.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.membershipId, t.bundleId] })],
)

export const invites = pgTable('invites', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 320 }).notNull(),
  bundleIds: jsonb('bundle_ids').$type<string[]>().notNull().default([]),
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
