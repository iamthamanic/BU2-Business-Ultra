import type { FastifyInstance } from 'fastify'
import { canMutateContent } from '@bu2/shared'
import { loadMembership, requireUser } from '../../plugins/auth.js'
import { loadEnv } from '../../lib/env.js'
import { writeAudit } from '../../lib/audit.js'

export async function sortanizeRoutes(app: FastifyInstance) {
  app.get('/api/b/:slug/sortanize/health', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const env = loadEnv()
    try {
      const res = await fetch(`${env.SORTANIZE_URL}/health`)
      const body = await res.json()
      return { ok: res.ok, sidecar: body }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  app.post('/api/b/:slug/sortanize/match', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const env = loadEnv()
    try {
      const res = await fetch(`${env.SORTANIZE_URL}/match`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(req.body),
      })
      const body = await res.json()
      await writeAudit({
        businessId: m.businessId,
        actorUserId: user.id,
        action: 'sortanize.list_match',
        status: res.ok ? 'ok' : 'failed',
      })
      return reply.code(res.status).send(body)
    } catch (e) {
      return reply.code(502).send({ error: 'sortanize_unreachable', detail: String(e) })
    }
  })

  /** Full legacy-compatible run (duplicates | customer-match) with base64 CSV/XLSX. */
  app.post('/api/b/:slug/sortanize/run', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const env = loadEnv()
    try {
      const res = await fetch(`${env.SORTANIZE_URL}/run`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(req.body),
      })
      const body = await res.json()
      await writeAudit({
        businessId: m.businessId,
        actorUserId: user.id,
        action: 'sortanize.run',
        status: res.ok ? 'ok' : 'failed',
        meta: { mode: (req.body as { mode?: string })?.mode },
      })
      return reply.code(res.status).send(body)
    } catch (e) {
      return reply.code(502).send({ error: 'sortanize_unreachable', detail: String(e) })
    }
  })

  app.post('/api/b/:slug/sortanize/preview', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const env = loadEnv()
    try {
      const res = await fetch(`${env.SORTANIZE_URL}/preview`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(req.body),
      })
      return reply.code(res.status).send(await res.json())
    } catch (e) {
      return reply.code(502).send({ error: 'sortanize_unreachable', detail: String(e) })
    }
  })
}
