/**
 * Prefer interactive setup (`pnpm setup`). This seed refreshes/creates Better Auth
 * credential rows for the bootstrap owner when BU2 users already exist.
 * Location: apps/api/src/db/seed.ts
 */
import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { loadEnv } from '../lib/env.js'
import { hashPassword } from '../lib/password.js'
import { db } from './client.js'
import { baAccount, baUser, businesses, platformGrants, users } from './schema.js'
import { seedSystemBundles } from '../lib/authorize.js'
import { isBootstrapRequired, runBootstrap } from '../modules/auth/bootstrap.js'

async function ensureCredentialAccount(userId: string, email: string, displayName: string | null, password: string) {
  const passwordHash = await hashPassword(password)
  const existingBa = await db.select().from(baUser).where(eq(baUser.id, userId)).limit(1)
  if (!existingBa[0]) {
    await db.insert(baUser).values({
      id: userId,
      name: displayName || email.split('@')[0] || 'Owner',
      email,
      emailVerified: true,
    })
  }
  const accounts = await db.select().from(baAccount).where(eq(baAccount.userId, userId)).limit(1)
  if (!accounts[0]) {
    await db.insert(baAccount).values({
      id: randomUUID(),
      accountId: userId,
      providerId: 'credential',
      userId,
      password: passwordHash,
    })
  } else {
    await db
      .update(baAccount)
      .set({ password: passwordHash, updatedAt: new Date() })
      .where(eq(baAccount.userId, userId))
  }
}

async function main() {
  const env = loadEnv()
  if (await isBootstrapRequired()) {
    const result = await runBootstrap({
      email: env.BOOTSTRAP_OWNER_EMAIL,
      password: env.BOOTSTRAP_OWNER_PASSWORD,
      displayName: 'Bootstrap Owner',
      companyName: 'My Company',
      companySlug: 'my-company',
    })
    console.info('[seed] bootstrap via setup service:', result.user.email, result.business.slug)
    process.exit(0)
  }

  const email = env.BOOTSTRAP_OWNER_EMAIL.toLowerCase()
  let password = env.BOOTSTRAP_OWNER_PASSWORD
  if (password.length < 8) {
    password = 'change-me-local'
    console.warn(
      '[seed] BOOTSTRAP_OWNER_PASSWORD shorter than 8 chars — using change-me-local for Better Auth (update .env.local)',
    )
  }

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (!existing[0]) {
    console.info('[seed] users exist but bootstrap email missing — skip')
    process.exit(0)
  }

  await ensureCredentialAccount(existing[0].id, email, existing[0].displayName, password)

  const grant = await db
    .select()
    .from(platformGrants)
    .where(eq(platformGrants.userId, existing[0].id))
    .limit(1)
  if (!grant[0]) {
    await db.insert(platformGrants).values({
      userId: existing[0].id,
      capabilityKey: 'companies.create',
      createdByUserId: existing[0].id,
    })
    console.info('[seed] platform grant companies.create added')
  }

  const companies = await db.select({ id: businesses.id, slug: businesses.slug }).from(businesses)
  for (const c of companies) {
    await seedSystemBundles(c.id)
  }
  if (companies.length) {
    console.info('[seed] system bundles ensured for', companies.length, 'companies')
  }

  console.info('[seed] bootstrap owner Better Auth credential synced:', email)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
