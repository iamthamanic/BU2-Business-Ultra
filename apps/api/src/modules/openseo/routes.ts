import type { FastifyInstance } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { canOpenSeo, canManageMembers } from '@bu2/shared'
import { z } from 'zod'
import { db } from '../../db/client.js'
import { memberships, openseoHandoffs, openseoIdentities, openseoInstances } from '../../db/schema.js'
import { loadMembership, requireUser } from '../../plugins/auth.js'
import { hashToken, randomToken } from '../../lib/crypto.js'
import { loadEnv } from '../../lib/env.js'
import { writeAudit } from '../../lib/audit.js'

/**
 * OpenSEO SSO handoff stubs (Q-035/Q-040/Q-046).
 * Real upstream bridge requires fork/patch — see /openseo/README.md.
 */
export async function openseoRoutes(app: FastifyInstance) {
  app.get('/api/b/:slug/openseo', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    if (!canOpenSeo(m.role, m.grantSeoOpen)) {
      return reply.code(403).send({ error: 'seo_access_denied' })
    }
    const rows = await db
      .select()
      .from(openseoInstances)
      .where(eq(openseoInstances.businessId, m.businessId))
      .limit(1)
    return {
      instance: rows[0] ?? { status: 'not_provisioned' },
      access: {
        role: m.role,
        grantSeoOpen: m.grantSeoOpen,
        editorCapabilities: ['research', 'analyze', 'audit', 'reports'],
        denied: ['team_admin', 'credentials', 'global_integrations', 'budgets', 'irreversible_delete'],
      },
    }
  })

  app.post('/api/b/:slug/openseo/provision', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canManageMembers(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const env = loadEnv()
    const existing = await db
      .select()
      .from(openseoInstances)
      .where(eq(openseoInstances.businessId, m.businessId))
      .limit(1)
    if (existing[0]) return { instance: existing[0] }
    const [inst] = await db
      .insert(openseoInstances)
      .values({
        businessId: m.businessId,
        status: 'provision_stubbed',
        baseUrl: `${env.OPENSEO_BASE_URL}/b/${slug}`,
        provisionMeta: {
          note: 'On-demand provision stub — pin digest image via openseo/docker-compose.yml',
          capacityCheck: 'pending',
        },
      })
      .returning()
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'openseo.provision_stubbed',
      resourceRef: inst!.id,
    })
    return { instance: inst }
  })

  app.post('/api/b/:slug/openseo/handoff', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    if (!canOpenSeo(m.role, m.grantSeoOpen)) {
      return reply.code(403).send({ error: 'seo_access_denied' })
    }
    const env = loadEnv()
    let identity = (
      await db
        .select()
        .from(openseoIdentities)
        .where(
          and(eq(openseoIdentities.businessId, m.businessId), eq(openseoIdentities.userId, user.id)),
        )
        .limit(1)
    )[0]
    if (!identity) {
      const roleMapped =
        m.role === 'owner' || m.role === 'admin' ? 'admin' : m.role === 'editor' ? 'member' : 'viewer'
      ;[identity] = await db
        .insert(openseoIdentities)
        .values({
          businessId: m.businessId,
          userId: user.id,
          openseoUserRef: `bu2:${m.businessId}:${user.id}`,
          roleMapped,
        })
        .returning()
    }
    const token = randomToken(24)
    const expiresAt = new Date(Date.now() + 60_000)
    await db.insert(openseoHandoffs).values({
      businessId: m.businessId,
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt,
    })
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'openseo.handoff_created',
      meta: { identity: identity!.openseoUserRef },
    })
    const launchUrl = `${env.OPENSEO_BASE_URL}/sso/bu2?token=${encodeURIComponent(token)}&business=${encodeURIComponent(slug)}`
    return {
      launchUrl,
      expiresAt: expiresAt.toISOString(),
      identity: identity!,
      stub: true,
      note: 'SSO consumer endpoint must be implemented in OpenSEO fork — see openseo/SSO_CONTRACT.md',
    }
  })

  app.post('/api/b/:slug/openseo/grants/:userId', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, userId } = req.params as { slug: string; userId: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canManageMembers(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const body = z.object({ grantSeoOpen: z.boolean() }).parse(req.body)
    await db
      .update(memberships)
      .set({ grantSeoOpen: body.grantSeoOpen })
      .where(and(eq(memberships.businessId, m.businessId), eq(memberships.userId, userId)))
    return { ok: true }
  })
}
