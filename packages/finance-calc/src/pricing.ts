/** Gross/net pricing resolution — VAT is not modeled as a cost node. */

export type PriceKind = 'net' | 'gross'

export type ResolveNetInput = {
  sellingPrice: number
  priceKind: PriceKind
  taxRatePercent: number
  pricingBasis?: string
  currency?: string
}

export type ResolveNetResult =
  | { status: 'ok'; netRevenue: number; grossRevenue: number; currency: string }
  | { status: 'unresolved'; messageDe: string; messageEn: string }

export function resolveNetRevenue(input: ResolveNetInput): ResolveNetResult {
  const { sellingPrice, priceKind, taxRatePercent } = input
  const currency = input.currency ?? 'EUR'
  if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
    return {
      status: 'unresolved',
      messageDe: 'Ungültiger Preis',
      messageEn: 'Invalid price',
    }
  }
  if (!Number.isFinite(taxRatePercent) || taxRatePercent < 0 || taxRatePercent >= 100) {
    return {
      status: 'unresolved',
      messageDe: 'Ungültiger USt-Satz',
      messageEn: 'Invalid VAT rate',
    }
  }
  if (priceKind === 'net') {
    const gross = Math.round(sellingPrice * (1 + taxRatePercent / 100) * 100) / 100
    return { status: 'ok', netRevenue: round2(sellingPrice), grossRevenue: gross, currency }
  }
  const net = Math.round((sellingPrice / (1 + taxRatePercent / 100)) * 100) / 100
  return { status: 'ok', netRevenue: net, grossRevenue: round2(sellingPrice), currency }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
