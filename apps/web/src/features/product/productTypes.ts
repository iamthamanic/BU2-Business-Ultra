/**
 * productTypes — client shapes for Product screen / modal.
 * Location: apps/web/src/features/product/productTypes.ts
 */

import { defaultJourneyMap, type JourneyMap } from './customerJourney'

export type ProductMarket = 'b2b' | 'b2c'
export type PriceKind = 'gross' | 'net'
export type CostDept = 'marketing' | 'sales' | 'operations' | 'support' | 'overhead'

export type CostPosition = {
  id: string
  dept: CostDept
  label: string
  amountCents: number
  enabled: boolean
  note?: string
}

export type JourneyNode = {
  id: string
  kind: 'product' | 'persona' | 'stage'
  label: string
  x: number
  y: number
  refId?: string
}

export type JourneyEdge = {
  id: string
  source: string
  target: string
}

export type JourneyCanvas = {
  nodes: JourneyNode[]
  edges: JourneyEdge[]
  /** Legacy-style Customer Journey matrix (phases × lanes) */
  map?: JourneyMap
}

export type PersonaDraft = {
  /** Display name for the product-scoped buyer persona hero */
  name?: string
  /** Rolle / Segment under the persona name */
  role?: string
  gender?: string
  ageGroup?: string
  incomeGroup?: string
  revenueBand?: string
  headcount?: string
  roles?: string[]
  pains?: string[]
  vocabulary?: string
  jobToBeDone?: string
}

export type BuProduct = {
  id: string
  name: string
  description: string
  market: ProductMarket
  coverPath: string | null
  currency: string
  sellingPriceCents: number
  priceKind: PriceKind
  taxRateBps: number
  costPositions: CostPosition[]
  personaIds: string[]
  personaDraft: PersonaDraft
  journeyCanvas: JourneyCanvas
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  netRevenueCents: number
  costCents: number
  contributionCents: number
}

export type ProductDraft = {
  name: string
  description: string
  market: ProductMarket
  coverPath: string | null
  coverDataUrl: string | null
  currency: string
  sellingPriceCents: number
  priceKind: PriceKind
  taxRateBps: number
  costPositions: CostPosition[]
  personaIds: string[]
  personaDraft: PersonaDraft
  journeyCanvas: JourneyCanvas
}

export const COST_DEPTS: { id: CostDept; labelKey: string; accent: string }[] = [
  { id: 'marketing', labelKey: 'productDeptMarketing', accent: '#3b82f6' },
  { id: 'sales', labelKey: 'productDeptSales', accent: '#22c55e' },
  { id: 'operations', labelKey: 'productDeptOps', accent: '#a16207' },
  { id: 'support', labelKey: 'productDeptSupport', accent: '#a855f7' },
  { id: 'overhead', labelKey: 'productDeptOverhead', accent: '#ef4444' },
]

export function emptyDraft(): ProductDraft {
  return {
    name: '',
    description: '',
    market: 'b2b',
    coverPath: null,
    coverDataUrl: null,
    currency: 'EUR',
    sellingPriceCents: 8900,
    priceKind: 'gross',
    taxRateBps: 1900,
    costPositions: [],
    personaIds: [],
    personaDraft: {
      name: '',
      role: '',
      gender: 'male',
      ageGroup: '25-34',
      incomeGroup: 'open',
      revenueBand: '500k-1m',
      headcount: 'open',
      roles: [],
      pains: [],
      vocabulary: '',
      jobToBeDone: '',
    },
    journeyCanvas: { nodes: [], edges: [], map: defaultJourneyMap() },
  }
}

export function draftFromProduct(p: BuProduct): ProductDraft {
  return {
    name: p.name,
    description: p.description,
    market: p.market === 'b2c' ? 'b2c' : 'b2b',
    coverPath: p.coverPath,
    coverDataUrl: null,
    currency: p.currency || 'EUR',
    sellingPriceCents: p.sellingPriceCents ?? 0,
    priceKind: p.priceKind === 'net' ? 'net' : 'gross',
    taxRateBps: p.taxRateBps ?? 1900,
    costPositions: Array.isArray(p.costPositions) ? (p.costPositions as CostPosition[]) : [],
    personaIds: Array.isArray(p.personaIds) ? p.personaIds : [],
    personaDraft: (p.personaDraft || {}) as PersonaDraft,
    journeyCanvas: {
      nodes: Array.isArray(p.journeyCanvas?.nodes) ? p.journeyCanvas.nodes : [],
      edges: Array.isArray(p.journeyCanvas?.edges) ? p.journeyCanvas.edges : [],
      map: p.journeyCanvas?.map || defaultJourneyMap(),
    },
  }
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'P'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
}

export function fmtEur(cents: number): string {
  return `${(cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}
