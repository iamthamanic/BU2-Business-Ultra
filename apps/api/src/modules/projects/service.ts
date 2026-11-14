/**
 * Projects domain service — mappers, access checks, loaders, recurrence materialization, stats.
 * Location: apps/api/src/modules/projects/service.ts
 */
import { and, asc, desc, eq, inArray, isNull, lte } from 'drizzle-orm'
import { canAccessProjectTeam, type MembershipAuthz } from '@bu2/shared'
import { db } from '../../db/client.js'
import {
  projectEvents,
  projects,
  recurrenceRules,
  taskAttachments,
  taskChecklistItems,
  taskComments,
  taskOccurrences,
  tasks,
  users,
} from '../../db/schema.js'

export const ATTACH_MAX_BYTES = 10 * 1024 * 1024
export const ATTACH_ALLOWED = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

export const LOOKAHEAD_MS = 7 * 24 * 60 * 60 * 1000
export const TICK_CAP = 50

export function toProject(row: typeof projects.$inferSelect) {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    description: row.description,
    area: row.area,
    ownerUserId: row.ownerUserId,
    memberUserIds: Array.isArray(row.memberUserIds) ? row.memberUserIds : [],
    status: row.status,
    startAt: row.startAt,
    dueAt: row.dueAt,
    parentAreaProjectId: row.parentAreaProjectId,
    boardLaneOrder: row.boardLaneOrder ?? null,
    archivedAt: row.archivedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function assertProjectAccess(
  row: typeof projects.$inferSelect,
  userId: string,
  membership: MembershipAuthz,
): boolean {
  return canAccessProjectTeam(membership, userId, {
    ownerUserId: row.ownerUserId,
    memberUserIds: Array.isArray(row.memberUserIds) ? row.memberUserIds : [],
  })
}

export async function assertTaskProjectAccess(
  businessId: string,
  projectId: string | null,
  userId: string,
  membership: MembershipAuthz,
): Promise<boolean> {
  if (!projectId) return true
  const p = await loadProject(businessId, projectId)
  if (!p) return false
  return assertProjectAccess(p, userId, membership)
}

export function toAttachment(row: typeof taskAttachments.$inferSelect, businessId: string) {
  const folder = row.taskId
    ? `tasks/${row.taskId}`
    : row.ruleId
      ? `rules/${row.ruleId}`
      : 'orphan'
  return {
    id: row.id,
    taskId: row.taskId,
    ruleId: row.ruleId ?? null,
    filename: row.filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    url: `/uploads/${businessId}/${folder}/${row.filename}`,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
  }
}

export async function addProjectEvent(
  projectId: string | null | undefined,
  type: string,
  summary: string,
  actorUserId: string | null,
  meta: Record<string, unknown> = {},
) {
  if (!projectId) return
  await db.insert(projectEvents).values({
    projectId,
    type,
    summary,
    actorUserId,
    meta,
  })
}

export function toTask(
  row: typeof tasks.$inferSelect,
  opts?: { mode?: 'once' | 'recurring' },
) {
  return {
    id: row.id,
    projectId: row.projectId,
    customerId: row.customerId,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assigneeUserId: row.assigneeUserId,
    dueAt: row.dueAt,
    reminders: Array.isArray(row.reminders) ? row.reminders : [],
    mode: opts?.mode ?? 'once',
    source: 'task' as const,
    sortOrder: row.sortOrder,
    version: row.version,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/** Period is closed until nextAt — show as done with reopen countdown. */
export function isPeriodDoneWaiting(row: typeof recurrenceRules.$inferSelect, now = new Date()) {
  return Boolean(
    row.lastCompletedAt && row.nextAt.getTime() > now.getTime() && !row.pausedAt,
  )
}

/** Present a recurrence rule as a task-like row for list/board UI. */
export function ruleAsTask(row: typeof recurrenceRules.$inferSelect, now = new Date()) {
  const waiting = isPeriodDoneWaiting(row, now)
  return {
    id: row.id,
    projectId: row.projectId,
    customerId: row.customerId,
    title: row.title,
    description: row.description,
    status: row.pausedAt ? 'blocked' : waiting ? 'done' : 'open',
    priority: row.priority,
    assigneeUserId: row.assigneeUserId,
    dueAt: row.nextAt,
    reminders: Array.isArray(row.reminders) ? row.reminders : [],
    mode: 'recurring' as const,
    source: 'rule' as const,
    freq: row.freq,
    weekday: row.weekday,
    monthDay: row.monthDay,
    /** ISO — when a completed period reopens (countdown target). */
    reopensAt: waiting ? row.nextAt.toISOString() : null,
    lastCompletedAt: row.lastCompletedAt ? row.lastCompletedAt.toISOString() : null,
    sortOrder: 0,
    version: 1,
    archivedAt: null as string | null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function statsFromMerged(
  merged: Array<{ status: string; dueAt: Date | string | null }>,
) {
  const now = Date.now()
  const s = { total: 0, done: 0, open: 0, overdue: 0 }
  for (const t of merged) {
    s.total++
    if (t.status === 'done') {
      s.done++
      continue
    }
    s.open++
    const due = t.dueAt ? new Date(t.dueAt).getTime() : NaN
    if (!Number.isNaN(due) && due < now) s.overdue++
  }
  return s
}

export async function occurrenceTaskIdSet(taskIds: string[]): Promise<Set<string>> {
  if (!taskIds.length) return new Set()
  const rows = await db
    .select({ taskId: taskOccurrences.taskId })
    .from(taskOccurrences)
    .where(inArray(taskOccurrences.taskId, taskIds))
  return new Set(rows.map((r) => r.taskId))
}

/** One-shot tasks (excluding materializations) + recurrence rules as recurring rows. */
export async function mergeTasksWithRules(
  taskRows: (typeof tasks.$inferSelect)[],
  ruleRows: (typeof recurrenceRules.$inferSelect)[],
) {
  const occIds = await occurrenceTaskIdSet(taskRows.map((r) => r.id))
  const once = taskRows
    .filter((r) => !occIds.has(r.id))
    .map((r) => toTask(r, { mode: 'once' }))
  const recurring = filterActiveRules(ruleRows).map((r) => ruleAsTask(r))
  return [...once, ...recurring]
}

export function toRule(row: typeof recurrenceRules.$inferSelect) {
  return {
    id: row.id,
    projectId: row.projectId,
    customerId: row.customerId,
    title: row.title,
    description: row.description,
    priority: row.priority,
    assigneeUserId: row.assigneeUserId,
    freq: row.freq,
    weekday: row.weekday,
    monthDay: row.monthDay,
    timezone: row.timezone,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    pausedAt: row.pausedAt,
    lastCompletedAt: row.lastCompletedAt,
    nextAt: row.nextAt,
    reminders: Array.isArray(row.reminders) ? row.reminders : [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function loadProject(businessId: string, id: string) {
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.businessId, businessId)))
    .limit(1)
  return rows[0] ?? null
}

export async function loadTask(businessId: string, id: string) {
  const rows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.businessId, businessId)))
    .limit(1)
  return rows[0] ?? null
}

export async function loadRule(businessId: string, id: string) {
  const rows = await db
    .select()
    .from(recurrenceRules)
    .where(and(eq(recurrenceRules.id, id), eq(recurrenceRules.businessId, businessId)))
    .limit(1)
  return rows[0] ?? null
}

export function isRuleActive(row: typeof recurrenceRules.$inferSelect, now = new Date()) {
  return !(row.endsAt && row.endsAt.getTime() <= now.getTime())
}

export function filterActiveRules(rows: (typeof recurrenceRules.$inferSelect)[]) {
  const now = new Date()
  return rows.filter((r) => isRuleActive(r, now))
}

export async function loadRuleSideContent(businessId: string, ruleId: string) {
  const [commentRows, checklist, attachments] = await Promise.all([
    db
      .select({
        id: taskComments.id,
        ruleId: taskComments.ruleId,
        authorUserId: taskComments.authorUserId,
        body: taskComments.body,
        createdAt: taskComments.createdAt,
        authorDisplayName: users.displayName,
        authorEmail: users.email,
      })
      .from(taskComments)
      .leftJoin(users, eq(users.id, taskComments.authorUserId))
      .where(eq(taskComments.ruleId, ruleId))
      .orderBy(asc(taskComments.createdAt)),
    db
      .select()
      .from(taskChecklistItems)
      .where(eq(taskChecklistItems.ruleId, ruleId))
      .orderBy(asc(taskChecklistItems.sortOrder)),
    db
      .select()
      .from(taskAttachments)
      .where(
        and(eq(taskAttachments.ruleId, ruleId), eq(taskAttachments.businessId, businessId)),
      )
      .orderBy(desc(taskAttachments.createdAt)),
  ])
  return {
    comments: commentRows.map((c) => ({
      id: c.id,
      ruleId: c.ruleId,
      authorUserId: c.authorUserId,
      body: c.body,
      createdAt: c.createdAt,
      authorDisplayName: c.authorDisplayName?.trim() || c.authorEmail || null,
    })),
    checklist,
    attachments: attachments.map((a) => toAttachment(a, businessId)),
  }
}

export async function copyRuleChecklistToTask(ruleId: string, taskId: string) {
  const items = await db
    .select()
    .from(taskChecklistItems)
    .where(eq(taskChecklistItems.ruleId, ruleId))
    .orderBy(asc(taskChecklistItems.sortOrder))
  if (!items.length) return
  await db.insert(taskChecklistItems).values(
    items.map((item) => ({
      taskId,
      title: item.title,
      done: false,
      sortOrder: item.sortOrder,
    })),
  )
}

export function advanceNext(
  from: Date,
  freq: string,
  weekday: number | null,
  monthDay: number | null,
): Date {
  const d = new Date(from)
  if (freq === 'hourly') {
    d.setUTCHours(d.getUTCHours() + 1)
    return d
  }
  if (freq === 'daily') {
    d.setUTCDate(d.getUTCDate() + 1)
    return d
  }
  if (freq === 'weekly') {
    d.setUTCDate(d.getUTCDate() + 1)
    if (weekday != null) {
      let guard = 0
      while (d.getUTCDay() !== weekday && guard < 8) {
        d.setUTCDate(d.getUTCDate() + 1)
        guard++
      }
    } else {
      d.setUTCDate(d.getUTCDate() + 6)
    }
    return d
  }
  if (freq === 'yearly') {
    d.setUTCFullYear(d.getUTCFullYear() + 1)
    if (monthDay != null) {
      const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
      d.setUTCDate(Math.min(monthDay, last))
    }
    return d
  }
  // monthly
  d.setUTCMonth(d.getUTCMonth() + 1)
  if (monthDay != null) {
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
    d.setUTCDate(Math.min(monthDay, last))
  }
  return d
}

export async function materializeDueRules(businessId: string, now = new Date()) {
  const horizon = new Date(now.getTime() + LOOKAHEAD_MS)
  const rules = await db
    .select()
    .from(recurrenceRules)
    .where(
      and(
        eq(recurrenceRules.businessId, businessId),
        isNull(recurrenceRules.pausedAt),
        lte(recurrenceRules.nextAt, horizon),
      ),
    )
    .orderBy(asc(recurrenceRules.nextAt))
    .limit(TICK_CAP)

  let created = 0
  for (const rule of rules) {
    if (rule.endsAt && rule.endsAt < now) continue
    // Period closed until nextAt — keep done+countdown; don't pre-create the next slot.
    if (isPeriodDoneWaiting(rule, now)) continue
    if (rule.projectId) {
      const proj = await loadProject(businessId, rule.projectId)
      if (!proj || proj.archivedAt) continue
    }
    let next = new Date(rule.nextAt)
    let safety = 0
    while (next <= horizon && safety < 14) {
      if (rule.endsAt && next > rule.endsAt) break
      const scheduledFor = new Date(next)
      try {
        const [task] = await db
          .insert(tasks)
          .values({
            businessId,
            projectId: rule.projectId,
            customerId: rule.customerId,
            title: rule.title,
            description: rule.description,
            priority: rule.priority,
            assigneeUserId: rule.assigneeUserId,
            status: 'open',
            dueAt: scheduledFor,
            reminders: Array.isArray(rule.reminders) ? rule.reminders : [],
          })
          .returning()
        await db.insert(taskOccurrences).values({
          ruleId: rule.id,
          scheduledFor,
          taskId: task!.id,
        })
        await copyRuleChecklistToTask(rule.id, task!.id)
        created++
      } catch (err) {
        // Unique (rule_id, scheduled_for) → already materialized; continue
        const msg = String((err as Error)?.message || err)
        if (!/unique|duplicate/i.test(msg)) throw err
      }
      next = advanceNext(next, rule.freq, rule.weekday, rule.monthDay)
      safety++
    }
    await db
      .update(recurrenceRules)
      .set({
        nextAt: next,
        lastCompletedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(recurrenceRules.id, rule.id))
  }
  return { created, scanned: rules.length }
}

export async function taskStatsForProjects(businessId: string, projectIds: string[]) {
  if (!projectIds.length) {
    return new Map<string, { total: number; done: number; open: number; overdue: number }>()
  }
  const rows = await db
    .select({
      projectId: tasks.projectId,
      status: tasks.status,
      dueAt: tasks.dueAt,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.businessId, businessId),
        isNull(tasks.archivedAt),
        inArray(tasks.projectId, projectIds),
      ),
    )
  const map = new Map<string, { total: number; done: number; open: number; overdue: number }>()
  const now = Date.now()
  for (const id of projectIds) map.set(id, { total: 0, done: 0, open: 0, overdue: 0 })
  for (const r of rows) {
    if (!r.projectId || !map.has(r.projectId)) continue
    const s = map.get(r.projectId)!
    s.total++
    if (r.status === 'done') s.done++
    else {
      s.open++
      if (r.dueAt && r.dueAt.getTime() < now) s.overdue++
    }
  }
  return map
}
