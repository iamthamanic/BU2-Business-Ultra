/**
 * CostMyBusiness pure calculation engine (greenfield).
 * Net-basis simulation only — not legal tax advice or invoicing (Q-015 A).
 */

export type CostBehavior = 'fixed' | 'per_unit' | 'per_hour' | 'percent_of_revenue'

export type NodeKind = 'revenue' | 'cost' | 'result'

export interface CmbNode {
  id: string
  kind: NodeKind
  key: string
  label: string
  enabled: boolean
  costBehavior?: CostBehavior
  inputs: Record<string, number>
  allocation?: { rule: 'direct' | 'proportional' }
}

export interface CmbEdge {
  id: string
  sourceNodeId: string
  targetNodeId: string
  relation: 'feeds'
}

export interface DomainModel {
  id: string
  version: number
  volume: number
  currency?: string
  nodes: CmbNode[]
  edges: CmbEdge[]
}

export interface NodeResult {
  nodeId: string
  key: string
  label: string
  amountNet: number
}

export interface CalcSnapshot {
  modelId: string
  version: number
  volume: number
  currency: string
  revenueNet: number
  costNet: number
  contributionNet: number
  nodes: NodeResult[]
  computedAt: string
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function revenueAmount(node: CmbNode, volume: number): number {
  const price = node.inputs.price ?? 0
  return price * volume
}

function costAmount(node: CmbNode, volume: number, revenueNet: number): number {
  const behavior = node.costBehavior ?? 'fixed'
  switch (behavior) {
    case 'fixed':
      return node.inputs.amount ?? 0
    case 'per_unit':
      return (node.inputs.unitCost ?? 0) * volume
    case 'per_hour':
      return (node.inputs.rate ?? 0) * (node.inputs.hoursPerOrder ?? 0) * volume
    case 'percent_of_revenue':
      return revenueNet * ((node.inputs.percent ?? 0) / 100)
    default:
      return 0
  }
}

/** Deterministic net-basis simulation used by CMB API + golden tests. */
export function calculateModel(model: DomainModel): CalcSnapshot {
  const volume = Math.max(0, model.volume)
  const currency = model.currency ?? 'EUR'
  const enabled = model.nodes.filter((n) => n.enabled)

  let revenueNet = 0
  for (const n of enabled.filter((x) => x.kind === 'revenue')) {
    revenueNet += revenueAmount(n, volume)
  }
  revenueNet = round2(revenueNet)

  let costNet = 0
  const nodeResults: NodeResult[] = []

  for (const n of enabled) {
    let amount = 0
    if (n.kind === 'revenue') amount = revenueAmount(n, volume)
    else if (n.kind === 'cost') {
      amount = costAmount(n, volume, revenueNet)
      costNet += amount
    }
    nodeResults.push({
      nodeId: n.id,
      key: n.key,
      label: n.label,
      amountNet: round2(amount),
    })
  }
  costNet = round2(costNet)
  const contributionNet = round2(revenueNet - costNet)

  for (const n of enabled.filter((x) => x.kind === 'result')) {
    const existing = nodeResults.find((r) => r.nodeId === n.id)
    if (existing) existing.amountNet = contributionNet
  }

  return {
    modelId: model.id,
    version: model.version,
    volume,
    currency,
    revenueNet,
    costNet,
    contributionNet,
    nodes: nodeResults,
    computedAt: new Date().toISOString(),
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
    {
      id: 'e1',
      sourceNodeId: 'n-revenue',
      targetNodeId: 'n-contribution',
      relation: 'feeds',
    },
    {
      id: 'e2',
      sourceNodeId: 'n-ops',
      targetNodeId: 'n-contribution',
      relation: 'feeds',
    },
  ],
}
