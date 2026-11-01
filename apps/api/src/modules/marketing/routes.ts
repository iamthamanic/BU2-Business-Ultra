import type { FastifyInstance } from 'fastify'
import { and, eq, isNull } from 'drizzle-orm'
import {
  ConfirmMutationSchema,
  SocialMasterDraftSchema,
  SocialNetworkSchema,
  canMutateContent,
  canSendMail,
} from '@bu2/shared'
import { z } from 'zod'
import { db } from '../../db/client.js'
import { brevoCampaigns, socialDrafts } from '../../db/schema.js'
import { loadMembership, requireUser } from '../../plugins/auth.js'
import { getBusinessSecret } from '../../lib/secrets.js'
import { writeAudit } from '../../lib/audit.js'
import {
  NETWORK_CAPABILITIES,
  listBrands,
  retryFailedTargets,
  scheduleTargets,
  type MetricoolNetwork,
  type ScheduleTarget,
} from '../../lib/integrations/metricool.js'
import { createEmailCampaign, sendEmailCampaignNow } from '../../lib/integrations/brevo.js'
import { loadEnv } from '../../lib/env.js'
import {
  emptyOrganicPosts,
  isOrganicChannel,
  organicSurface,
  resolveFunnelSource,
} from '../../lib/funnel-source.js'

export async function marketingRoutes(app: FastifyInstance) {
  app.get('/api/b/:slug/marketing/capabilities', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    return { networks: NETWORK_CAPABILITIES }
  })

  /**
   * Funnel connector status for a surface (`organic.instagram`, `paid.meta`, …).
   * Response: { surface, provider, status, implemented, keyReady, brandsLinked,
   *   blogIds, integrationId, brandLabel, contentReady, needs, message? }
   */
  app.get('/api/b/:slug/marketing/funnel-source/:surface', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, surface } = req.params as { slug: string; surface: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const decoded = decodeURIComponent(surface)
    return resolveFunnelSource(m.businessId, decoded)
  })

  /**
   * Organic channel depth — connector + posts table payload (Legacy IA).
   * Posts array is empty stub until live Metricool analytics sync exists;
   * shape matches Legacy dashboard columns so the UI stays honest.
   * Response: { channel, surface, connector, posts, window, mode, generatedAt }
   */
  app.get('/api/b/:slug/marketing/funnel/organic/:channel', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, channel } = req.params as { slug: string; channel: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const ch = channel.toLowerCase()
    if (!isOrganicChannel(ch)) {
      return reply.code(400).send({ error: 'unknown_channel', channel: ch })
    }
    const surface = organicSurface(ch)
    const connector = await resolveFunnelSource(m.businessId, surface)
    const q = req.query as { window?: string }
    const window = ['24h', '7d', '30d', 'all'].includes(q.window || '') ? q.window! : '30d'
    return {
      channel: ch,
      surface,
      connector,
      posts: emptyOrganicPosts(),
      window,
      mode: 'stub' as const,
      generatedAt: new Date().toISOString(),
    }
  })

  app.get('/api/b/:slug/marketing/brands', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const secret = await getBusinessSecret(m.businessId, 'metricool')
    if (!secret?.valid) return reply.code(409).send({ error: 'metricool_key_required' })
    const brands = await listBrands(secret.plaintext)
    return brands
  })

  app.get('/api/b/:slug/marketing/drafts', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const drafts = await db
      .select()
      .from(socialDrafts)
      .where(and(eq(socialDrafts.businessId, m.businessId), isNull(socialDrafts.archivedAt)))
    return { drafts }
  })

  app.post('/api/b/:slug/marketing/drafts', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const body = SocialMasterDraftSchema.parse(req.body)
    const [draft] = await db
      .insert(socialDrafts)
      .values({
        businessId: m.businessId,
        title: body.title,
        masterText: body.masterText,
        variants: body.variants,
        createdByUserId: user.id,
      })
      .returning()
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'social.draft_created',
      resourceRef: draft!.id,
    })
    return { draft }
  })

  app.patch('/api/b/:slug/marketing/drafts/:id', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const body = SocialMasterDraftSchema.partial().parse(req.body)
    const [draft] = await db
      .update(socialDrafts)
      .set({
        ...(body.title != null ? { title: body.title } : {}),
        ...(body.masterText != null ? { masterText: body.masterText } : {}),
        ...(body.variants != null ? { variants: body.variants } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(socialDrafts.id, id), eq(socialDrafts.businessId, m.businessId)))
      .returning()
    if (!draft) return reply.code(404).send({ error: 'not_found' })
    return { draft }
  })

  app.post('/api/b/:slug/marketing/drafts/:id/schedule', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const body = ConfirmMutationSchema.extend({
      onlyNetworks: z.array(SocialNetworkSchema).optional(),
      blogId: z.string().optional(),
      userId: z.string().optional(),
    }).parse(req.body)
    const secret = await getBusinessSecret(m.businessId, 'metricool')
    if (!secret?.valid) {
      return reply.code(409).send({ error: 'metricool_key_required', gate: 'metricool' })
    }
    const rows = await db
      .select()
      .from(socialDrafts)
      .where(and(eq(socialDrafts.id, id), eq(socialDrafts.businessId, m.businessId)))
      .limit(1)
    const draft = rows[0]
    if (!draft) return reply.code(404).send({ error: 'not_found' })

    const targets = (draft.variants as ScheduleTarget[]).map((v) => ({
      ...v,
      text: v.text ?? draft.masterText,
    }))

    const scheduled = await scheduleTargets({
      apiKey: secret.plaintext,
      blogId: body.blogId,
      userId: body.userId,
      masterText: draft.masterText,
      title: draft.title,
      targets,
      onlyNetworks: body.onlyNetworks as MetricoolNetwork[] | undefined,
    })

    const remoteStatus: Record<string, unknown> = {
      ...(typeof draft.remoteStatus === 'object' && draft.remoteStatus ? draft.remoteStatus : {}),
    }
    for (const r of scheduled.results) {
      remoteStatus[r.network] = r
    }

    await db
      .update(socialDrafts)
      .set({ remoteStatus, updatedAt: new Date() })
      .where(eq(socialDrafts.id, draft.id))
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'social.post_scheduled',
      resourceRef: draft.id,
      meta: { mode: scheduled.mode, results: scheduled.results.map((r) => ({ network: r.network, status: r.status })) },
    })
    return { ok: true, mode: scheduled.mode, results: scheduled.results, remoteStatus }
  })

  app.post('/api/b/:slug/marketing/drafts/:id/retry', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    ConfirmMutationSchema.parse(req.body)
    const secret = await getBusinessSecret(m.businessId, 'metricool')
    if (!secret?.valid) return reply.code(409).send({ error: 'metricool_key_required' })
    const draft = (
      await db
        .select()
        .from(socialDrafts)
        .where(and(eq(socialDrafts.id, id), eq(socialDrafts.businessId, m.businessId)))
        .limit(1)
    )[0]
    if (!draft) return reply.code(404).send({ error: 'not_found' })
    const previous = (draft.remoteStatus ?? {}) as Record<string, { status?: string; retryable?: boolean }>
    const retried = await retryFailedTargets({
      apiKey: secret.plaintext,
      masterText: draft.masterText,
      title: draft.title,
      targets: draft.variants as ScheduleTarget[],
      previous,
    })
    const remoteStatus = { ...previous } as Record<string, unknown>
    for (const r of retried.results) remoteStatus[r.network] = r
    await db
      .update(socialDrafts)
      .set({ remoteStatus, updatedAt: new Date() })
      .where(eq(socialDrafts.id, draft.id))
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'social.retry_targets',
      resourceRef: draft.id,
      meta: { mode: retried.mode },
    })
    return { ok: true, mode: retried.mode, results: retried.results }
  })

  app.get('/api/b/:slug/marketing/brevo', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const campaigns = await db
      .select()
      .from(brevoCampaigns)
      .where(eq(brevoCampaigns.businessId, m.businessId))
    return { campaigns }
  })

  app.post('/api/b/:slug/marketing/brevo', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const body = z
      .object({
        name: z.string().min(1),
        subject: z.string().min(1),
        htmlContent: z.string().min(1),
      })
      .parse(req.body)
    const [campaign] = await db
      .insert(brevoCampaigns)
      .values({
        businessId: m.businessId,
        name: body.name,
        subject: body.subject,
        htmlContent: body.htmlContent,
        createdByUserId: user.id,
      })
      .returning()
    return { campaign }
  })

  app.post('/api/b/:slug/marketing/brevo/:id/send', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canSendMail(m.role)) return reply.code(403).send({ error: 'forbidden_mail_send' })
    ConfirmMutationSchema.parse(req.body)
    const secret = await getBusinessSecret(m.businessId, 'brevo')
    if (!secret?.valid) return reply.code(409).send({ error: 'brevo_key_required', gate: 'brevo' })
    const campaign = (
      await db
        .select()
        .from(brevoCampaigns)
        .where(and(eq(brevoCampaigns.id, id), eq(brevoCampaigns.businessId, m.businessId)))
        .limit(1)
    )[0]
    if (!campaign) return reply.code(404).send({ error: 'not_found' })

    const env = loadEnv()
    let remoteId = campaign.remoteId
    let createMode: 'live' | 'stub' = campaign.remoteId ? 'live' : 'stub'
    if (!remoteId) {
      const created = await createEmailCampaign(secret.plaintext, {
        name: campaign.name,
        subject: campaign.subject ?? campaign.name,
        htmlContent: campaign.htmlContent ?? '<p></p>',
        sender: { name: env.BREVO_SENDER_NAME, email: env.BREVO_SENDER_EMAIL },
      })
      remoteId = created.remoteId
      createMode = created.mode
    }
    const sent = await sendEmailCampaignNow(secret.plaintext, remoteId!)
    const status =
      sent.mode === 'live' && sent.ok ? 'sent' : sent.ok ? 'send_stubbed' : 'send_failed'
    await db
      .update(brevoCampaigns)
      .set({ status, remoteId, updatedAt: new Date() })
      .where(eq(brevoCampaigns.id, campaign.id))
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'brevo.send_confirmed',
      resourceRef: campaign.id,
      status: sent.ok ? 'ok' : 'failed',
      meta: { createMode, sendMode: sent.mode, detail: sent.detail },
    })
    return { ok: sent.ok, mode: sent.mode, remoteId, status }
  })
}
