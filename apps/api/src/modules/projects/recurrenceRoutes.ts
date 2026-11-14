/**
 * registerRecurrenceRoutes Fastify registration — uses ./service.ts for domain helpers.
 */
import { createWriteStream } from 'node:fs'
import { mkdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { FastifyInstance } from 'fastify'
import { and, asc, desc, eq, ne } from 'drizzle-orm'
import {
  RecurrenceRulePatchSchema,
  RecurrenceRuleSchema,
  TaskChecklistItemSchema,
  TaskCommentSchema,
  canMutateContent,
} from '@bu2/shared'
import { db } from '../../db/client.js'
import {
  recurrenceRules,
  taskAttachments,
  taskChecklistItems,
  taskComments,
  taskOccurrences,
  tasks,
} from '../../db/schema.js'
import { writeAudit } from '../../lib/audit.js'
import { randomToken } from '../../lib/crypto.js'
import { loadEnv } from '../../lib/env.js'
import { loadMembership, requireUser } from '../../plugins/auth.js'
import {
  ATTACH_ALLOWED,
  ATTACH_MAX_BYTES,
  addProjectEvent,
  advanceNext,
  assertProjectAccess,
  copyRuleChecklistToTask,
  filterActiveRules,
  isRuleActive,
  loadProject,
  loadRule,
  loadRuleSideContent,
  materializeDueRules,
  ruleAsTask,
  toAttachment,
  toRule,
} from './service.js'

export async function registerRecurrenceRoutes(app: FastifyInstance) {
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
    return { rules: filterActiveRules(rows).map(toRule), tick }
  })

  app.get('/api/b/:slug/recurrence/:id', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const row = await loadRule(m.businessId, id)
    if (!row) return reply.code(404).send({ error: 'not_found' })
    if (row.projectId) {
      const p = await loadProject(m.businessId, row.projectId)
      if (!p || !assertProjectAccess(p, user.id, m)) {
        return reply.code(404).send({ error: 'not_found' })
      }
    }
    const side = await loadRuleSideContent(m.businessId, id)
    return { rule: toRule(row), task: ruleAsTask(row), ...side }
  })

  app.post('/api/b/:slug/recurrence/:id/comments', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m)) return reply.code(403).send({ error: 'forbidden' })
    const existing = await loadRule(m.businessId, id)
    if (!existing || !isRuleActive(existing)) return reply.code(404).send({ error: 'not_found' })
    const body = TaskCommentSchema.parse(req.body)
    const [comment] = await db
      .insert(taskComments)
      .values({ ruleId: id, authorUserId: user.id, body: body.body })
      .returning()
    await addProjectEvent(
      existing.projectId,
      'task_comment',
      `Kommentar (Serie): ${existing.title}`,
      user.id,
      { ruleId: id },
    )
    return reply.code(201).send({
      comment: {
        ...comment!,
        authorDisplayName: user.displayName?.trim() || user.email || null,
      },
    })
  })

  app.post('/api/b/:slug/recurrence/:id/checklist', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m)) return reply.code(403).send({ error: 'forbidden' })
    const existing = await loadRule(m.businessId, id)
    if (!existing || !isRuleActive(existing)) return reply.code(404).send({ error: 'not_found' })
    const body = TaskChecklistItemSchema.parse(req.body)
    const [item] = await db
      .insert(taskChecklistItems)
      .values({
        ruleId: id,
        title: body.title,
        done: body.done,
        sortOrder: body.sortOrder,
      })
      .returning()
    await addProjectEvent(
      existing.projectId,
      'task_checklist',
      `Checkliste (Serie): ${body.title}`,
      user.id,
      { ruleId: id, itemId: item!.id },
    )
    return reply.code(201).send({ item })
  })

  app.patch('/api/b/:slug/recurrence/:id/checklist/:itemId', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id, itemId } = req.params as { slug: string; id: string; itemId: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m)) return reply.code(403).send({ error: 'forbidden' })
    const existing = await loadRule(m.businessId, id)
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    const body = TaskChecklistItemSchema.partial().parse(req.body)
    const [item] = await db
      .update(taskChecklistItems)
      .set({
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.done !== undefined ? { done: body.done } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      })
      .where(and(eq(taskChecklistItems.id, itemId), eq(taskChecklistItems.ruleId, id)))
      .returning()
    if (!item) return reply.code(404).send({ error: 'not_found' })
    return { item }
  })

  app.post('/api/b/:slug/recurrence/:id/attachments', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m)) return reply.code(403).send({ error: 'forbidden' })
    const existing = await loadRule(m.businessId, id)
    if (!existing || !isRuleActive(existing)) return reply.code(404).send({ error: 'not_found' })

    const file = await req.file()
    if (!file) return reply.code(400).send({ error: 'file_required' })
    if (!ATTACH_ALLOWED.includes(file.mimetype) && !file.mimetype.startsWith('image/')) {
      return reply.code(415).send({ error: 'mime_not_allowed', mime: file.mimetype })
    }

    const env = loadEnv()
    const dir = join(env.UPLOADS_DIR, m.businessId, 'rules', id)
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
        ruleId: id,
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
      `Anhang (Serie): ${safeName}`,
      user.id,
      { ruleId: id, attachmentId: att!.id },
    )
    return { attachment: toAttachment(att!, m.businessId) }
  })

  app.delete('/api/b/:slug/recurrence/:id/attachments/:attId', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id, attId } = req.params as { slug: string; id: string; attId: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m)) return reply.code(403).send({ error: 'forbidden' })
    const existing = await loadRule(m.businessId, id)
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    const [att] = await db
      .select()
      .from(taskAttachments)
      .where(
        and(
          eq(taskAttachments.id, attId),
          eq(taskAttachments.ruleId, id),
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
      `Anhang entfernt (Serie): ${att.filename}`,
      user.id,
      { ruleId: id, attachmentId: attId },
    )
    return { ok: true }
  })

  /** Mark current period done: close open occurrence (or slot at nextAt) + advance + reset checklist. */
  app.post('/api/b/:slug/recurrence/:id/complete-period', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m)) return reply.code(403).send({ error: 'forbidden' })
    const rule = await loadRule(m.businessId, id)
    if (!rule || !isRuleActive(rule)) return reply.code(404).send({ error: 'not_found' })

    let taskId: string | null = null
    let completedFor: Date

    // Prefer the oldest non-done materialization (tick may already have created it).
    const [openOcc] = await db
      .select({
        occId: taskOccurrences.id,
        scheduledFor: taskOccurrences.scheduledFor,
        taskId: taskOccurrences.taskId,
      })
      .from(taskOccurrences)
      .innerJoin(tasks, eq(tasks.id, taskOccurrences.taskId))
      .where(and(eq(taskOccurrences.ruleId, id), ne(tasks.status, 'done')))
      .orderBy(asc(taskOccurrences.scheduledFor))
      .limit(1)

    if (openOcc) {
      completedFor = new Date(openOcc.scheduledFor)
      taskId = openOcc.taskId
      await db
        .update(tasks)
        .set({ status: 'done', updatedAt: new Date() })
        .where(eq(tasks.id, openOcc.taskId))
      await db
        .update(taskChecklistItems)
        .set({ done: true })
        .where(eq(taskChecklistItems.taskId, openOcc.taskId))
    } else {
      completedFor = new Date(rule.nextAt)
      const [existingOcc] = await db
        .select()
        .from(taskOccurrences)
        .where(
          and(eq(taskOccurrences.ruleId, id), eq(taskOccurrences.scheduledFor, completedFor)),
        )
        .limit(1)

      if (existingOcc) {
        taskId = existingOcc.taskId
        await db
          .update(tasks)
          .set({ status: 'done', updatedAt: new Date() })
          .where(eq(tasks.id, existingOcc.taskId))
      } else {
        try {
          const [task] = await db
            .insert(tasks)
            .values({
              businessId: m.businessId,
              projectId: rule.projectId,
              customerId: rule.customerId,
              title: rule.title,
              description: rule.description,
              priority: rule.priority,
              assigneeUserId: rule.assigneeUserId,
              status: 'done',
              dueAt: completedFor,
              reminders: Array.isArray(rule.reminders) ? rule.reminders : [],
            })
            .returning()
          taskId = task!.id
          await db.insert(taskOccurrences).values({
            ruleId: rule.id,
            scheduledFor: completedFor,
            taskId: task!.id,
          })
          await copyRuleChecklistToTask(rule.id, task!.id)
          await db
            .update(taskChecklistItems)
            .set({ done: true })
            .where(eq(taskChecklistItems.taskId, task!.id))
        } catch (err) {
          const msg = String((err as Error)?.message || err)
          if (!/unique|duplicate/i.test(msg)) throw err
          const [raceOcc] = await db
            .select()
            .from(taskOccurrences)
            .where(
              and(eq(taskOccurrences.ruleId, id), eq(taskOccurrences.scheduledFor, completedFor)),
            )
            .limit(1)
          if (raceOcc) {
            taskId = raceOcc.taskId
            await db
              .update(tasks)
              .set({ status: 'done', updatedAt: new Date() })
              .where(eq(tasks.id, raceOcc.taskId))
          }
        }
      }
    }

    const advanced = advanceNext(completedFor, rule.freq, rule.weekday, rule.monthDay)
    const currentNext = new Date(rule.nextAt)
    const nextAt = advanced.getTime() > currentNext.getTime() ? advanced : currentNext
    const completedAt = new Date()
    const [row] = await db
      .update(recurrenceRules)
      .set({
        nextAt,
        lastCompletedAt: completedAt,
        updatedAt: completedAt,
      })
      .where(eq(recurrenceRules.id, id))
      .returning()

    await db
      .update(taskChecklistItems)
      .set({ done: false })
      .where(eq(taskChecklistItems.ruleId, id))

    await addProjectEvent(
      rule.projectId,
      'recurrence_complete_period',
      `Zeitraum erledigt: ${rule.title}`,
      user.id,
      {
        ruleId: id,
        taskId,
        completedFor: completedFor.toISOString(),
        nextAt: nextAt.toISOString(),
      },
    )

    const side = await loadRuleSideContent(m.businessId, id)
    return { rule: toRule(row!), task: ruleAsTask(row!), ...side }
  })

  /** End series permanently — no further rhythm. */
  app.post('/api/b/:slug/recurrence/:id/finish', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m)) return reply.code(403).send({ error: 'forbidden' })
    const rule = await loadRule(m.businessId, id)
    if (!rule || !isRuleActive(rule)) return reply.code(404).send({ error: 'not_found' })

    const now = new Date()
    const [row] = await db
      .update(recurrenceRules)
      .set({
        endsAt: now,
        pausedAt: now,
        updatedAt: now,
      })
      .where(eq(recurrenceRules.id, id))
      .returning()

    await addProjectEvent(
      rule.projectId,
      'recurrence_finished',
      `Serie beendet: ${rule.title}`,
      user.id,
      { ruleId: id },
    )

    return { rule: toRule(row!), task: ruleAsTask(row!), finished: true }
  })

  app.post('/api/b/:slug/recurrence', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m)) return reply.code(403).send({ error: 'forbidden' })
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
        reminders: body.reminders ?? [],
      })
      .returning()
    return reply.code(201).send({ rule: toRule(row!) })
  })

  app.patch('/api/b/:slug/recurrence/:id', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m)) return reply.code(403).send({ error: 'forbidden' })
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
        ...(body.reminders !== undefined ? { reminders: body.reminders } : {}),
        ...(body.nextAt !== undefined ? { nextAt: new Date(body.nextAt) } : {}),
        ...(body.paused !== undefined
          ? { pausedAt: body.paused ? new Date() : null }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(recurrenceRules.id, id))
      .returning()
    return { rule: toRule(row!), task: ruleAsTask(row!) }
  })

  app.post('/api/b/:slug/recurrence/tick', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m)) return reply.code(403).send({ error: 'forbidden' })
    const result = await materializeDueRules(m.businessId)
    return { ok: true, ...result }
  })
}
