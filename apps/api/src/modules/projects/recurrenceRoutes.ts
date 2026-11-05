/**
 * registerRecurrenceRoutes Fastify registration — uses ./service.ts for domain helpers.
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
import {
  ATTACH_ALLOWED,
  ATTACH_MAX_BYTES,
  TICK_CAP,
  addProjectEvent,
  assertProjectAccess,
  assertTaskProjectAccess,
  loadProject,
  loadTask,
  materializeDueRules,
  taskStatsForProjects,
  toAttachment,
  toProject,
  toRule,
  toTask,
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
