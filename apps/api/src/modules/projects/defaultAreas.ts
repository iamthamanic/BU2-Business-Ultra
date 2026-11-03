/**
 * Default area projects seeded for every new company (Marketing, Kunden, Produkt).
 * Location: apps/api/src/modules/projects/defaultAreas.ts
 *
 * Seeded on company create. Missing defaults are backfilled by area key.
 * Archived/deleted areas are not re-created (archived rows still count).
 */
import { and, eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { projects } from '../../db/schema.js'

export const DEFAULT_AREA_DEFS = [
  {
    name: 'Marketing',
    area: 'marketing',
    description: 'Kampagnen, Kanäle und Content-Arbeit.',
  },
  {
    name: 'Kunden',
    area: 'kunden',
    description: 'CRM, Betreuung und Kundenprojekte.',
  },
  {
    name: 'Produkt',
    area: 'produkt',
    description: 'Produktentwicklung, Releases und Ops.',
  },
] as const

export async function seedDefaultAreaProjects(businessId: string, ownerUserId: string) {
  await db.insert(projects).values(
    DEFAULT_AREA_DEFS.map((d) => ({
      businessId,
      type: 'area' as const,
      name: d.name,
      description: d.description,
      area: d.area,
      ownerUserId,
      status: 'active' as const,
    })),
  )
}

/**
 * Insert any missing default areas (by `area` key).
 * Archived rows still count — user can remove all defaults permanently via archive.
 */
export async function ensureDefaultAreaProjectsIfEmpty(
  businessId: string,
  ownerUserId: string,
) {
  const existing = await db
    .select({ area: projects.area })
    .from(projects)
    .where(and(eq(projects.businessId, businessId), eq(projects.type, 'area')))
  const have = new Set(
    existing.map((r) => (r.area || '').trim().toLowerCase()).filter(Boolean),
  )
  const missing = DEFAULT_AREA_DEFS.filter((d) => !have.has(d.area))
  if (!missing.length) return false
  await db.insert(projects).values(
    missing.map((d) => ({
      businessId,
      type: 'area' as const,
      name: d.name,
      description: d.description,
      area: d.area,
      ownerUserId,
      status: 'active' as const,
    })),
  )
  return true
}
