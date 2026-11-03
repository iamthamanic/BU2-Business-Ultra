/**
 * Projects + Tasks + Recurrence API — area/custom projects, board, my-tasks, tick.
 * Location: apps/api/src/modules/projects/routes.ts
 */
import { createWriteStream } from 'node:fs'
import { mkdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { FastifyInstance } from 'fastify'
import { and, asc, desc, eq, ilike, inArray, isNotNull, isNull, lte, or } from 'drizzle-orm'
import {
  ProjectPatchSchema,
  ProjectSchema,
  RecurrenceRulePatchSchema,
  RecurrenceRuleSchema,
  TaskChecklistItemSchema,
  TaskCommentSchema,
  TaskPatchSchema,
  TaskSchema,
  TaskStatusSchema,
  canAccessProjectTeam,
  canMutateContent,
  type Role,
} from '@bu2/shared'
import { db } from '../../db/client.js'
import {
  memberships,
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
import { writeAudit } from '../../lib/audit.js'
import { randomToken } from '../../lib/crypto.js'
import { loadEnv } from '../../lib/env.js'
import { loadMembership, requireUser } from '../../plugins/auth.js'
import { ensureDefaultAreaProjectsIfEmpty } from './defaultAreas.js'

const ATTACH_MAX_BYTES = 10 * 1024 * 1024
const ATTACH_ALLOWED = [
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

const LOOKAHEAD_MS = 7 * 24 * 60 * 60 * 1000
const TICK_CAP = 50

function toProject(row: typeof projects.$inferSelect) {
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

function assertProjectAccess(
  row: typeof projects.$inferSelect,
  userId: string,
  role: Role,
): boolean {
  return canAccessProjectTeam(role, userId, {
    ownerUserId: row.ownerUserId,
    memberUserIds: Array.isArray(row.memberUserIds) ? row.memberUserIds : [],
  })
}

async function assertTaskProjectAccess(
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

function toAttachment(row: typeof taskAttachments.$inferSelect, businessId: string) {
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

async function addProjectEvent(
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

function toTask(row: typeof tasks.$inferSelect) {
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

function toRule(row: typeof recurrenceRules.$inferSelect) {
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

async function loadProject(businessId: string, id: string) {
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.businessId, businessId)))
    .limit(1)
  return rows[0] ?? null
}

async function loadTask(businessId: string, id: string) {
  const rows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.businessId, businessId)))
    .limit(1)
  return rows[0] ?? null
}

function advanceNext(from: Date, freq: string, weekday: number | null, monthDay: number | null): Date {
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

async function materializeDueRules(businessId: string, now = new Date()) {
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

async function taskStatsForProjects(businessId: string, projectIds: string[]) {
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

export async function projectRoutes(app: FastifyInstance) {
  app.get('/api/b/:slug/projects', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const q = (req.query as { archive?: string; q?: string; type?: string }) || {}
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    // Backfill Marketing/Kunden/Produkt once for empty companies; never re-seed after delete.
    await ensureDefaultAreaProjectsIfEmpty(m.businessId, user.id)
    const archived = q.archive === '1' || q.archive === 'true'
    const conds = [
      eq(projects.businessId, m.businessId),
      archived ? isNotNull(projects.archivedAt) : isNull(projects.archivedAt),
    ]
    if (q.type === 'area' || q.type === 'custom') conds.push(eq(projects.type, q.type))
    if (q.q?.trim()) conds.push(ilike(projects.name, `%${q.q.trim()}%`))
    const rows = (
      await db
        .select()
        .from(projects)
        .where(and(...conds))
        .orderBy(desc(projects.updatedAt))
    ).filter((r) => assertProjectAccess(r, user.id, m.role as Role))
    const stats = await taskStatsForProjects(
      m.businessId,
      rows.map((r) => r.id),
    )
    return {
      projects: rows.map((r) => ({
        ...toProject(r),
        stats: stats.get(r.id) ?? { total: 0, done: 0, open: 0, overdue: 0 },
      })),
    }
  })

  app.get('/api/b/:slug/projects/:id', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const row = await loadProject(m.businessId, id)
    if (!row) return reply.code(404).send({ error: 'not_found' })
    if (!assertProjectAccess(row, user.id, m.role as Role)) {
      return reply.code(404).send({ error: 'not_found' })
    }
    const taskRows = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.businessId, m.businessId),
          eq(tasks.projectId, id),
          isNull(tasks.archivedAt),
        ),
      )
      .orderBy(asc(tasks.sortOrder), desc(tasks.updatedAt))
    const stats = (await taskStatsForProjects(m.businessId, [id])).get(id)!
    return { project: { ...toProject(row), stats }, tasks: taskRows.map(toTask) }
  })

  app.post('/api/b/:slug/projects', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const body = ProjectSchema.parse(req.body)
    if (body.parentAreaProjectId) {
      const parent = await loadProject(m.businessId, body.parentAreaProjectId)
      if (!parent || parent.type !== 'area') {
        return reply.code(400).send({ error: 'invalid_parent_area' })
      }
    }
    const memberUserIds = [...new Set(body.memberUserIds || [])].filter(
      (id) => id !== (body.ownerUserId ?? user.id),
    )
    const [row] = await db
      .insert(projects)
      .values({
        businessId: m.businessId,
        type: body.type,
        name: body.name,
        description: body.description,
        area: body.area ?? null,
        ownerUserId: body.ownerUserId ?? user.id,
        memberUserIds,
        status: body.status,
        startAt: body.startAt ? new Date(body.startAt) : null,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        parentAreaProjectId: body.parentAreaProjectId ?? null,
      })
      .returning()
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'project.create',
      resourceRef: `project:${row!.id}`,
    })
    await addProjectEvent(row!.id, 'created', `Projekt angelegt: ${row!.name}`, user.id)
    return reply.code(201).send({ project: toProject(row!) })
  })

  app.patch('/api/b/:slug/projects/:id', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const existing = await loadProject(m.businessId, id)
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    if (!assertProjectAccess(existing, user.id, m.role as Role)) {
      return reply.code(404).send({ error: 'not_found' })
    }
    const body = ProjectPatchSchema.parse(req.body)
    const [row] = await db
      .update(projects)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.area !== undefined ? { area: body.area } : {}),
        ...(body.ownerUserId !== undefined ? { ownerUserId: body.ownerUserId } : {}),
        ...(body.memberUserIds !== undefined
          ? {
              memberUserIds: [...new Set(body.memberUserIds)].filter(
                (uid) => uid !== (body.ownerUserId !== undefined ? body.ownerUserId : existing.ownerUserId),
              ),
            }
          : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.startAt !== undefined
          ? { startAt: body.startAt ? new Date(body.startAt) : null }
          : {}),
        ...(body.dueAt !== undefined
          ? { dueAt: body.dueAt ? new Date(body.dueAt) : null }
          : {}),
        ...(body.parentAreaProjectId !== undefined
          ? { parentAreaProjectId: body.parentAreaProjectId }
          : {}),
        ...(body.boardLaneOrder !== undefined ? { boardLaneOrder: body.boardLaneOrder } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(projects.id, id), eq(projects.businessId, m.businessId)))
      .returning()
    const onlyLane =
      body.boardLaneOrder !== undefined &&
      body.name === undefined &&
      body.description === undefined &&
      body.status === undefined &&
      body.area === undefined &&
      body.ownerUserId === undefined &&
      body.memberUserIds === undefined &&
      body.startAt === undefined &&
      body.dueAt === undefined &&
      body.parentAreaProjectId === undefined
    await addProjectEvent(
      id,
      onlyLane ? 'board_lanes' : 'updated',
      onlyLane ? 'Board-Spalten neu sortiert' : 'Projekt aktualisiert',
      user.id,
      { patch: body },
    )
    return { project: toProject(row!) }
  })

  app.post('/api/b/:slug/projects/:id/complete', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const existing = await loadProject(m.businessId, id)
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    if (!assertProjectAccess(existing, user.id, m.role as Role)) {
      return reply.code(404).send({ error: 'not_found' })
    }
    if (existing.type !== 'custom') {
      return reply.code(400).send({ error: 'only_custom_completable' })
    }
    const [row] = await db
      .update(projects)
      .set({ status: 'done', completedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(projects.id, id), eq(projects.businessId, m.businessId)))
      .returning()
    await addProjectEvent(id, 'completed', `Projekt abgeschlossen: ${existing.name}`, user.id)
    return { project: toProject(row!) }
  })

  app.post('/api/b/:slug/projects/:id/archive', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const existing = await loadProject(m.businessId, id)
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    if (!assertProjectAccess(existing, user.id, m.role as Role)) {
      return reply.code(404).send({ error: 'not_found' })
    }
    const [row] = await db
      .update(projects)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(projects.id, id), eq(projects.businessId, m.businessId)))
      .returning()
    await addProjectEvent(id, 'archived', `Projekt archiviert: ${existing.name}`, user.id)
    return { project: toProject(row!) }
  })

  app.post('/api/b/:slug/projects/:id/restore', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const existing = await loadProject(m.businessId, id)
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    if (!assertProjectAccess(existing, user.id, m.role as Role)) {
      return reply.code(404).send({ error: 'not_found' })
    }
    const [row] = await db
      .update(projects)
      .set({ archivedAt: null, updatedAt: new Date() })
      .where(and(eq(projects.id, id), eq(projects.businessId, m.businessId)))
      .returning()
    await addProjectEvent(id, 'restored', `Projekt wiederhergestellt: ${existing.name}`, user.id)
    return { project: toProject(row!) }
  })

  app.get('/api/b/:slug/projects/:id/activity', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const q = (req.query as { limit?: string }) || {}
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const project = await loadProject(m.businessId, id)
    if (!project) return reply.code(404).send({ error: 'not_found' })
    if (!assertProjectAccess(project, user.id, m.role as Role)) {
      return reply.code(404).send({ error: 'not_found' })
    }
    const limit = Math.min(Math.max(Number(q.limit) || 40, 1), 100)
    const rows = await db
      .select({
        id: projectEvents.id,
        projectId: projectEvents.projectId,
        type: projectEvents.type,
        summary: projectEvents.summary,
        actorUserId: projectEvents.actorUserId,
        meta: projectEvents.meta,
        createdAt: projectEvents.createdAt,
        actorDisplayName: users.displayName,
        actorEmail: users.email,
      })
      .from(projectEvents)
      .leftJoin(users, eq(users.id, projectEvents.actorUserId))
      .where(eq(projectEvents.projectId, id))
      .orderBy(desc(projectEvents.createdAt))
      .limit(limit)
    return {
      events: rows.map((r) => ({
        id: r.id,
        projectId: r.projectId,
        type: r.type,
        summary: r.summary,
        actorUserId: r.actorUserId,
        actorDisplayName: r.actorDisplayName?.trim() || r.actorEmail || null,
        meta: r.meta,
        createdAt: r.createdAt,
      })),
    }
  })

  // ---- Tasks ----
  app.get('/api/b/:slug/tasks', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const q = (req.query as {
      projectId?: string
      customerId?: string
      mine?: string
      inbox?: string
      status?: string
    }) || {}
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const conds = [eq(tasks.businessId, m.businessId), isNull(tasks.archivedAt)]
    if (q.projectId) {
      const p = await loadProject(m.businessId, q.projectId)
      if (!p || !assertProjectAccess(p, user.id, m.role as Role)) {
        return reply.code(404).send({ error: 'not_found' })
      }
      conds.push(eq(tasks.projectId, q.projectId))
    }
    if (q.customerId) conds.push(eq(tasks.customerId, q.customerId))
    if (q.inbox === '1' || q.inbox === 'true') conds.push(isNull(tasks.projectId))
    if (q.mine === '1' || q.mine === 'true') {
      conds.push(
        or(eq(tasks.assigneeUserId, user.id), isNull(tasks.assigneeUserId))!,
      )
    }
    if (q.status) conds.push(eq(tasks.status, q.status))
    const rows = await db
      .select()
      .from(tasks)
      .where(and(...conds))
      .orderBy(asc(tasks.sortOrder), desc(tasks.updatedAt))
    // Team-only: drop tasks on projects the actor cannot access (unless inbox).
    let out = rows
    if (!q.projectId) {
      const projectIds = [...new Set(rows.map((r) => r.projectId).filter(Boolean))] as string[]
      if (projectIds.length) {
        const prows = await db
          .select()
          .from(projects)
          .where(and(eq(projects.businessId, m.businessId), inArray(projects.id, projectIds)))
        const allowed = new Set(
          prows.filter((p) => assertProjectAccess(p, user.id, m.role as Role)).map((p) => p.id),
        )
        out = rows.filter((r) => !r.projectId || allowed.has(r.projectId))
      }
    }
    return { tasks: out.map(toTask) }
  })

  app.get('/api/b/:slug/tasks/mine', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const rows = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.businessId, m.businessId),
          isNull(tasks.archivedAt),
          or(
            eq(tasks.assigneeUserId, user.id),
            and(isNull(tasks.assigneeUserId), isNull(tasks.projectId)),
          )!,
        ),
      )
      .orderBy(asc(tasks.dueAt), desc(tasks.updatedAt))
    const projectIds = [...new Set(rows.map((r) => r.projectId).filter(Boolean))] as string[]
    let allowed = new Set<string>()
    if (projectIds.length) {
      const prows = await db
        .select()
        .from(projects)
        .where(and(eq(projects.businessId, m.businessId), inArray(projects.id, projectIds)))
      allowed = new Set(
        prows.filter((p) => assertProjectAccess(p, user.id, m.role as Role)).map((p) => p.id),
      )
    }
    const out = rows.filter((r) => !r.projectId || allowed.has(r.projectId))
    return { tasks: out.map(toTask) }
  })

  app.get('/api/b/:slug/tasks/:id', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const row = await loadTask(m.businessId, id)
    if (!row) return reply.code(404).send({ error: 'not_found' })
    if (row.projectId) {
      const p = await loadProject(m.businessId, row.projectId)
      if (!p || !assertProjectAccess(p, user.id, m.role as Role)) {
        return reply.code(404).send({ error: 'not_found' })
      }
    }
    const [comments, checklist, attachments] = await Promise.all([
      db
        .select()
        .from(taskComments)
        .where(eq(taskComments.taskId, id))
        .orderBy(asc(taskComments.createdAt)),
      db
        .select()
        .from(taskChecklistItems)
        .where(eq(taskChecklistItems.taskId, id))
        .orderBy(asc(taskChecklistItems.sortOrder)),
      db
        .select()
        .from(taskAttachments)
        .where(
          and(eq(taskAttachments.taskId, id), eq(taskAttachments.businessId, m.businessId)),
        )
        .orderBy(desc(taskAttachments.createdAt)),
    ])
    return {
      task: toTask(row),
      comments,
      checklist,
      attachments: attachments.map((a) => toAttachment(a, m.businessId)),
    }
  })

  app.post('/api/b/:slug/tasks', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const body = TaskSchema.parse(req.body)
    if (body.projectId) {
      const p = await loadProject(m.businessId, body.projectId)
      if (!p || p.archivedAt) return reply.code(400).send({ error: 'invalid_project' })
      if (!assertProjectAccess(p, user.id, m.role as Role)) {
        return reply.code(403).send({ error: 'forbidden' })
      }
    }
    let assigneeUserId: string | null =
      body.assigneeUserId !== undefined ? body.assigneeUserId : user.id
    if (assigneeUserId) {
      const [assigneeMem] = await db
        .select({ id: memberships.id })
        .from(memberships)
        .where(
          and(eq(memberships.businessId, m.businessId), eq(memberships.userId, assigneeUserId)),
        )
        .limit(1)
      if (!assigneeMem) return reply.code(400).send({ error: 'invalid_assignee' })
    }
    const [row] = await db
      .insert(tasks)
      .values({
        businessId: m.businessId,
        projectId: body.projectId ?? null,
        customerId: body.customerId ?? null,
        title: body.title,
        description: body.description,
        status: body.status,
        priority: body.priority,
        assigneeUserId,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        sortOrder: body.sortOrder,
      })
      .returning()
    await addProjectEvent(
      row!.projectId,
      'task_created',
      `Aufgabe angelegt: ${row!.title}`,
      user.id,
      { taskId: row!.id },
    )
    return reply.code(201).send({ task: toTask(row!) })
  })

  app.patch('/api/b/:slug/tasks/:id', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const existing = await loadTask(m.businessId, id)
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    if (!(await assertTaskProjectAccess(m.businessId, existing.projectId, user.id, m.role as Role))) {
      return reply.code(404).send({ error: 'not_found' })
    }
    const body = TaskPatchSchema.parse(req.body)
    if (body.version != null && body.version !== existing.version) {
      return reply.code(409).send({ error: 'version_conflict', version: existing.version })
    }
    if (body.assigneeUserId) {
      const [assigneeMem] = await db
        .select({ id: memberships.id })
        .from(memberships)
        .where(
          and(
            eq(memberships.businessId, m.businessId),
            eq(memberships.userId, body.assigneeUserId),
          ),
        )
        .limit(1)
      if (!assigneeMem) return reply.code(400).send({ error: 'invalid_assignee' })
    }
    const [row] = await db
      .update(tasks)
      .set({
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.projectId !== undefined ? { projectId: body.projectId } : {}),
        ...(body.customerId !== undefined ? { customerId: body.customerId } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.priority !== undefined ? { priority: body.priority } : {}),
        ...(body.assigneeUserId !== undefined ? { assigneeUserId: body.assigneeUserId } : {}),
        ...(body.dueAt !== undefined
          ? { dueAt: body.dueAt ? new Date(body.dueAt) : null }
          : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        version: existing.version + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, id), eq(tasks.businessId, m.businessId)))
      .returning()
    await addProjectEvent(
      row!.projectId,
      'task_updated',
      `Aufgabe aktualisiert: ${row!.title}`,
      user.id,
      { taskId: id, patch: body },
    )
    return { task: toTask(row!) }
  })

  app.post('/api/b/:slug/tasks/:id/status', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const existing = await loadTask(m.businessId, id)
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    if (!(await assertTaskProjectAccess(m.businessId, existing.projectId, user.id, m.role as Role))) {
      return reply.code(404).send({ error: 'not_found' })
    }
    const body = TaskStatusSchema.parse(req.body)
    if (body.version != null && body.version !== existing.version) {
      return reply.code(409).send({ error: 'version_conflict', version: existing.version })
    }
    const [row] = await db
      .update(tasks)
      .set({
        status: body.status,
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        version: existing.version + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, id), eq(tasks.businessId, m.businessId)))
      .returning()
    if (existing.status !== body.status) {
      await addProjectEvent(
        row!.projectId,
        'task_status',
        `Status: ${existing.status} → ${body.status} (${row!.title})`,
        user.id,
        { taskId: id, from: existing.status, to: body.status },
      )
    }
    return { task: toTask(row!) }
  })

  app.post('/api/b/:slug/tasks/:id/comments', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const existing = await loadTask(m.businessId, id)
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    const body = TaskCommentSchema.parse(req.body)
    const [comment] = await db
      .insert(taskComments)
      .values({ taskId: id, authorUserId: user.id, body: body.body })
      .returning()
    await addProjectEvent(
      existing.projectId,
      'task_comment',
      `Kommentar: ${existing.title}`,
      user.id,
      { taskId: id },
    )
    return reply.code(201).send({ comment })
  })

  app.post('/api/b/:slug/tasks/:id/checklist', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const existing = await loadTask(m.businessId, id)
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    const body = TaskChecklistItemSchema.parse(req.body)
    const [item] = await db
      .insert(taskChecklistItems)
      .values({
        taskId: id,
        title: body.title,
        done: body.done,
        sortOrder: body.sortOrder,
      })
      .returning()
    await addProjectEvent(
      existing.projectId,
      'task_checklist',
      `Checkliste: ${body.title}`,
      user.id,
      { taskId: id, itemId: item!.id },
    )
    return reply.code(201).send({ item })
  })

  app.patch('/api/b/:slug/tasks/:taskId/checklist/:itemId', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, taskId, itemId } = req.params as {
      slug: string
      taskId: string
      itemId: string
    }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const existing = await loadTask(m.businessId, taskId)
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    const body = TaskChecklistItemSchema.partial().parse(req.body)
    const [item] = await db
      .update(taskChecklistItems)
      .set({
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.done !== undefined ? { done: body.done } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      })
      .where(and(eq(taskChecklistItems.id, itemId), eq(taskChecklistItems.taskId, taskId)))
      .returning()
    if (!item) return reply.code(404).send({ error: 'not_found' })
    if (body.done !== undefined) {
      await addProjectEvent(
        existing.projectId,
        'task_checklist',
        body.done ? `Check erledigt: ${item.title}` : `Check offen: ${item.title}`,
        user.id,
        { taskId, itemId, done: body.done },
      )
    }
    return { item }
  })

  app.get('/api/b/:slug/tasks/:id/attachments', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const existing = await loadTask(m.businessId, id)
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    const rows = await db
      .select()
      .from(taskAttachments)
      .where(and(eq(taskAttachments.taskId, id), eq(taskAttachments.businessId, m.businessId)))
      .orderBy(desc(taskAttachments.createdAt))
    return { attachments: rows.map((a) => toAttachment(a, m.businessId)) }
  })

  app.post('/api/b/:slug/tasks/:id/attachments', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const existing = await loadTask(m.businessId, id)
    if (!existing) return reply.code(404).send({ error: 'not_found' })

    const file = await req.file()
    if (!file) return reply.code(400).send({ error: 'file_required' })
    if (!ATTACH_ALLOWED.includes(file.mimetype) && !file.mimetype.startsWith('image/')) {
      return reply.code(415).send({ error: 'mime_not_allowed', mime: file.mimetype })
    }

    const env = loadEnv()
    const dir = join(env.UPLOADS_DIR, m.businessId, 'tasks', id)
    await mkdir(dir, { recursive: true })
    const safeName = file.filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const stored = `${randomToken(6)}-${safeName}`
    const storagePath = join(dir, stored)

    let sizeBytes = 0
    const { Transform } = await import('node:stream')
    const counter = new Transform({
      transform(chunk, _enc, cb) {
        sizeBytes += chunk.length
        if (sizeBytes > ATTACH_MAX_BYTES) {
          cb(new Error('file_too_large'))
          return
        }
        cb(null, chunk)
      },
    })
    try {
      await pipeline(file.file, counter, createWriteStream(storagePath))
    } catch (err) {
      await unlink(storagePath).catch(() => undefined)
      if (err instanceof Error && err.message === 'file_too_large') {
        return reply.code(413).send({ error: 'file_too_large', maxBytes: ATTACH_MAX_BYTES })
      }
      throw err
    }

    const [att] = await db
      .insert(taskAttachments)
      .values({
        businessId: m.businessId,
        taskId: id,
        filename: stored,
        mimeType: file.mimetype,
        sizeBytes,
        storagePath,
        createdByUserId: user.id,
      })
      .returning()
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'task.attachment_uploaded',
      resourceRef: att!.id,
    })
    await addProjectEvent(
      existing.projectId,
      'task_attachment',
      `Anhang: ${safeName}`,
      user.id,
      { taskId: id, attachmentId: att!.id },
    )
    return { attachment: toAttachment(att!, m.businessId) }
  })

  app.delete('/api/b/:slug/tasks/:id/attachments/:attId', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id, attId } = req.params as { slug: string; id: string; attId: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const existing = await loadTask(m.businessId, id)
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    const [att] = await db
      .select()
      .from(taskAttachments)
      .where(
        and(
          eq(taskAttachments.id, attId),
          eq(taskAttachments.taskId, id),
          eq(taskAttachments.businessId, m.businessId),
        ),
      )
      .limit(1)
    if (!att) return reply.code(404).send({ error: 'not_found' })
    await db.delete(taskAttachments).where(eq(taskAttachments.id, attId))
    await unlink(att.storagePath).catch(() => undefined)
    await addProjectEvent(
      existing.projectId,
      'task_attachment_deleted',
      `Anhang entfernt: ${att.filename}`,
      user.id,
      { taskId: id, attachmentId: attId },
    )
    return { ok: true }
  })

  // ---- Recurrence ----
  app.get('/api/b/:slug/recurrence', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    // Materialize on load (idempotent)
    const tick = await materializeDueRules(m.businessId)
    const rows = await db
      .select()
      .from(recurrenceRules)
      .where(eq(recurrenceRules.businessId, m.businessId))
      .orderBy(asc(recurrenceRules.nextAt))
    return { rules: rows.map(toRule), tick }
  })

  app.post('/api/b/:slug/recurrence', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const body = RecurrenceRuleSchema.parse(req.body)
    if (body.projectId) {
      const p = await loadProject(m.businessId, body.projectId)
      if (!p) return reply.code(400).send({ error: 'invalid_project' })
    }
    const startsAt = body.startsAt ? new Date(body.startsAt) : new Date()
    const [row] = await db
      .insert(recurrenceRules)
      .values({
        businessId: m.businessId,
        projectId: body.projectId ?? null,
        customerId: body.customerId ?? null,
        title: body.title,
        description: body.description,
        priority: body.priority,
        assigneeUserId: body.assigneeUserId ?? user.id,
        freq: body.freq,
        weekday: body.weekday ?? null,
        monthDay: body.monthDay ?? null,
        timezone: body.timezone,
        startsAt,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        nextAt: startsAt,
      })
      .returning()
    return reply.code(201).send({ rule: toRule(row!) })
  })

  app.patch('/api/b/:slug/recurrence/:id', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const existing = await db
      .select()
      .from(recurrenceRules)
      .where(and(eq(recurrenceRules.id, id), eq(recurrenceRules.businessId, m.businessId)))
      .limit(1)
    if (!existing[0]) return reply.code(404).send({ error: 'not_found' })
    const body = RecurrenceRulePatchSchema.parse(req.body)
    const [row] = await db
      .update(recurrenceRules)
      .set({
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.priority !== undefined ? { priority: body.priority } : {}),
        ...(body.projectId !== undefined ? { projectId: body.projectId } : {}),
        ...(body.customerId !== undefined ? { customerId: body.customerId } : {}),
        ...(body.assigneeUserId !== undefined ? { assigneeUserId: body.assigneeUserId } : {}),
        ...(body.freq !== undefined ? { freq: body.freq } : {}),
        ...(body.weekday !== undefined ? { weekday: body.weekday } : {}),
        ...(body.monthDay !== undefined ? { monthDay: body.monthDay } : {}),
        ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
        ...(body.startsAt !== undefined ? { startsAt: new Date(body.startsAt) } : {}),
        ...(body.endsAt !== undefined
          ? { endsAt: body.endsAt ? new Date(body.endsAt) : null }
          : {}),
        ...(body.paused !== undefined
          ? { pausedAt: body.paused ? new Date() : null }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(recurrenceRules.id, id))
      .returning()
    return { rule: toRule(row!) }
  })

  app.post('/api/b/:slug/recurrence/tick', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const result = await materializeDueRules(m.businessId)
    return { ok: true, ...result }
  })
}
