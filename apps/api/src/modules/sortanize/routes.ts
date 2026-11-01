import type { FastifyInstance } from 'fastify'
import { canMutateContent } from '@bu2/shared'
import { loadMembership, requireUser } from '../../plugins/auth.js'
import { loadEnv } from '../../lib/env.js'

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
      return reply.code(res.status).send(body)
    } catch (e) {
      return reply.code(502).send({ error: 'sortanize_unreachable', detail: String(e) })
    }
  })
}
