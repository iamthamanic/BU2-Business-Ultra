/**
 * Demo DB seed — wipe all businesses, keep bootstrap owner, plant 3 DE demo firms.
 * Requires BU2_DEMO_SEED=1 (fail-closed). Idempotent replace via wipe + reseed.
 * Location: apps/api/src/db/seedDemo.ts
 *
 * Run: pnpm db:seed:demo
 */
import { eq } from 'drizzle-orm'
import { loadDotenvFromRoot, loadEnv } from '../lib/env.js'
import { writeAudit } from '../lib/audit.js'
import { db } from './client.js'
import { DEMO_FIRMS } from './demo/firms.js'
import { seedFirm } from './demo/seedFirm.js'
import { businesses, users } from './schema.js'

async function main() {
  loadDotenvFromRoot()
  const flag = (process.env.BU2_DEMO_SEED ?? '').trim()
  if (flag !== '1') {
    console.error(
      '[seed:demo] Abbruch: setze BU2_DEMO_SEED=1 in .env.local (fail-closed). Owner-Seed: pnpm db:seed',
    )
    process.exit(1)
  }

  // Validate core env (DB etc.) after dotenv
  const env = loadEnv()
  const ownerEmail = env.BOOTSTRAP_OWNER_EMAIL.toLowerCase()
  const ownerRows = await db.select().from(users).where(eq(users.email, ownerEmail)).limit(1)
  const owner = ownerRows[0]
  if (!owner) {
    console.error(
      `[seed:demo] Bootstrap-Owner fehlt (${ownerEmail}). Zuerst: pnpm db:seed`,
    )
    process.exit(1)
  }

  const existing = await db.select({ id: businesses.id, slug: businesses.slug }).from(businesses)
  console.info(`[seed:demo] Wipe ${existing.length} Business(es)…`)
  // Cascades memberships, CRM, finance, connections, inbox, etc.
  await db.delete(businesses)

  const seeded: { slug: string; id: string; depth: string }[] = []
  for (const firm of DEMO_FIRMS) {
    const id = await seedFirm(firm, owner.id)
    seeded.push({ slug: firm.slug, id, depth: firm.depth })
    console.info(`[seed:demo] + ${firm.name} (${firm.slug}, ${firm.depth})`)
  }

  await writeAudit({
    actorUserId: owner.id,
    action: 'demo.seed_replaced',
    status: 'ok',
    meta: { firms: seeded, marker: 'bu2-demo-seed' },
  })

  console.info('[seed:demo] Fertig. Firmen:', seeded.map((s) => s.slug).join(', '))
  console.info(`[seed:demo] Login weiterhin: ${ownerEmail}`)
  process.exit(0)
}

main().catch((e) => {
  console.error('[seed:demo] failed', e)
  process.exit(1)
})
