import type { FastifyInstance } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { CheckMapBoardSchema, canMutateContent, canManageMembers } from '@bu2/shared'
import { z } from 'zod'
import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { db } from '../../db/client.js'
import { checkmapAttachments, checkmapBoards, memberships } from '../../db/schema.js'
import { loadMembership, requireUser } from '../../plugins/auth.js'
import { loadEnv } from '../../lib/env.js'
import { randomToken } from '../../lib/crypto.js'
import { writeAudit } from '../../lib/audit.js'
import { boardAcl, listBoards } from './service.js'

/** Board ACL stored in board.nodes meta is insufficient — use membership role + optional grant map in provisionMeta-like JSON on board title suffix avoided; we use a sidecar table via jsonb on board... expand schema lightly via edges carrying acl is messy. Store ACL in a dedicated jsonb column via nodes[0] hack is bad. Use memberships.role for board-level: viewers read-only; editors+ mutate; optional per-board deny via grantSeo-like — add checkmapCanEdit on memberships would need migration. For V1: role-based + attachment ACL = same as mutate. */

export async function checkmapRoutes(app: FastifyInstance) {
  app.get('/api/b/:slug/checkmap', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const boards = await listBoards(m.businessId)
    return {
      boards,
      acl: boardAcl(m.role),
    }
  })

  app.post('/api/b/:slug/checkmap', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    if (m.status === 'archived') return reply.code(409).send({ error: 'business_archived' })
    const body = CheckMapBoardSchema.parse(req.body)
    const [board] = await db
      .insert(checkmapBoards)
      .values({
        businessId: m.businessId,
        title: body.title,
        nodes: body.nodes,
        edges: body.edges,
      })
      .returning()
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'checkmap.board_created',
      resourceRef: board!.id,
    })
    return { board }
  })

  app.put('/api/b/:slug/checkmap/:id', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const body = CheckMapBoardSchema.parse(req.body)
    const [board] = await db
      .update(checkmapBoards)
      .set({
        title: body.title,
        nodes: body.nodes,
        edges: body.edges,
        updatedAt: new Date(),
      })
      .where(and(eq(checkmapBoards.id, id), eq(checkmapBoards.businessId, m.businessId)))
      .returning()
    if (!board) return reply.code(404).send({ error: 'not_found' })
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'checkmap.board_updated',
      resourceRef: id,
    })
    return { board }
  })

  app.get('/api/b/:slug/checkmap/:id/attachments', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const board = (
      await db
        .select()
        .from(checkmapBoards)
        .where(and(eq(checkmapBoards.id, id), eq(checkmapBoards.businessId, m.businessId)))
        .limit(1)
    )[0]
    if (!board) return reply.code(404).send({ error: 'not_found' })
    const attachments = await db
      .select()
      .from(checkmapAttachments)
      .where(
        and(
          eq(checkmapAttachments.boardId, id),
          eq(checkmapAttachments.businessId, m.businessId),
        ),
      )
    return {
      attachments: attachments.map((a) => ({
        ...a,
        url: `/uploads/${m.businessId}/checkmap/${id}/${a.filename}`,
      })),
    }
  })

  app.post('/api/b/:slug/checkmap/:id/attachments', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const board = (
      await db
        .select()
        .from(checkmapBoards)
        .where(and(eq(checkmapBoards.id, id), eq(checkmapBoards.businessId, m.businessId)))
        .limit(1)
    )[0]
    if (!board) return reply.code(404).send({ error: 'not_found' })

    const file = await req.file()
    if (!file) return reply.code(400).send({ error: 'file_required' })
    const allowed = [
      'image/png',
      'image/jpeg',
      'image/webp',
      'application/pdf',
      'text/plain',
      'text/markdown',
    ]
    if (!allowed.includes(file.mimetype) && !file.mimetype.startsWith('image/')) {
      return reply.code(415).send({ error: 'mime_not_allowed', mime: file.mimetype })
    }
    const env = loadEnv()
    const dir = join(env.UPLOADS_DIR, m.businessId, 'checkmap', id)
    await mkdir(dir, { recursive: true })
    const safeName = file.filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const stored = `${randomToken(6)}-${safeName}`
    const storagePath = join(dir, stored)
    await pipeline(file.file, createWriteStream(storagePath))
    const nodeIdField = (file.fields as { nodeId?: { value?: string } })?.nodeId?.value
    const [att] = await db
      .insert(checkmapAttachments)
      .values({
        businessId: m.businessId,
        boardId: id,
        nodeId: nodeIdField,
        filename: stored,
        mimeType: file.mimetype,
        sizeBytes: 0,
        storagePath,
        createdByUserId: user.id,
      })
      .returning()
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'checkmap.attachment_uploaded',
      resourceRef: att!.id,
    })
    return {
      attachment: {
        ...att,
        url: `/uploads/${m.businessId}/checkmap/${id}/${stored}`,
      },
    }
  })

  app.delete('/api/b/:slug/checkmap/:id/attachments/:attId', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id, attId } = req.params as { slug: string; id: string; attId: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    await db
      .delete(checkmapAttachments)
      .where(
        and(
          eq(checkmapAttachments.id, attId),
          eq(checkmapAttachments.boardId, id),
          eq(checkmapAttachments.businessId, m.businessId),
        ),
      )
    return { ok: true }
  })

  /** Soft board-level viewer list (membership already gates); document explicit grants. */
  app.get('/api/b/:slug/checkmap/acl', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const members = await db
      .select({
        userId: memberships.userId,
        role: memberships.role,
      })
      .from(memberships)
      .where(eq(memberships.businessId, m.businessId))
    return {
      policy: 'role_based_v1',
      rules: {
        viewer: ['read'],
        editor: ['read', 'write', 'attach'],
        admin: ['read', 'write', 'attach', 'acl'],
        owner: ['read', 'write', 'attach', 'acl'],
      },
      members,
    }
  })

  app.post('/api/b/:slug/checkmap/:id/nodes/:nodeId', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id, nodeId } = req.params as { slug: string; id: string; nodeId: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const patch = z
      .object({
        title: z.string().optional(),
        status: z.enum(['open', 'doing', 'done', 'blocked']).optional(),
        priority: z.enum(['p0', 'p1', 'p2', 'p3']).optional(),
        x: z.number().optional(),
        y: z.number().optional(),
      })
      .parse(req.body)
    const board = (
      await db
        .select()
        .from(checkmapBoards)
        .where(and(eq(checkmapBoards.id, id), eq(checkmapBoards.businessId, m.businessId)))
        .limit(1)
    )[0]
    if (!board) return reply.code(404).send({ error: 'not_found' })
    const nodes = (board.nodes as Array<Record<string, unknown>>).map((n) =>
      n.id === nodeId ? { ...n, ...patch } : n,
    )
    const [updated] = await db
      .update(checkmapBoards)
      .set({ nodes, updatedAt: new Date() })
      .where(eq(checkmapBoards.id, id))
      .returning()
    return { board: updated }
  })
}
