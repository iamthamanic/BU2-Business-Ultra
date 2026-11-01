import type { FastifyInstance } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { AdsCampaignDraftSchema, ConfirmMutationSchema, canMutateContent } from '@bu2/shared'
import type { SecretProvider } from '@bu2/shared'
import { db } from '../../db/client.js'
import { adsCampaigns } from '../../db/schema.js'
import { loadMembership, requireUser } from '../../plugins/auth.js'
import { getBusinessSecret } from '../../lib/secrets.js'
import { writeAudit } from '../../lib/audit.js'
import { mutateAds, type AdsProvider } from '../../lib/integrations/ads.js'

const providerGate: Record<string, SecretProvider> = {
  google_ads: 'google_ads',
  meta_ads: 'meta_ads',
  tiktok_ads: 'tiktok_ads',
  chatgpt_ads: 'chatgpt_ads',
}

export async function adsRoutes(app: FastifyInstance) {
  app.get('/api/b/:slug/ads', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const campaigns = await db
      .select()
      .from(adsCampaigns)
      .where(eq(adsCampaigns.businessId, m.businessId))
    return { campaigns }
  })

  app.post('/api/b/:slug/ads', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const body = AdsCampaignDraftSchema.parse(req.body)
    const gate = providerGate[body.provider]
    const secret = gate ? await getBusinessSecret(m.businessId, gate) : null
    if (!secret?.valid) {
      return reply.code(409).send({ error: 'provider_key_required', gate: body.provider })
    }
    const [campaign] = await db
      .insert(adsCampaigns)
      .values({
        businessId: m.businessId,
        provider: body.provider,
        name: body.name,
        budgetDailyCents: body.budgetDailyCents,
        objective: body.objective,
        payload: body.payload,
        createdByUserId: user.id,
      })
      .returning()
    return { campaign }
  })

  app.post('/api/b/:slug/ads/:id/publish', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    ConfirmMutationSchema.parse(req.body)
    const campaign = (
      await db
        .select()
        .from(adsCampaigns)
        .where(and(eq(adsCampaigns.id, id), eq(adsCampaigns.businessId, m.businessId)))
        .limit(1)
    )[0]
    if (!campaign) return reply.code(404).send({ error: 'not_found' })
    const gate = providerGate[campaign.provider]
    if (!gate) return reply.code(400).send({ error: 'unknown_provider' })
    const secret = await getBusinessSecret(m.businessId, gate)
    if (!secret?.valid) {
      return reply.code(409).send({ error: 'provider_key_required', gate: campaign.provider })
    }
    const result = await mutateAds(campaign.provider as AdsProvider, secret.plaintext, {
      name: campaign.name,
      budgetDailyCents: campaign.budgetDailyCents,
      objective: campaign.objective,
      payload: campaign.payload ?? {},
    })
    await db
      .update(adsCampaigns)
      .set({
        status: result.status,
        remoteId: result.remoteId,
        updatedAt: new Date(),
      })
      .where(eq(adsCampaigns.id, campaign.id))
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'ads.publish_confirmed',
      resourceRef: campaign.id,
      meta: { provider: campaign.provider, mode: result.mode, detail: result.detail },
    })
    return { ok: true, ...result }
  })
}
