/**
 * Tools hub HTTP — list / install / update / delete tenant tools.
 * Location: apps/api/src/modules/tools/routes.ts
 */
import type { FastifyInstance } from 'fastify'
import {
  CreateToolInstallSchema,
  UpdateToolInstallSchema,
  canManageTools,
  canUseTools,
} from '@bu2/shared'
import { writeAudit } from '../../lib/audit.js'
import { loadMembership, requireUser } from '../../plugins/auth.js'
import {
  createToolInstall,
  deleteToolInstall,
  listToolsForBusiness,
  updateToolInstall,
} from './service.js'


export async function toolsRoutes(app: FastifyInstance) {
  app.get('/api/b/:slug/tools', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    if (!canUseTools(m)) {
      return reply.code(403).send({ error: 'forbidden' })
    }
    const businessId = m.businessId
    if (!businessId) return reply.code(404).send({ error: 'not_found' })
    const tools = await listToolsForBusiness(businessId)
    const canManage = canManageTools(m)
    return { tools, canManage }
  })

  app.post('/api/b/:slug/tools', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    if (!canManageTools(m)) {
      return reply.code(403).send({ error: 'forbidden' })
    }
    const body = CreateToolInstallSchema.parse(req.body)
    const result = await createToolInstall(m.businessId, user.id, body)
    if (!result.ok) {
      if (result.error === 'reserved') return reply.code(400).send({ error: 'manifest_reserved' })
      return reply.code(409).send({ error: 'manifest_conflict' })
    }
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'tools.installed',
      resourceRef: result.tool.manifestId,
    })
    return reply.code(201).send({ tool: result.tool })
  })

  app.patch('/api/b/:slug/tools/:id', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    if (!canManageTools(m)) {
      return reply.code(403).send({ error: 'forbidden' })
    }
    if (id === '00000000-0000-4000-8000-000000000001') {
      return reply.code(400).send({ error: 'system_tool_immutable' })
    }
    const body = UpdateToolInstallSchema.parse(req.body)
    const tool = await updateToolInstall(m.businessId, id, body)
    if (!tool) return reply.code(404).send({ error: 'not_found' })
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'tools.updated',
      resourceRef: tool.manifestId,
    })
    return { tool }
  })

  app.delete('/api/b/:slug/tools/:id', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    if (!canManageTools(m)) {
      return reply.code(403).send({ error: 'forbidden' })
    }
    if (id === '00000000-0000-4000-8000-000000000001') {
      return reply.code(400).send({ error: 'system_tool_immutable' })
    }
    const ok = await deleteToolInstall(m.businessId, id)
    if (!ok) return reply.code(404).send({ error: 'not_found' })
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'tools.uninstalled',
      resourceRef: id,
    })
    return { ok: true }
  })
}
