/**
 * Drizzle schema — identity ownership tables.
 * Location: apps/api/src/db/schema/identity.ts
 */
import {
  boolean,
  date,
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

