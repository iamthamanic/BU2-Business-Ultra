/**
 * Shared installation bootstrap: first user + platform grant + first company.
 * Used by CLI (`pnpm setup`) and first-run web wizard.
 * Location: apps/api/src/modules/auth/bootstrap.ts
 */
import { eq, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { BootstrapSetupSchema, type BootstrapSetupInput } from '@bu2/shared'
import { db } from '../../db/client.js'
import {
  baAccount,
  baUser,
  businesses,
  memberships,
  platformGrants,
  users,
} from '../../db/schema.js'
import { seedSystemBundles } from '../../lib/authorize.js'
import { writeAudit } from '../../lib/audit.js'
import { hashPassword } from '../../lib/password.js'
import { seedDefaultAreaProjects } from '../projects/defaultAreas.js'

export async function isBootstrapRequired(): Promise<boolean> {
  const rows = await db.select({ c: sql<number>`count(*)::int` }).from(users)
  return (rows[0]?.c ?? 0) === 0
}

export async function runBootstrap(raw: BootstrapSetupInput) {
  const input = BootstrapSetupSchema.parse(raw)
  const needed = await isBootstrapRequired()
  if (!needed) {
    const err = new Error('Bootstrap already completed') as Error & { statusCode: number }
    err.statusCode = 409
    throw err
  }

  const email = input.email.toLowerCase()
  const displayName = input.displayName?.trim() || email.split('@')[0] || 'Owner'
  const userId = randomUUID()
  const passwordHash = await hashPassword(input.password)

  await db.insert(baUser).values({
    id: userId,
    name: displayName,
    email,
    emailVerified: true,
  })
  await db.insert(baAccount).values({
    id: randomUUID(),
    accountId: userId,
    providerId: 'credential',
    userId,
    password: passwordHash,
  })
  await db.insert(users).values({
    id: userId,
    email,
    displayName,
    emailVerified: true,
  })

  await db.insert(platformGrants).values({
    userId,
    capabilityKey: 'companies.create',
    createdByUserId: userId,
  })

  const [biz] = await db
    .insert(businesses)
    .values({
      name: input.companyName,
      slug: input.companySlug,
      createdByUserId: userId,
    })
    .returning()
  if (!biz) throw new Error('Failed to create business')

  await db.insert(memberships).values({
    businessId: biz.id,
    userId,
    isOwner: true,
    status: 'active',
  })
  await seedSystemBundles(biz.id)
  await seedDefaultAreaProjects(biz.id, userId)

  await writeAudit({
    businessId: biz.id,
    actorUserId: userId,
    action: 'bootstrap.completed',
    resourceRef: biz.slug,
    meta: { email },
  })

  return {
    user: { id: userId, email, displayName },
    business: { id: biz.id, name: biz.name, slug: biz.slug },
  }
}
