/**
 * products domain helpers.
 * Location: apps/api/src/modules/products/service.ts
 */
import { resolveNetRevenue } from '@bu2/finance-calc'
import { products } from '../../db/schema.js'

type CostPos = {
  id: string
  dept: string
  label: string
  amountCents: number
  enabled: boolean
  note?: string
}

export function calcSummary(row: {
  sellingPriceCents: number
  priceKind: string
  taxRateBps: number
  currency: string
  costPositions: unknown
}) {
  const price = (row.sellingPriceCents || 0) / 100
  const tax = (row.taxRateBps || 0) / 100
  const kind = row.priceKind === 'net' ? 'net' : 'gross'
  const net = resolveNetRevenue({
    sellingPrice: price,
    priceKind: kind,
    taxRatePercent: tax,
    currency: row.currency || 'EUR',
  })
  const positions = (Array.isArray(row.costPositions) ? row.costPositions : []) as CostPos[]
  const costCents = positions
    .filter((p) => p && p.enabled)
    .reduce((s, p) => s + (Number(p.amountCents) || 0), 0)
  const netRevenueCents = net.status === 'ok' ? Math.round(net.netRevenue * 100) : 0
  return {
    netRevenueCents,
    grossRevenueCents: net.status === 'ok' ? Math.round(net.grossRevenue * 100) : 0,
    costCents,
    contributionCents: netRevenueCents - costCents,
    pricing: net,
  }
}

export function toClient(row: typeof products.$inferSelect) {
  const summary = calcSummary(row)
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    market: row.market,
    coverPath: row.coverPath,
    currency: row.currency,
    sellingPriceCents: row.sellingPriceCents,
    priceKind: row.priceKind,
    taxRateBps: row.taxRateBps,
    costPositions: row.costPositions ?? [],
    personaIds: row.personaIds ?? [],
    personaDraft: row.personaDraft ?? {},
    journeyCanvas: row.journeyCanvas ?? { nodes: [], edges: [] },
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    netRevenueCents: summary.netRevenueCents,
    costCents: summary.costCents,
    contributionCents: summary.contributionCents,
  }
}
