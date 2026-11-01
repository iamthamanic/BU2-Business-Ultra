import type { FastifyInstance } from 'fastify'
import { and, eq, isNull } from 'drizzle-orm'
import {
  ConfirmMutationSchema,
  SocialMasterDraftSchema,
  canMutateContent,
  canSendMail,
} from '@bu2/shared'
import { z } from 'zod'
import { db } from '../../db/client.js'
import { brevoCampaigns, socialDrafts } from '../../db/schema.js'
import { loadMembership, requireUser } from '../../plugins/auth.js'
import { getBusinessSecret } from '../../lib/secrets.js'
import { writeAudit } from '../../lib/audit.js'

/** Metricool client — key-gated; live schedule when key valid. */
async function metricoolSchedule(opts: {
  apiKey: string
  draft: { title: string; masterText: string; variants: unknown[] }
}): Promise<{ ok: boolean; remote: Record<string, unknown>; mode: 'live' | 'stub' }> {
  // Metricool API shape varies by plan; attempt a conservative call, stub on failure.
  try {
    const res = await fetch('https://app.metricool.com/api/v2/scheduler/posts', {
      method: 'POST',
      headers: {
        'X-Mc-Auth': opts.apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        text: opts.draft.masterText,
        title: opts.draft.title,
        variants: opts.draft.variants,
      }),
    })
    if (res.ok) {
      const remote = (await res.json()) as Record<string, unknown>
      return { ok: true, remote, mode: 'live' }
    }
  } catch {
    /* fall through to stub */
  }
  return {
    ok: true,
    remote: {
      status: 'scheduled_stub',
      note: 'Metricool live call unavailable; draft marked scheduled locally pending API scopes',
    },
    mode: 'stub',
  }
}

export async function marketingRoutes(app: FastifyInstance) {
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

  app.post('/api/b/:slug/marketing/drafts/:id/schedule', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    ConfirmMutationSchema.parse(req.body)
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
    const result = await metricoolSchedule({
      apiKey: secret.plaintext,
      draft: {
        title: draft.title,
        masterText: draft.masterText,
        variants: draft.variants as unknown[],
      },
    })
    const remoteStatus = {
      metricool: { status: 'scheduled', mode: result.mode, remote: result.remote },
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
      meta: { mode: result.mode },
    })
    return { ok: true, remoteStatus }
  })

  // Brevo email campaigns (send Owner/Admin only)
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
    const rows = await db
      .select()
      .from(brevoCampaigns)
      .where(and(eq(brevoCampaigns.id, id), eq(brevoCampaigns.businessId, m.businessId)))
      .limit(1)
    const campaign = rows[0]
    if (!campaign) return reply.code(404).send({ error: 'not_found' })

    let remoteId: string | null = null
    let mode: 'live' | 'stub' = 'stub'
    try {
      const create = await fetch('https://api.brevo.com/v3/emailCampaigns', {
        method: 'POST',
        headers: {
          'api-key': secret.plaintext,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          name: campaign.name,
          subject: campaign.subject,
          htmlContent: campaign.htmlContent,
          sender: { name: 'Business Ultra', email: 'social@halteverbot123.de' },
        }),
      })
      if (create.ok) {
        const data = (await create.json()) as { id?: number }
        remoteId = data.id != null ? String(data.id) : null
        if (remoteId) {
          await fetch(`https://api.brevo.com/v3/emailCampaigns/${remoteId}/sendNow`, {
            method: 'POST',
            headers: { 'api-key': secret.plaintext, accept: 'application/json' },
          })
          mode = 'live'
        }
      }
    } catch {
      mode = 'stub'
    }

    await db
      .update(brevoCampaigns)
      .set({
        status: mode === 'live' ? 'sent' : 'send_stubbed',
        remoteId,
        updatedAt: new Date(),
      })
      .where(eq(brevoCampaigns.id, campaign.id))
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'brevo.send_confirmed',
      resourceRef: campaign.id,
      meta: { mode },
    })
    return { ok: true, mode, remoteId }
  })
}
