/**
 * Seeds bootstrap owner with password from BOOTSTRAP_OWNER_PASSWORD.
 * Location: apps/api/src/db/seed.ts
 */
import { eq } from 'drizzle-orm'
import { loadEnv } from '../lib/env.js'
import { hashPassword } from '../lib/password.js'
import { db } from './client.js'
import { users, auditLog } from './schema.js'

async function main() {
  const env = loadEnv()
  const email = env.BOOTSTRAP_OWNER_EMAIL.toLowerCase()
  const passwordHash = await hashPassword(env.BOOTSTRAP_OWNER_PASSWORD)
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1)

  if (existing[0]) {
    await db
      .update(users)
      .set({
        passwordHash,
        isSuperadmin: true,
        isBreakglassOperator: true,
      })
      .where(eq(users.id, existing[0].id))
    console.info('[seed] bootstrap owner password refreshed:', email)
    process.exit(0)
  }

  const [user] = await db
    .insert(users)
    .values({
      email,
      displayName: 'Bootstrap Owner',
      passwordHash,
      isSuperadmin: true,
      isBreakglassOperator: true,
      locale: 'de',
    })
    .returning()
  await db.insert(auditLog).values({
    actorUserId: user!.id,
    action: 'bootstrap.owner_created',
    status: 'ok',
    meta: { email },
  })
  console.info('[seed] bootstrap owner created:', email, user!.id)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
