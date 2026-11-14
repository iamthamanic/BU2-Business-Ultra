/**
 * Authenticated private media downloads — replaces public `/uploads/` static.
 * Location: apps/api/src/modules/media/routes.ts
 */
import { createReadStream, existsSync, statSync } from 'node:fs'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { loadEnv } from '../../lib/env.js'
import { resolveBusinessMediaFile } from '../../lib/mediaPaths.js'
import { loadMembershipByBusinessId, requireUser } from '../../plugins/auth.js'

function contentTypeFor(filename: string): string {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.mp4')) return 'video/mp4'
  return 'application/octet-stream'
}

async function sendBusinessFile(
  req: FastifyRequest,
  reply: FastifyReply,
  businessId: string,
  relative: string,
) {
  const user = await requireUser(req)
  const m = await loadMembershipByBusinessId(user.id, businessId)
  if (!m) return reply.code(403).send({ error: 'forbidden' })

  const env = loadEnv()
  const full = resolveBusinessMediaFile(env.UPLOADS_DIR, businessId, relative)
  if (!full || !existsSync(full) || !statSync(full).isFile()) {
    return reply.code(404).send({ error: 'not_found' })
  }

  const filename = relative.split('/').pop() || 'file'
  reply.header('Content-Type', contentTypeFor(filename))
  reply.header('X-Content-Type-Options', 'nosniff')
  reply.header('Cache-Control', 'private, max-age=300')
  return reply.send(createReadStream(full))
}

export async function mediaRoutes(app: FastifyInstance) {
  app.get('/api/media/:businessId/*', async (req, reply) => {
    const params = req.params as { businessId: string; '*': string }
    return sendBusinessFile(req, reply, params.businessId, params['*'] || '')
  })

  // Legacy path compat — same AuthZ (no longer public static)
  app.get('/uploads/:businessId/*', async (req, reply) => {
    const params = req.params as { businessId: string; '*': string }
    return sendBusinessFile(req, reply, params.businessId, params['*'] || '')
  })
}
