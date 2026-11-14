/**
 * One-shot: backfill demo ads_campaigns.payload.metrics without full reseed.
 */
import { eq } from 'drizzle-orm'
import { loadDotenvFromRoot } from '../src/lib/env.js'
import { db } from '../src/db/client.js'
import { adsCampaigns } from '../src/db/schema.js'

async function main() {
  loadDotenvFromRoot()
  const rows = await db.select().from(adsCampaigns)
  let n = 0
  for (const [i, row] of rows.entries()) {
    const payload =
      row.payload && typeof row.payload === 'object'
        ? ({ ...(row.payload as Record<string, unknown>) } as Record<string, unknown>)
        : ({} as Record<string, unknown>)
    if (payload.demo !== true && payload.marker !== 'bu2-demo-seed') continue
    const daily = row.budgetDailyCents || 3000
    const days = 30
    const spendCents = Math.round(daily * days * (0.55 + (i % 3) * 0.12))
    const impressions = 12_000 + i * 8_500 + daily
    const clicks = Math.round(impressions * (0.018 + i * 0.004))
    const conv = Math.max(1, Math.round(clicks * (0.04 + i * 0.01)))
    const revenueCents = Math.round(conv * 4900 * 0.9)
    const ctr = impressions > 0 ? clicks / impressions : 0
    const cpcCents = clicks > 0 ? Math.round(spendCents / clicks) : null
    const cvr = clicks > 0 ? conv / clicks : 0
    const cpaCents = conv > 0 ? Math.round(spendCents / conv) : null
    const roas = spendCents > 0 ? revenueCents / spendCents : null
    payload.demo = true
    payload.marker = 'bu2-demo-seed'
    payload.metrics = {
      windowDays: days,
      spendCents,
      impressions,
      clicks,
      ctr,
      cpcCents,
      adsConv: conv,
      cvr,
      cpaCents,
      revenueCents,
      roas,
    }
    await db.update(adsCampaigns).set({ payload }).where(eq(adsCampaigns.id, row.id))
    n++
  }
  console.log(`updated ${n} of ${rows.length}`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
