/**
 * Company settings — secrets, logo, Metricool brand links, funnel bindings.
 * Location: apps/api/src/modules/settings/routes.ts — helpers in ./service.ts
 */
import type { FastifyInstance } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import {
  FunnelBindingsPutSchema,
  SecretProviderSchema,
  canManageCredentials,
  hasPermission,
} from '@bu2/shared'
import { loadMembership, requireUser } from '../../plugins/auth.js'
import {
  deleteBusinessSecret,
  getBusinessSecret,
  listSecretStatuses,
  upsertBusinessSecret,
  validateProviderKey,
} from '../../lib/secrets.js'
import { writeAudit } from '../../lib/audit.js'
import { db } from '../../db/client.js'
import {
  businesses,
  businessIntegrations,
  connections,
  funnelBindings,
  openseoInstances,
} from '../../db/schema.js'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { loadEnv } from '../../lib/env.js'
import { randomToken } from '../../lib/crypto.js'
import { listBrands } from '../../lib/integrations/metricool.js'
import { UpsertSecretSchema, LinkMetricoolSchema } from './service.js'

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/api/b/:slug/settings/secrets', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    if (!canManageCredentials(m)) return reply.code(403).send({ error: 'forbidden' })
    const statuses = await listSecretStatuses(m.businessId)
    return { secrets: statuses }
  })

  app.put('/api/b/:slug/settings/secrets', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canManageCredentials(m)) return reply.code(403).send({ error: 'forbidden' })
    const body = UpsertSecretSchema.parse(req.body)
    // Paid ads + Google/Meta/TikTok Ads use Integration Core OAuth — no settings_secrets dual path.
    const oauthOnly = new Set([
      'chatgpt_ads',
      'reddit_ads',
      'microsoft_ads',
      'pinterest_ads',
      'google_ads',
      'meta_ads',
      'tiktok_ads',
    ])
    if (oauthOnly.has(body.provider)) {
      return reply.code(410).send({
        error: 'ads_secret_retired',
        hint: `Use OAuth connect for ${body.provider} (Settings → Verbindungen).`,
      })
    }
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

  app.delete('/api/b/:slug/settings/secrets/:provider', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, provider } = req.params as { slug: string; provider: string }
    const parsed = SecretProviderSchema.safeParse(provider)
    if (!parsed.success) return reply.code(400).send({ error: 'unknown_provider' })
    const m = await loadMembership(user.id, slug)
    if (!m || !canManageCredentials(m)) return reply.code(403).send({ error: 'forbidden' })
    await deleteBusinessSecret(m.businessId, parsed.data)
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'settings.secret_deleted',
      resourceRef: parsed.data,
    })
    return { ok: true }
  })

  app.get('/api/b/:slug/settings/feature-gates', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !hasPermission(m, 'settings.read')) return reply.code(403).send({ error: 'forbidden' })
    const statuses = await listSecretStatuses(m.businessId)
    const by = Object.fromEntries(statuses.map((s) => [s.provider, s.valid]))
    const adsProviders = ['google_ads', 'meta_ads', 'tiktok_ads', 'chatgpt_ads'] as const
    const adsConn = await db
      .select({ provider: connections.provider })
      .from(connections)
      .where(and(eq(connections.businessId, m.businessId), eq(connections.status, 'active')))
    const adsReady = new Set(adsConn.map((r) => r.provider))
    return {
      gates: {
        metricool: !!by.metricool,
        brevo: !!by.brevo,
        google_ads: adsReady.has('google_ads'),
        meta_ads: adsReady.has('meta_ads'),
        tiktok_ads: adsReady.has('tiktok_ads'),
        chatgpt_ads: adsReady.has('chatgpt_ads'),
      },
      oauthAds: Object.fromEntries(adsProviders.map((p) => [p, adsReady.has(p)])),
    }
  })

  /** Aggregated status for Settings header strip. */
  app.get('/api/b/:slug/settings/status', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !hasPermission(m, 'settings.read')) return reply.code(403).send({ error: 'forbidden' })

    const [secrets, metricoolLinks, bindings, seoRows] = await Promise.all([
      listSecretStatuses(m.businessId),
      db
        .select()
        .from(businessIntegrations)
        .where(
          and(
            eq(businessIntegrations.businessId, m.businessId),
            eq(businessIntegrations.provider, 'metricool'),
          ),
        ),
      db.select().from(funnelBindings).where(eq(funnelBindings.businessId, m.businessId)),
      db
        .select()
        .from(openseoInstances)
        .where(eq(openseoInstances.businessId, m.businessId))
        .limit(1),
    ])

    const by = Object.fromEntries(secrets.map((s) => [s.provider, s]))
    const seo = seoRows[0]
    const seoOk = !!seo && seo.status !== 'not_provisioned'
    const activeBindings = bindings.filter((b) => b.status === 'active')

    return {
      status: {
        metricool: {
          ok: !!by.metricool?.valid || metricoolLinks.length > 0,
          brands: metricoolLinks.length,
          keyHint: by.metricool?.keyHint ?? null,
        },
        seo: {
          ok: seoOk,
          status: seo?.status ?? 'not_provisioned',
        },
        email: {
          ok: !!by.brevo?.valid,
          keyHint: by.brevo?.keyHint ?? null,
        },
        funnel: {
          ok: activeBindings.length >= 1,
          surfaces: bindings.length,
          active: activeBindings.length,
        },
      },
    }
  })

  /** Logo crop upload — stores cropped image bytes from client. */
  app.post('/api/b/:slug/settings/logo', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canManageCredentials(m)) return reply.code(403).send({ error: 'forbidden' })
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
    const publicPath = `/api/media/${m.businessId}/logo/${filename}`
    await db
      .update(businesses)
      .set({ logoPath: publicPath, updatedAt: new Date() })
      .where(eq(businesses.id, m.businessId))
    return { logoPath: publicPath }
  })

  app.delete('/api/b/:slug/settings/logo', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canManageCredentials(m)) return reply.code(403).send({ error: 'forbidden' })
    await db
      .update(businesses)
      .set({ logoPath: null, updatedAt: new Date() })
      .where(eq(businesses.id, m.businessId))
    return { ok: true }
  })

  app.get('/api/b/:slug/integrations/:provider/ready', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, provider } = req.params as { slug: string; provider: string }
    const parsed = SecretProviderSchema.safeParse(provider)
    if (!parsed.success) return reply.code(400).send({ error: 'unknown_provider' })
    const m = await loadMembership(user.id, slug)
    if (!m || !hasPermission(m, 'settings.read')) return reply.code(403).send({ error: 'forbidden' })
    const secret = await getBusinessSecret(m.businessId, parsed.data)
    return {
      ready: !!(secret && secret.valid),
      keyHint: secret?.keyHint ?? null,
    }
  })

  // ---- Metricool brand links ----

  app.get('/api/b/:slug/settings/integrations/metricool', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    if (!canManageCredentials(m)) return reply.code(403).send({ error: 'forbidden' })

    const linked = await db
      .select()
      .from(businessIntegrations)
      .where(
        and(
          eq(businessIntegrations.businessId, m.businessId),
          eq(businessIntegrations.provider, 'metricool'),
        ),
      )

    let available: { blogId: string; label: string }[] = []
    let brandsError: string | null = null
    const secret = await getBusinessSecret(m.businessId, 'metricool')
    if (!secret?.valid) {
      brandsError = 'metricool_key_required'
    } else {
      try {
        const res = await listBrands(secret.plaintext)
        available = (res.brands ?? []).map((b) => ({
          blogId: b.blogId,
          label: b.label || b.blogId,
        }))
      } catch (e) {
        brandsError = String(e)
      }
    }

    return {
      linked: linked.map((row) => ({
        id: row.id,
        blogId: row.externalId,
        label: row.label,
        createdAt: row.createdAt,
      })),
      available,
      brandsError,
      keyReady: !!secret?.valid,
      keyHint: secret?.keyHint ?? null,
    }
  })

  app.post('/api/b/:slug/settings/integrations/metricool', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canManageCredentials(m)) return reply.code(403).send({ error: 'forbidden' })
    const body = LinkMetricoolSchema.parse(req.body)

    const existing = (
      await db
        .select()
        .from(businessIntegrations)
        .where(
          and(
            eq(businessIntegrations.businessId, m.businessId),
            eq(businessIntegrations.provider, 'metricool'),
            eq(businessIntegrations.externalId, body.blogId),
          ),
        )
        .limit(1)
    )[0]
    if (existing) {
      if (body.label != null) {
        await db
          .update(businessIntegrations)
          .set({ label: body.label })
          .where(eq(businessIntegrations.id, existing.id))
      }
      return { integration: { id: existing.id, blogId: existing.externalId, label: body.label ?? existing.label } }
    }

    const [row] = await db
      .insert(businessIntegrations)
      .values({
        businessId: m.businessId,
        provider: 'metricool',
        externalId: body.blogId,
        label: body.label ?? body.blogId,
      })
      .returning()

    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'settings.metricool_brand_linked',
      resourceRef: body.blogId,
    })

    return {
      integration: {
        id: row!.id,
        blogId: row!.externalId,
        label: row!.label,
      },
    }
  })

  app.delete('/api/b/:slug/settings/integrations/metricool/:id', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canManageCredentials(m)) return reply.code(403).send({ error: 'forbidden' })

    const row = (
      await db
        .select()
        .from(businessIntegrations)
        .where(
          and(
            eq(businessIntegrations.id, id),
            eq(businessIntegrations.businessId, m.businessId),
            eq(businessIntegrations.provider, 'metricool'),
          ),
        )
        .limit(1)
    )[0]
    if (!row) return reply.code(404).send({ error: 'not_found' })

    await db.delete(businessIntegrations).where(eq(businessIntegrations.id, row.id))
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'settings.metricool_brand_unlinked',
      resourceRef: row.externalId,
    })
    return { ok: true }
  })

  // ---- Funnel bindings ----

  app.get('/api/b/:slug/settings/funnel-bindings', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })

    const [bindings, integrations] = await Promise.all([
      db.select().from(funnelBindings).where(eq(funnelBindings.businessId, m.businessId)),
      db
        .select()
        .from(businessIntegrations)
        .where(
          and(
            eq(businessIntegrations.businessId, m.businessId),
            eq(businessIntegrations.provider, 'metricool'),
          ),
        ),
    ])

    return {
      bindings: bindings.map((b) => ({
        surface: b.surface,
        provider: b.provider,
        status: b.status,
        integrationId: b.integrationId,
      })),
      integrations: integrations.map((i) => ({
        id: i.id,
        blogId: i.externalId,
        label: i.label || i.externalId,
      })),
    }
  })

  app.put('/api/b/:slug/settings/funnel-bindings', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canManageCredentials(m)) return reply.code(403).send({ error: 'forbidden' })
    const body = FunnelBindingsPutSchema.parse(req.body)

    const integIds = new Set(
      (
        await db
          .select({ id: businessIntegrations.id })
          .from(businessIntegrations)
          .where(eq(businessIntegrations.businessId, m.businessId))
      ).map((r) => r.id),
    )

    for (const b of body.bindings) {
      const integrationId =
        b.provider === 'metricool' && b.integrationId && integIds.has(b.integrationId)
          ? b.integrationId
          : null
      const existing = (
        await db
          .select()
          .from(funnelBindings)
          .where(
            and(eq(funnelBindings.businessId, m.businessId), eq(funnelBindings.surface, b.surface)),
          )
          .limit(1)
      )[0]
      if (existing) {
        await db
          .update(funnelBindings)
          .set({
            provider: b.provider,
            status: b.status,
            integrationId,
            updatedAt: new Date(),
          })
          .where(
            and(eq(funnelBindings.businessId, m.businessId), eq(funnelBindings.surface, b.surface)),
          )
      } else {
        await db.insert(funnelBindings).values({
          businessId: m.businessId,
          surface: b.surface,
          provider: b.provider,
          status: b.status,
          integrationId,
        })
      }
    }

    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'settings.funnel_bindings_saved',
      meta: { count: body.bindings.length },
    })

    const bindings = await db
      .select()
      .from(funnelBindings)
      .where(eq(funnelBindings.businessId, m.businessId))
    return {
      ok: true,
      bindings: bindings.map((b) => ({
        surface: b.surface,
        provider: b.provider,
        status: b.status,
        integrationId: b.integrationId,
      })),
    }
  })
}
