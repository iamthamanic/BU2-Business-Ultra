/**
 * Marketing domain helpers.
 * Location: apps/api/src/modules/marketing/service.ts
 */
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { socialDrafts } from '../../db/schema.js'

export async function listSocialDrafts(businessId: string) {
  return db
    .select()
    .from(socialDrafts)
    .where(and(eq(socialDrafts.businessId, businessId), isNull(socialDrafts.archivedAt)))
}
