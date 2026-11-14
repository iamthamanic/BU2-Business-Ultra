/**
 * Backfill system permission bundles for every business (idempotent).
 * Location: apps/api/scripts/seed-system-bundles.ts
 */
import { db } from '../src/db/client.js'
import { businesses } from '../src/db/schema.js'
import { seedSystemBundles } from '../src/lib/authorize.js'

async function main() {
  const rows = await db.select({ id: businesses.id, slug: businesses.slug }).from(businesses)
  for (const r of rows) {
    await seedSystemBundles(r.id)
    console.info('[bundles] seeded', r.slug)
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
