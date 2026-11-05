/**
 * Checkmap domain helpers.
 * Location: apps/api/src/modules/checkmap/service.ts
 */
import { eq } from 'drizzle-orm'
import type { Role } from '@bu2/shared'
import { canManageMembers, canMutateContent } from '@bu2/shared'
import { db } from '../../db/client.js'
import { checkmapBoards } from '../../db/schema.js'

export async function listBoards(businessId: string) {
  return db.select().from(checkmapBoards).where(eq(checkmapBoards.businessId, businessId))
}

export function boardAcl(role: Role) {
  return {
    canEdit: canMutateContent(role),
    canManageAcl: canManageMembers(role),
    role,
  }
}
