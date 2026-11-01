import type { FastifyInstance } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { CheckMapBoardSchema, canMutateContent } from '@bu2/shared'
import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { db } from '../../db/client.js'
import { checkmapAttachments, checkmapBoards } from '../../db/schema.js'
import { loadMembership, requireUser } from '../../plugins/auth.js'
import { loadEnv } from '../../lib/env.js'
import { randomToken } from '../../lib/crypto.js'

export async function checkmapRoutes(app: FastifyInstance) {
  app.get('/api/b/:slug/checkmap', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const boards = await db
      .select()
      .from(checkmapBoards)
      .where(eq(checkmapBoards.businessId, m.businessId))
    return { boards }
  })

  app.post('/api/b/:slug/checkmap', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
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
    return { board }
  })

  app.post('/api/b/:slug/checkmap/:id/attachments', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const board = await db
      .select()
      .from(checkmapBoards)
      .where(and(eq(checkmapBoards.id, id), eq(checkmapBoards.businessId, m.businessId)))
      .limit(1)
    if (!board[0]) return reply.code(404).send({ error: 'not_found' })

    const file = await req.file()
    if (!file) return reply.code(400).send({ error: 'file_required' })
    const env = loadEnv()
    const dir = join(env.UPLOADS_DIR, m.businessId, 'checkmap', id)
    await mkdir(dir, { recursive: true })
    const safeName = file.filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const stored = `${randomToken(6)}-${safeName}`
    const storagePath = join(dir, stored)
    await pipeline(file.file, createWriteStream(storagePath))
    const [att] = await db
      .insert(checkmapAttachments)
      .values({
        businessId: m.businessId,
        boardId: id,
        nodeId: (file.fields as { nodeId?: { value?: string } })?.nodeId?.value,
        filename: safeName,
        mimeType: file.mimetype,
        sizeBytes: 0,
        storagePath,
        createdByUserId: user.id,
      })
      .returning()
    return {
      attachment: {
        ...att,
        url: `/uploads/${m.businessId}/checkmap/${id}/${stored}`,
      },
    }
  })
}
