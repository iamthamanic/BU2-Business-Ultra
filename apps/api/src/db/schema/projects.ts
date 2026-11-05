/**
 * Drizzle schema — projects ownership tables.
 * Location: apps/api/src/db/schema/projects.ts
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

import { businesses, users } from './identity.js'
import { customers } from './crm.js'

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 16 }).notNull().default('custom'),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description').notNull().default(''),
  area: varchar('area', { length: 120 }),
  ownerUserId: uuid('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
  memberUserIds: jsonb('member_user_ids').$type<string[]>().notNull().default([]),
  status: varchar('status', { length: 24 }).notNull().default('planned'),
  startAt: timestamp('start_at', { withTimezone: true }),
  dueAt: timestamp('due_at', { withTimezone: true }),
  parentAreaProjectId: uuid('parent_area_project_id'),
  boardLaneOrder: jsonb('board_lane_order').$type<string[] | null>().default(null),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Tasks — project_id null = inbox; optional customer link. */
export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 300 }).notNull(),
  description: text('description').notNull().default(''),
  status: varchar('status', { length: 24 }).notNull().default('open'),
  priority: varchar('priority', { length: 16 }).notNull().default('medium'),
  assigneeUserId: uuid('assignee_user_id').references(() => users.id, { onDelete: 'set null' }),
  dueAt: timestamp('due_at', { withTimezone: true }),
  sortOrder: integer('sort_order').notNull().default(0),
  version: integer('version').notNull().default(1),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const taskComments = pgTable('task_comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id')
    .notNull()
    .references(() => tasks.id, { onDelete: 'cascade' }),
  authorUserId: uuid('author_user_id').references(() => users.id, { onDelete: 'set null' }),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const taskChecklistItems = pgTable('task_checklist_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id')
    .notNull()
    .references(() => tasks.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 300 }).notNull(),
  done: boolean('done').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const projectEvents = pgTable('project_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 64 }).notNull(),
  summary: text('summary').notNull().default(''),
  actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const taskAttachments = pgTable('task_attachments', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id')
    .notNull()
    .references(() => tasks.id, { onDelete: 'cascade' }),
  filename: varchar('filename', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 120 }).notNull(),
  sizeBytes: integer('size_bytes').notNull().default(0),
  storagePath: text('storage_path').notNull(),
  createdByUserId: uuid('created_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const recurrenceRules = pgTable('recurrence_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 300 }).notNull(),
  description: text('description').notNull().default(''),
  priority: varchar('priority', { length: 16 }).notNull().default('medium'),
  assigneeUserId: uuid('assignee_user_id').references(() => users.id, { onDelete: 'set null' }),
  freq: varchar('freq', { length: 16 }).notNull().default('weekly'),
  weekday: integer('weekday'),
  monthDay: integer('month_day'),
  timezone: varchar('timezone', { length: 64 }).notNull().default('Europe/Berlin'),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull().defaultNow(),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  pausedAt: timestamp('paused_at', { withTimezone: true }),
  nextAt: timestamp('next_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const taskOccurrences = pgTable(
  'task_occurrences',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ruleId: uuid('rule_id')
      .notNull()
      .references(() => recurrenceRules.id, { onDelete: 'cascade' }),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('task_occurrences_rule_scheduled_uidx').on(t.ruleId, t.scheduledFor)],
)

/** Per-surface data source (Metricool brand vs Direct API). */
