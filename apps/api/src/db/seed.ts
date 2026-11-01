import { eq } from 'drizzle-orm'
import { loadEnv } from '../lib/env.js'
import { db } from './client.js'
import { users, auditLog } from './schema.js'

async function main() {
  const env = loadEnv()
  const email = env.BOOTSTRAP_OWNER_EMAIL.toLowerCase()
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (existing[0]) {
    console.info('[seed] bootstrap owner already exists:', email)
    process.exit(0)
  }
  const [user] = await db
    .insert(users)
    .values({
      email,
      displayName: 'Bootstrap Owner',
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
