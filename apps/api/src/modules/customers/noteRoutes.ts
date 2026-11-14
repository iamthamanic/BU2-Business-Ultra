/**
 * Customer notes HTTP — create/patch/delete.
 * Location: apps/api/src/modules/customers/noteRoutes.ts
 */
import type { FastifyInstance } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { CustomerNotePatchSchema, CustomerNoteSchema, hasPermission } from '@bu2/shared'
import { db } from '../../db/client.js'
import { customerNotes, users } from '../../db/schema.js'
import { loadMembership, requireUser } from '../../plugins/auth.js'
import { addEvent, loadCustomer, toNote } from './service.js'

export async function registerNoteRoutes(app: FastifyInstance) {
  app.post('/api/b/:slug/customers/:id/notes', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !hasPermission(m, 'customers.write')) return reply.code(403).send({ error: 'forbidden' })
    const existing = await loadCustomer(m.businessId, id)
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    const body = CustomerNoteSchema.parse(req.body)
    let parentNoteId: string | null = body.parentNoteId ?? null
    if (parentNoteId) {
      const [parent] = await db
        .select()
        .from(customerNotes)
        .where(and(eq(customerNotes.id, parentNoteId), eq(customerNotes.customerId, id)))
        .limit(1)
      if (!parent) return reply.code(400).send({ error: 'invalid_parent' })
      // One-level threads: replies always hang off the root note
      parentNoteId = parent.parentNoteId ?? parent.id
    }
    const [note] = await db
      .insert(customerNotes)
      .values({
        customerId: id,
        authorUserId: user.id,
        parentNoteId,
        body: body.body,
      })
      .returning()
    await addEvent(
      id,
      'note',
      parentNoteId ? 'Notiz-Antwort hinzugefügt' : 'Notiz hinzugefügt',
      user.id,
    )
    return reply.code(201).send({
      note: toNote(note!, user.displayName ?? null),
    })
  })

  app.patch('/api/b/:slug/customers/:id/notes/:noteId', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id, noteId } = req.params as { slug: string; id: string; noteId: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !hasPermission(m, 'customers.write')) return reply.code(403).send({ error: 'forbidden' })
    const existing = await loadCustomer(m.businessId, id)
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    const body = CustomerNotePatchSchema.parse(req.body)
    if (!body.body?.trim()) return reply.code(400).send({ error: 'invalid_body' })
    const [note] = await db
      .update(customerNotes)
      .set({ body: body.body.trim(), updatedAt: new Date() })
      .where(and(eq(customerNotes.id, noteId), eq(customerNotes.customerId, id)))
      .returning()
    if (!note) return reply.code(404).send({ error: 'not_found' })
    let authorDisplayName: string | null = user.displayName ?? null
    if (note.authorUserId && note.authorUserId !== user.id) {
      const [author] = await db
        .select({ displayName: users.displayName })
        .from(users)
        .where(eq(users.id, note.authorUserId))
        .limit(1)
      authorDisplayName = author?.displayName ?? null
    }
    await addEvent(id, 'note', 'Notiz bearbeitet', user.id)
    return { note: toNote(note, authorDisplayName) }
  })

  app.delete('/api/b/:slug/customers/:id/notes/:noteId', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id, noteId } = req.params as { slug: string; id: string; noteId: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !hasPermission(m, 'customers.write')) return reply.code(403).send({ error: 'forbidden' })
    const existing = await loadCustomer(m.businessId, id)
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    const [deleted] = await db
      .delete(customerNotes)
      .where(and(eq(customerNotes.id, noteId), eq(customerNotes.customerId, id)))
      .returning({ id: customerNotes.id })
    if (!deleted) return reply.code(404).send({ error: 'not_found' })
    await addEvent(id, 'note', 'Notiz gelöscht', user.id)
    return reply.code(204).send()
  })
}
