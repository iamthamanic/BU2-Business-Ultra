/**
 * CostMyBusiness pure calculation engine (greenfield).
 * Net-basis simulation only — not legal tax advice or invoicing (Q-015 A).
 */

export { Money, CurrencyMismatchError, DEFAULT_CURRENCY } from './money.js'
export { resolveNetRevenue } from './pricing.js'
export type { ResolveNetInput, ResolveNetResult, PriceKind } from './pricing.js'

export type CostBehavior = 'fixed' | 'per_unit' | 'per_hour' | 'percent_of_revenue'

export type NodeKind = 'revenue' | 'cost' | 'result' | 'metric'

export interface CmbNode {
  id: string
  kind: NodeKind
  key: string
  label: string
  enabled: boolean
  costBehavior?: CostBehavior
  inputs: Record<string, number>
  allocation?: { rule: 'direct' | 'proportional' | 'none' }
}

export interface CmbEdge {
  id: string
  sourceNodeId: string
  targetNodeId: string
  relation: 'feeds' | 'depends_on'
}

export interface DomainModel {
  id: string
  version: number
  volume: number
  currency?: string
  nodes: CmbNode[]
  edges: CmbEdge[]
}

export type CalcValue =
  | { status: 'ok'; perUnit: number; periodTotal: number }
  | { status: 'unresolved'; reason: string; message?: string }

export interface NodeResult {
  nodeId: string
  key: string
  label: string
  value: CalcValue
  provenance: { allocationRule: string }
}

export interface EvaluationResult {
  results: Record<string, NodeResult>
}

export interface CalcSnapshot {
  modelId: string
  version: number
  volume: number
  currency: string
  revenueNet: number
  costNet: number
  contributionNet: number
  nodes: Array<{ nodeId: string; key: string; label: string; amountNet: number }>
  computedAt: string
  unresolved?: string[]
}

export class CycleError extends Error {
  remaining: string[]
  constructor(remaining: string[]) {
    super(`Cycle detected: ${remaining.join(',')}`)
    this.name = 'CycleError'
    this.remaining = remaining
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function topologicalOrder(model: DomainModel): string[] {
  const indegree = new Map<string, number>()
  const dependents = new Map<string, string[]>()
  for (const n of model.nodes) {
    indegree.set(n.id, 0)
    dependents.set(n.id, [])
  }
  for (const e of model.edges) {
    indegree.set(e.targetNodeId, (indegree.get(e.targetNodeId) ?? 0) + 1)
    dependents.get(e.sourceNodeId)?.push(e.targetNodeId)
  }
  const queue = [...indegree.entries()].filter(([, d]) => d === 0).map(([id]) => id)
  const order: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    for (const next of dependents.get(id) ?? []) {
      const d = (indegree.get(next) ?? 0) - 1
      indegree.set(next, d)
      if (d === 0) queue.push(next)
    }
  }
  if (order.length !== model.nodes.length) {
    throw new CycleError(model.nodes.map((n) => n.id).filter((id) => !order.includes(id)))
  }
  return order
}

function costPerUnit(node: CmbNode, revenuePerUnit: number | undefined): CalcValue {
  const behavior = node.costBehavior ?? 'fixed'
  switch (behavior) {
    case 'fixed': {
      const amount = node.inputs.amount
      if (amount == null || !Number.isFinite(amount)) {
        return { status: 'unresolved', reason: 'missing_input' }
      }
      return { status: 'ok', perUnit: amount, periodTotal: amount }
    }
    case 'per_unit': {
      const unitCost = node.inputs.unitCost
      if (unitCost == null || !Number.isFinite(unitCost)) {
        return { status: 'unresolved', reason: 'missing_input' }
      }
      return { status: 'ok', perUnit: unitCost, periodTotal: unitCost }
    }
    case 'per_hour': {
      const rate = node.inputs.rate
      const hours = node.inputs.hoursPerOrder
      if (rate == null || hours == null || !Number.isFinite(rate) || !Number.isFinite(hours)) {
        return { status: 'unresolved', reason: 'missing_input' }
      }
      const perUnit = rate * hours
      return { status: 'ok', perUnit, periodTotal: perUnit }
    }
    case 'percent_of_revenue': {
      const pct = node.inputs.percent
      if (pct == null || revenuePerUnit == null || !Number.isFinite(pct)) {
        return { status: 'unresolved', reason: 'missing_input' }
      }
      const perUnit = revenuePerUnit * (pct / 100)
      return { status: 'ok', perUnit, periodTotal: perUnit }
    }
    default:
      return { status: 'unresolved', reason: 'unknown' }
  }
}

/** Full evaluation with per-unit/period totals and unresolved propagation. */
export function evaluate(model: DomainModel): EvaluationResult {
  topologicalOrder(model)
  const volume = Math.max(0, model.volume)
  const byId = new Map(model.nodes.map((n) => [n.id, n]))
  const results: Record<string, NodeResult> = {}

  let revenuePerUnit: number | undefined
  for (const n of model.nodes.filter((x) => x.kind === 'revenue' && x.enabled)) {
    const price = n.inputs.price
    if (price == null || !Number.isFinite(price)) {
      results[n.id] = {
        nodeId: n.id,
        key: n.key,
        label: n.label,
        value: { status: 'unresolved', reason: 'missing_input' },
        provenance: { allocationRule: n.allocation?.rule ?? 'none' },
      }
    } else {
      revenuePerUnit = price
      results[n.id] = {
        nodeId: n.id,
        key: n.key,
        label: n.label,
        value: { status: 'ok', perUnit: price, periodTotal: round2(price * volume) },
        provenance: { allocationRule: n.allocation?.rule ?? 'none' },
      }
    }
  }

  let unresolvedDownstream = false
  for (const n of model.nodes.filter((x) => x.kind === 'cost' && x.enabled)) {
    const value = costPerUnit(n, revenuePerUnit)
    if (value.status === 'ok') {
      value.periodTotal = round2(value.perUnit * (n.costBehavior === 'fixed' ? 1 : volume))
      if (n.costBehavior === 'fixed') {
        // fixed is period total already in perUnit field from costPerUnit — normalize
        const period = n.inputs.amount ?? 0
        value.perUnit = volume > 0 ? round2(period / volume) : period
        value.periodTotal = round2(period)
      }
    } else {
      unresolvedDownstream = true
    }
    results[n.id] = {
      nodeId: n.id,
      key: n.key,
      label: n.label,
      value,
      provenance: { allocationRule: n.allocation?.rule ?? 'direct' },
    }
  }

  for (const n of model.nodes.filter((x) => x.kind === 'result' && x.enabled)) {
    if (unresolvedDownstream || revenuePerUnit == null) {
      results[n.id] = {
        nodeId: n.id,
        key: n.key,
        label: n.label,
        value: { status: 'unresolved', reason: 'missing_input' },
        provenance: { allocationRule: 'none' },
      }
      continue
    }
    let costPer = 0
    let costPeriod = 0
    for (const c of model.nodes.filter((x) => x.kind === 'cost' && x.enabled)) {
      const r = results[c.id]
      if (r?.value.status === 'ok') {
        costPer += r.value.perUnit
        costPeriod += r.value.periodTotal
      }
    }
    const perUnit = round2(revenuePerUnit - costPer)
    const periodTotal = round2(revenuePerUnit * volume - costPeriod)
    results[n.id] = {
      nodeId: n.id,
      key: n.key,
      label: n.label,
      value: { status: 'ok', perUnit, periodTotal },
      provenance: { allocationRule: 'none' },
    }
  }

  for (const n of model.nodes) {
    if (!results[n.id]) {
      results[n.id] = {
        nodeId: n.id,
        key: n.key,
        label: n.label,
        value: n.enabled
          ? { status: 'unresolved', reason: 'unknown' }
          : { status: 'unresolved', reason: 'disabled' },
        provenance: { allocationRule: 'none' },
      }
    }
  }

  void byId
  return { results }
}

/** Snapshot helper used by API persistence. */
export function calculateModel(model: DomainModel): CalcSnapshot {
  const evaluation = evaluate(model)
  const volume = Math.max(0, model.volume)
  const currency = model.currency ?? 'EUR'
  let revenueNet = 0
  let costNet = 0
  const unresolved: string[] = []
  const nodes: CalcSnapshot['nodes'] = []

  for (const n of model.nodes.filter((x) => x.enabled)) {
    const r = evaluation.results[n.id]
    if (!r || r.value.status !== 'ok') {
      unresolved.push(n.id)
      nodes.push({ nodeId: n.id, key: n.key, label: n.label, amountNet: 0 })
      continue
    }
    const amount = r.value.periodTotal
    nodes.push({ nodeId: n.id, key: n.key, label: n.label, amountNet: amount })
    if (n.kind === 'revenue') revenueNet += amount
    if (n.kind === 'cost') costNet += amount
  }

  revenueNet = round2(revenueNet)
  costNet = round2(costNet)
  const contributionNet = round2(revenueNet - costNet)
  for (const n of nodes) {
    const node = model.nodes.find((x) => x.id === n.nodeId)
    if (node?.kind === 'result') n.amountNet = contributionNet
  }

  return {
    modelId: model.id,
    version: model.version,
    volume,
    currency,
    revenueNet,
    costNet,
    contributionNet,
    nodes,
    computedAt: new Date().toISOString(),
    unresolved: unresolved.length ? unresolved : undefined,
  }
}

/** Golden fixture ported from legacy cmb/tests/fixtures/simple-product.ts */
export const simpleProductFixture: DomainModel = {
  id: 'model-simple-1',
  version: 1,
  volume: 100,
  currency: 'EUR',
  nodes: [
    {
      id: 'n-revenue',
      kind: 'revenue',
      key: 'revenue',
      label: 'Umsatz',
      enabled: true,
      inputs: { price: 50 },
    },
    {
      id: 'n-ops',
      kind: 'cost',
      key: 'ops_labor',
      label: 'Betrieb Personal',
      enabled: true,
      costBehavior: 'per_hour',
      inputs: { rate: 40, hoursPerOrder: 0.5 },
      allocation: { rule: 'direct' },
    },
    {
      id: 'n-contribution',
      kind: 'result',
      key: 'contribution',
      label: 'Deckungsbeitrag',
      enabled: true,
      inputs: {},
    },
  ],
  edges: [
    { id: 'e1', sourceNodeId: 'n-revenue', targetNodeId: 'n-contribution', relation: 'feeds' },
    { id: 'e2', sourceNodeId: 'n-ops', targetNodeId: 'n-contribution', relation: 'feeds' },
  ],
}

/** SaaS-like template: subscription revenue + fixed + percent CAC. */
export const saasTemplateFixture: DomainModel = {
  id: 'tpl-saas-1',
  version: 1,
  volume: 200,
  currency: 'EUR',
  nodes: [
    {
      id: 'n-rev',
      kind: 'revenue',
      key: 'mrr',
      label: 'MRR',
      enabled: true,
      inputs: { price: 29 },
    },
    {
      id: 'n-fixed',
      kind: 'cost',
      key: 'infra',
      label: 'Infra',
      enabled: true,
      costBehavior: 'fixed',
      inputs: { amount: 500 },
      allocation: { rule: 'direct' },
    },
    {
      id: 'n-cac',
      kind: 'cost',
      key: 'cac',
      label: 'CAC %',
      enabled: true,
      costBehavior: 'percent_of_revenue',
      inputs: { percent: 15 },
      allocation: { rule: 'direct' },
    },
    {
      id: 'n-db',
      kind: 'result',
      key: 'contribution',
      label: 'Deckungsbeitrag',
      enabled: true,
      inputs: {},
    },
  ],
  edges: [
    { id: 'e1', sourceNodeId: 'n-rev', targetNodeId: 'n-db', relation: 'feeds' },
    { id: 'e2', sourceNodeId: 'n-fixed', targetNodeId: 'n-db', relation: 'feeds' },
    { id: 'e3', sourceNodeId: 'n-cac', targetNodeId: 'n-db', relation: 'feeds' },
  ],
}

/** Service template: hourly labor + materials per unit. */
export const serviceTemplateFixture: DomainModel = {
  id: 'tpl-service-1',
  version: 1,
  volume: 40,
  currency: 'EUR',
  nodes: [
    {
      id: 'n-rev',
      kind: 'revenue',
      key: 'revenue',
      label: 'Umsatz',
      enabled: true,
      inputs: { price: 120 },
    },
    {
      id: 'n-labor',
      kind: 'cost',
      key: 'labor',
      label: 'Arbeitszeit',
      enabled: true,
      costBehavior: 'per_hour',
      inputs: { rate: 55, hoursPerOrder: 1.5 },
      allocation: { rule: 'direct' },
    },
    {
      id: 'n-mat',
      kind: 'cost',
      key: 'materials',
      label: 'Material',
      enabled: true,
      costBehavior: 'per_unit',
      inputs: { unitCost: 18 },
      allocation: { rule: 'direct' },
    },
    {
      id: 'n-db',
      kind: 'result',
      key: 'contribution',
      label: 'Deckungsbeitrag',
      enabled: true,
      inputs: {},
    },
  ],
  edges: [
    { id: 'e1', sourceNodeId: 'n-rev', targetNodeId: 'n-db', relation: 'feeds' },
    { id: 'e2', sourceNodeId: 'n-labor', targetNodeId: 'n-db', relation: 'feeds' },
    { id: 'e3', sourceNodeId: 'n-mat', targetNodeId: 'n-db', relation: 'feeds' },
  ],
}

export const TEMPLATES = {
  simple: simpleProductFixture,
  saas: saasTemplateFixture,
  service: serviceTemplateFixture,
} as const
