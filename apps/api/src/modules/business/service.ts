/**
 * Business domain helpers.
 * Location: apps/api/src/modules/business/service.ts
 */
import { eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { businesses, memberships } from '../../db/schema.js'

export async function listBusinessesForUser(userId: string) {
  return db
    .select({
      id: businesses.id,
      name: businesses.name,
      slug: businesses.slug,
      status: businesses.status,
      role: memberships.role,
      logoPath: businesses.logoPath,
    })
    .from(memberships)
    .innerJoin(businesses, eq(memberships.businessId, businesses.id))
    .where(eq(memberships.userId, userId))
}
