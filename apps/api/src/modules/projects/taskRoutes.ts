/**
 * registerTaskRoutes Fastify registration — uses ./service.ts for domain helpers.
 */
import { createWriteStream } from 'node:fs'
import { mkdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { FastifyInstance } from 'fastify'
import { and, asc, desc, eq, inArray, isNull, or } from 'drizzle-orm'
import {
  TaskChecklistItemSchema,
  TaskCommentSchema,
  TaskPatchSchema,
  TaskSchema,
  TaskStatusSchema,
  canMutateContent,
  type Role,
} from '@bu2/shared'
import { db } from '../../db/client.js'
import {
  memberships,
  projects,
  recurrenceRules,
  taskAttachments,
  taskChecklistItems,
  taskComments,
  tasks,
  users,
} from '../../db/schema.js'
import { writeAudit } from '../../lib/audit.js'
import { randomToken } from '../../lib/crypto.js'
import { loadEnv } from '../../lib/env.js'
import { loadMembership, requireUser } from '../../plugins/auth.js'
import {
  ATTACH_ALLOWED,
  ATTACH_MAX_BYTES,
  addProjectEvent,
  assertProjectAccess,
  assertTaskProjectAccess,
  loadProject,
  loadTask,
  mergeTasksWithRules,
  toAttachment,
  toTask,
} from './service.js'

export async function registerTaskRoutes(app: FastifyInstance) {
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
    let ruleRows: (typeof recurrenceRules.$inferSelect)[] = []
    if (q.projectId) {
      ruleRows = await db
        .select()
        .from(recurrenceRules)
        .where(
          and(eq(recurrenceRules.businessId, m.businessId), eq(recurrenceRules.projectId, q.projectId)),
        )
        .orderBy(asc(recurrenceRules.nextAt))
    }
    const merged = await mergeTasksWithRules(out, ruleRows)
    return { tasks: merged }
  })

  app.get('/api/b/:slug/tasks/mine', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    // Only tasks / rules assigned to the current user (all projects).
    const rows = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.businessId, m.businessId),
          isNull(tasks.archivedAt),
          eq(tasks.assigneeUserId, user.id),
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
    const ruleRows = await db
      .select()
      .from(recurrenceRules)
      .where(
        and(
          eq(recurrenceRules.businessId, m.businessId),
          eq(recurrenceRules.assigneeUserId, user.id),
        ),
      )
      .orderBy(asc(recurrenceRules.nextAt))
    // Rules may sit on projects not present in the one-shot task set — resolve access.
    const extraProjectIds = [
      ...new Set(
        ruleRows
          .map((r) => r.projectId)
          .filter((pid): pid is string => typeof pid === 'string' && !allowed.has(pid)),
      ),
    ]
    if (extraProjectIds.length) {
      const prows = await db
        .select()
        .from(projects)
        .where(and(eq(projects.businessId, m.businessId), inArray(projects.id, extraProjectIds)))
      for (const p of prows) {
        if (assertProjectAccess(p, user.id, m.role as Role)) allowed.add(p.id)
      }
    }
    const rulesForMine = ruleRows.filter((r) => !r.projectId || allowed.has(r.projectId))
    const merged = await mergeTasksWithRules(out, rulesForMine)
    return { tasks: merged }
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
    const [commentRows, checklist, attachments] = await Promise.all([
      db
        .select({
          id: taskComments.id,
          taskId: taskComments.taskId,
          authorUserId: taskComments.authorUserId,
          body: taskComments.body,
          createdAt: taskComments.createdAt,
          authorDisplayName: users.displayName,
          authorEmail: users.email,
        })
        .from(taskComments)
        .leftJoin(users, eq(users.id, taskComments.authorUserId))
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
    const comments = commentRows.map((c) => ({
      id: c.id,
      taskId: c.taskId,
      authorUserId: c.authorUserId,
      body: c.body,
      createdAt: c.createdAt,
      authorDisplayName: c.authorDisplayName?.trim() || c.authorEmail || null,
    }))
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
        reminders: body.reminders ?? [],
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
        ...(body.reminders !== undefined ? { reminders: body.reminders } : {}),
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
    return reply.code(201).send({
      comment: {
        ...comment!,
        authorDisplayName: user.displayName?.trim() || user.email || null,
      },
    })
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

}
