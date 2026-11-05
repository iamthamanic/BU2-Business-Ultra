import type { FastifyInstance } from 'fastify'
import { and, eq, isNull } from 'drizzle-orm'
import { canOpenSeo, canManageMembers } from '@bu2/shared'
import { z } from 'zod'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { db } from '../../db/client.js'
import {
  memberships,
  openseoHandoffs,
  openseoIdentities,
  openseoInstances,
  users,
} from '../../db/schema.js'
import { loadMembership, requireUser } from '../../plugins/auth.js'
import { hashToken, randomToken, safeEqualHex } from '../../lib/crypto.js'
import { loadEnv } from '../../lib/env.js'
import { writeAudit } from '../../lib/audit.js'
import { mapRole, editorCapabilities, verifyInternalSecret } from './service.js'

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
    const identity = (
      await db
        .select()
        .from(openseoIdentities)
        .where(
          and(eq(openseoIdentities.businessId, m.businessId), eq(openseoIdentities.userId, user.id)),
        )
        .limit(1)
    )[0]
    return {
      instance: rows[0] ?? { status: 'not_provisioned' },
      identity: identity ?? null,
      access: {
        role: m.role,
        grantSeoOpen: m.grantSeoOpen,
        roleMapped: mapRole(m.role),
        ...editorCapabilities(),
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
          note: 'On-demand provision — apply fork patch before enabling live SSO',
          capacityCheck: 'pending',
          image: 'ghcr.io/every-app/open-seo-standalone (digest pin required)',
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
    if (m.status === 'archived') {
      return reply.code(409).send({ error: 'business_archived' })
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
      ;[identity] = await db
        .insert(openseoIdentities)
        .values({
          businessId: m.businessId,
          userId: user.id,
          openseoUserRef: `bu2:${m.businessId}:${user.id}`,
          roleMapped: mapRole(m.role),
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
      meta: { identity: identity!.openseoUserRef, expiresAt: expiresAt.toISOString() },
    })
    const sig = createHmac('sha256', env.OPENSEO_SSO_SHARED_SECRET)
      .update(`${token}.${slug}`)
      .digest('hex')
    const launchUrl = `${env.OPENSEO_BASE_URL}/sso/bu2?token=${encodeURIComponent(token)}&business=${encodeURIComponent(slug)}&sig=${sig}`
    return {
      launchUrl,
      expiresAt: expiresAt.toISOString(),
      identity: identity!,
      capabilities: editorCapabilities(),
      note: 'Redeem via POST /api/internal/openseo/redeem — see openseo/SSO_CONTRACT.md + FORK_PATCH.md',
    }
  })

  /** Internal redeem — called by OpenSEO fork with shared secret. Single-use. */
  app.post('/api/internal/openseo/redeem', async (req, reply) => {
    if (!verifyInternalSecret(req.headers.authorization)) {
      return reply.code(401).send({ error: 'unauthorized' })
    }
    const body = z
      .object({
        token: z.string().min(16),
        businessSlug: z.string().min(2),
        sig: z.string().optional(),
      })
      .parse(req.body)
    const env = loadEnv()
    if (body.sig) {
      const expected = createHmac('sha256', env.OPENSEO_SSO_SHARED_SECRET)
        .update(`${body.token}.${body.businessSlug}`)
        .digest('hex')
      if (!safeEqualHex(expected, body.sig)) {
        return reply.code(401).send({ error: 'bad_signature' })
      }
    }
    const handoff = (
      await db
        .select()
        .from(openseoHandoffs)
        .where(and(eq(openseoHandoffs.tokenHash, hashToken(body.token)), isNull(openseoHandoffs.consumedAt)))
        .limit(1)
    )[0]
    if (!handoff || handoff.expiresAt.getTime() < Date.now()) {
      return reply.code(400).send({ error: 'invalid_or_expired' })
    }
    await db
      .update(openseoHandoffs)
      .set({ consumedAt: new Date() })
      .where(eq(openseoHandoffs.id, handoff.id))

    const membership = (
      await db
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.businessId, handoff.businessId),
            eq(memberships.userId, handoff.userId),
          ),
        )
        .limit(1)
    )[0]
    if (!membership) return reply.code(403).send({ error: 'membership_missing' })
    if (
      !canOpenSeo(
        membership.role as 'owner' | 'admin' | 'editor' | 'viewer',
        membership.grantSeoOpen,
      )
    ) {
      return reply.code(403).send({ error: 'seo_access_denied' })
    }
    const user = (await db.select().from(users).where(eq(users.id, handoff.userId)).limit(1))[0]
    const identity = (
      await db
        .select()
        .from(openseoIdentities)
        .where(
          and(
            eq(openseoIdentities.businessId, handoff.businessId),
            eq(openseoIdentities.userId, handoff.userId),
          ),
        )
        .limit(1)
    )[0]
    const caps = editorCapabilities()
    await writeAudit({
      businessId: handoff.businessId,
      actorUserId: handoff.userId,
      action: 'openseo.handoff_redeemed',
      resourceRef: identity?.openseoUserRef,
      meta: { businessSlug: body.businessSlug, roleMapped: identity?.roleMapped },
    })
    return {
      openseoUserRef: identity?.openseoUserRef ?? `bu2:${handoff.businessId}:${handoff.userId}`,
      email: user?.email,
      roleMapped: identity?.roleMapped ?? mapRole(membership.role),
      capabilities: caps.allowed,
      denied: caps.denied,
      businessId: handoff.businessId,
      actorUserId: handoff.userId,
    }
  })

  /** Actor-scoped mutation audit from OpenSEO fork. */
  app.post('/api/internal/openseo/audit', async (req, reply) => {
    if (!verifyInternalSecret(req.headers.authorization)) {
      return reply.code(401).send({ error: 'unauthorized' })
    }
    const body = z
      .object({
        businessId: z.string().uuid(),
        actorUserId: z.string().uuid(),
        openseoUserRef: z.string(),
        action: z.string().min(1).max(80),
        resourceRef: z.string().max(200).optional(),
        status: z.string().default('ok'),
        meta: z.record(z.unknown()).optional(),
      })
      .parse(req.body)
    await writeAudit({
      businessId: body.businessId,
      actorUserId: body.actorUserId,
      action: `openseo.actor.${body.action}`,
      resourceRef: body.resourceRef ?? body.openseoUserRef,
      status: body.status,
      meta: { ...body.meta, openseoUserRef: body.openseoUserRef },
    })
    return { ok: true }
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
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'openseo.grant_updated',
      resourceRef: userId,
      meta: body,
    })
    return { ok: true }
  })
}
