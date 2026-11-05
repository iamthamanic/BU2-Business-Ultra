/**
 * Projects domain service — mappers, access checks, loaders, recurrence materialization, stats.
 * Location: apps/api/src/modules/projects/service.ts
 */
import { and, asc, eq, inArray, isNull, lte } from 'drizzle-orm'
import { canAccessProjectTeam, type Role } from '@bu2/shared'
import { db } from '../../db/client.js'
import {
  projectEvents,
  projects,
  recurrenceRules,
  taskAttachments,
  taskOccurrences,
  tasks,
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
  role: Role,
): boolean {
  return canAccessProjectTeam(role, userId, {
    ownerUserId: row.ownerUserId,
    memberUserIds: Array.isArray(row.memberUserIds) ? row.memberUserIds : [],
  })
}

export async function assertTaskProjectAccess(
  businessId: string,
  projectId: string | null,
  userId: string,
  role: Role,
): Promise<boolean> {
  if (!projectId) return true
  const p = await loadProject(businessId, projectId)
  if (!p) return false
  return assertProjectAccess(p, userId, role)
}

export function toAttachment(row: typeof taskAttachments.$inferSelect, businessId: string) {
  return {
    id: row.id,
    taskId: row.taskId,
    filename: row.filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    url: `/uploads/${businessId}/tasks/${row.taskId}/${row.filename}`,
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

export function toTask(row: typeof tasks.$inferSelect) {
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
    sortOrder: row.sortOrder,
    version: row.version,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
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
    nextAt: row.nextAt,
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

export function advanceNext(from: Date, freq: string, weekday: number | null, monthDay: number | null): Date {
  const d = new Date(from)
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
          })
          .returning()
        await db.insert(taskOccurrences).values({
          ruleId: rule.id,
          scheduledFor,
          taskId: task!.id,
        })
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
      .set({ nextAt: next, updatedAt: new Date() })
      .where(eq(recurrenceRules.id, rule.id))
  }
  return { created, scanned: rules.length }
}

export async function taskStatsForProjects(businessId: string, projectIds: string[]) {
  if (!projectIds.length) return new Map<string, { total: number; done: number; open: number; overdue: number }>()
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

