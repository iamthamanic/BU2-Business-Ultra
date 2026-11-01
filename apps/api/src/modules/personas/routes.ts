import type { FastifyInstance } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { PersonaSchema, canMutateContent } from '@bu2/shared'
import { db } from '../../db/client.js'
import { personas } from '../../db/schema.js'
import { loadMembership, requireUser } from '../../plugins/auth.js'

function personaPdfText(p: {
  name: string
  summary: string | null
  goals: string[] | null
  pains: string[] | null
  channels: string[] | null
}): string {
  return [
    `Persona: ${p.name}`,
    '',
    p.summary ?? '',
    '',
    'Goals:',
    ...(p.goals ?? []).map((g) => `- ${g}`),
    '',
    'Pains:',
    ...(p.pains ?? []).map((g) => `- ${g}`),
    '',
    'Channels:',
    ...(p.channels ?? []).map((g) => `- ${g}`),
  ].join('\n')
}

/** Minimal valid single-page PDF with embedded text stream. */
function buildSimplePdf(text: string): Buffer {
  const escaped = text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  const lines = escaped.split('\n').slice(0, 40)
  const content = [`BT /F1 11 Tf 50 780 Td`, ...lines.map((l, i) => (i === 0 ? `(${l}) Tj` : `0 -14 Td (${l}) Tj`)), 'ET'].join(
    '\n',
  )
  const objects: string[] = []
  objects.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj')
  objects.push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj')
  objects.push(
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj',
  )
  objects.push(`4 0 obj<< /Length ${Buffer.byteLength(content)} >>stream\n${content}\nendstream endobj`)
  objects.push('5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj')
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = [0]
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf))
    pdf += obj + '\n'
  }
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf)
}

export async function personasRoutes(app: FastifyInstance) {
  app.get('/api/b/:slug/personas', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const rows = await db.select().from(personas).where(eq(personas.businessId, m.businessId))
    return { personas: rows }
  })

  app.post('/api/b/:slug/personas', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const body = PersonaSchema.parse(req.body)
    const [row] = await db
      .insert(personas)
      .values({
        businessId: m.businessId,
        name: body.name,
        summary: body.summary,
        goals: body.goals,
        pains: body.pains,
        channels: body.channels,
        journey: body.journey,
      })
      .returning()
    return { persona: row }
  })

  app.get('/api/b/:slug/personas/:id/pdf', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const rows = await db
      .select()
      .from(personas)
      .where(and(eq(personas.id, id), eq(personas.businessId, m.businessId)))
      .limit(1)
    const p = rows[0]
    if (!p) return reply.code(404).send({ error: 'not_found' })
    const pdf = buildSimplePdf(personaPdfText(p))
    return reply
      .header('content-type', 'application/pdf')
      .header('content-disposition', `attachment; filename="persona-${p.name}.pdf"`)
      .send(pdf)
  })
}
