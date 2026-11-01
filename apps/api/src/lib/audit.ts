import { db } from '../db/client.js'
import { auditLog } from '../db/schema.js'

export async function writeAudit(input: {
  businessId?: string | null
  actorUserId?: string | null
  action: string
  resourceRef?: string
  status?: string
  meta?: Record<string, unknown>
}) {
  await db.insert(auditLog).values({
    businessId: input.businessId ?? null,
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    resourceRef: input.resourceRef,
    status: input.status ?? 'ok',
    meta: input.meta ?? {},
  })
}
