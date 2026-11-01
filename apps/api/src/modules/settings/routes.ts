import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { SecretProviderSchema, canManageCredentials } from '@bu2/shared'
import { loadMembership, requireUser } from '../../plugins/auth.js'
import {
  getBusinessSecret,
  listSecretStatuses,
  upsertBusinessSecret,
  validateProviderKey,
} from '../../lib/secrets.js'
import { writeAudit } from '../../lib/audit.js'
import { db } from '../../db/client.js'
import { businesses } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { loadEnv } from '../../lib/env.js'
import { randomToken } from '../../lib/crypto.js'

const UpsertSecretSchema = z.object({
  provider: SecretProviderSchema,
  apiKey: z.string().min(8).max(4000),
})

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/api/b/:slug/settings/secrets', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    if (!canManageCredentials(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const statuses = await listSecretStatuses(m.businessId)
    return { secrets: statuses }
  })

  app.put('/api/b/:slug/settings/secrets', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canManageCredentials(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const body = UpsertSecretSchema.parse(req.body)
    const check = await validateProviderKey(body.provider, body.apiKey)
    await upsertBusinessSecret({
      businessId: m.businessId,
      provider: body.provider,
      plaintext: body.apiKey,
      userId: user.id,
      valid: check.valid,
    })
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'settings.secret_upserted',
      resourceRef: body.provider,
      status: check.valid ? 'ok' : 'invalid',
      meta: { detail: check.detail },
    })
    return { ok: true, valid: check.valid, detail: check.detail }
  })

  app.get('/api/b/:slug/settings/feature-gates', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const statuses = await listSecretStatuses(m.businessId)
    const by = Object.fromEntries(statuses.map((s) => [s.provider, s.valid]))
    return {
      gates: {
        metricool: !!by.metricool,
        brevo: !!by.brevo,
        google_ads: !!by.google_ads,
        meta_ads: !!by.meta_ads,
        tiktok_ads: !!by.tiktok_ads,
        chatgpt_ads: !!by.chatgpt_ads,
      },
    }
  })

  /** Logo crop upload — stores cropped image bytes from client. */
  app.post('/api/b/:slug/settings/logo', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canManageCredentials(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const body = z
      .object({
        dataUrl: z.string().startsWith('data:image/'),
      })
      .parse(req.body)
    const match = /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/.exec(body.dataUrl)
    if (!match) return reply.code(400).send({ error: 'invalid_data_url' })
    const mime = match[1]!
    const buf = Buffer.from(match[2]!, 'base64')
    if (buf.length > 2_000_000) return reply.code(413).send({ error: 'too_large' })
    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg'
    const env = loadEnv()
    const dir = join(env.UPLOADS_DIR, m.businessId, 'logo')
    await mkdir(dir, { recursive: true })
    const filename = `logo-${randomToken(8)}.${ext}`
    const storagePath = join(dir, filename)
    await writeFile(storagePath, buf)
    const publicPath = `/uploads/${m.businessId}/logo/${filename}`
    await db
      .update(businesses)
      .set({ logoPath: publicPath, updatedAt: new Date() })
      .where(eq(businesses.id, m.businessId))
    return { logoPath: publicPath }
  })

  app.get('/api/b/:slug/integrations/:provider/ready', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, provider } = req.params as { slug: string; provider: string }
    const parsed = SecretProviderSchema.safeParse(provider)
    if (!parsed.success) return reply.code(400).send({ error: 'unknown_provider' })
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const secret = await getBusinessSecret(m.businessId, parsed.data)
    return {
      ready: !!(secret && secret.valid),
      keyHint: secret?.keyHint ?? null,
    }
  })
}
