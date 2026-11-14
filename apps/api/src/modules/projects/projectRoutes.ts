/**
 * registerProjectCrudRoutes Fastify registration — uses ./service.ts for domain helpers.
 */
import type { FastifyInstance } from 'fastify'
import { and, asc, desc, eq, ilike, isNotNull, isNull } from 'drizzle-orm'
import { ProjectPatchSchema, ProjectSchema, canMutateContent } from '@bu2/shared'
import { db } from '../../db/client.js'
import { projectEvents, projects, recurrenceRules, tasks, users } from '../../db/schema.js'
import { writeAudit } from '../../lib/audit.js'
import { loadMembership, requireUser } from '../../plugins/auth.js'
import { ensureDefaultAreaProjectsIfEmpty } from './defaultAreas.js'
import {
  addProjectEvent,
  assertProjectAccess,
  loadProject,
  mergeTasksWithRules,
  statsFromMerged,
  taskStatsForProjects,
  toProject,
} from './service.js'


export async function registerProjectCrudRoutes(app: FastifyInstance) {
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
      ).filter((r) => assertProjectAccess(r, user.id, m))
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
      if (!assertProjectAccess(row, user.id, m)) {
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
      const ruleRows = await db
        .select()
        .from(recurrenceRules)
        .where(and(eq(recurrenceRules.businessId, m.businessId), eq(recurrenceRules.projectId, id)))
        .orderBy(asc(recurrenceRules.nextAt))
      const merged = await mergeTasksWithRules(taskRows, ruleRows)
      const stats = statsFromMerged(merged)
      return { project: { ...toProject(row), stats }, tasks: merged }
    })

  app.post('/api/b/:slug/projects', async (req, reply) => {
      const user = await requireUser(req)
      const { slug } = req.params as { slug: string }
      const m = await loadMembership(user.id, slug)
      if (!m || !canMutateContent(m)) return reply.code(403).send({ error: 'forbidden' })
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
      if (!m || !canMutateContent(m)) return reply.code(403).send({ error: 'forbidden' })
      const existing = await loadProject(m.businessId, id)
      if (!existing) return reply.code(404).send({ error: 'not_found' })
      if (!assertProjectAccess(existing, user.id, m)) {
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
      if (!m || !canMutateContent(m)) return reply.code(403).send({ error: 'forbidden' })
      const existing = await loadProject(m.businessId, id)
      if (!existing) return reply.code(404).send({ error: 'not_found' })
      if (!assertProjectAccess(existing, user.id, m)) {
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
      if (!m || !canMutateContent(m)) return reply.code(403).send({ error: 'forbidden' })
      const existing = await loadProject(m.businessId, id)
      if (!existing) return reply.code(404).send({ error: 'not_found' })
      if (!assertProjectAccess(existing, user.id, m)) {
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
      if (!m || !canMutateContent(m)) return reply.code(403).send({ error: 'forbidden' })
      const existing = await loadProject(m.businessId, id)
      if (!existing) return reply.code(404).send({ error: 'not_found' })
      if (!assertProjectAccess(existing, user.id, m)) {
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
      if (!assertProjectAccess(project, user.id, m)) {
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
}
