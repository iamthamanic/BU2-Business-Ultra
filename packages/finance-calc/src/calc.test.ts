import { describe, expect, it } from 'vitest'
import {
  CycleError,
  calculateModel,
  evaluate,
  saasTemplateFixture,
  serviceTemplateFixture,
  simpleProductFixture,
  topologicalOrder,
} from './index.js'
import { Money, CurrencyMismatchError } from './money.js'
import { resolveNetRevenue } from './pricing.js'

describe('CMB simple-product golden', () => {
  it('matches expected contribution for volume 100', () => {
    const snap = calculateModel(simpleProductFixture)
    expect(snap.revenueNet).toBe(5000)
    expect(snap.costNet).toBe(2000)
    expect(snap.contributionNet).toBe(3000)
  })

  it('evaluates per-unit and period totals from fixture', () => {
    const result = evaluate(simpleProductFixture)
    const contribution = result.results['n-contribution']
    expect(contribution?.value.status).toBe('ok')
    if (contribution?.value.status !== 'ok') return
    expect(contribution.value.perUnit).toBe(30)
    expect(contribution.value.periodTotal).toBe(3000)
    expect(contribution.provenance.allocationRule).toBe('none')
    expect(result.results['n-ops']?.provenance.allocationRule).toBe('direct')
  })

  it('rejects cyclic graphs', () => {
    expect(() =>
      topologicalOrder({
        id: 'cycle',
        version: 1,
        volume: 1,
        nodes: [
          { id: 'a', kind: 'metric', key: 'a', label: 'A', enabled: true, inputs: {} },
          { id: 'b', kind: 'metric', key: 'b', label: 'B', enabled: true, inputs: {} },
        ],
        edges: [
          { id: 'e1', sourceNodeId: 'a', targetNodeId: 'b', relation: 'depends_on' },
          { id: 'e2', sourceNodeId: 'b', targetNodeId: 'a', relation: 'depends_on' },
        ],
      }),
    ).toThrow(CycleError)
  })

  it('returns unresolved instead of NaN when inputs missing', () => {
    const model = {
      ...simpleProductFixture,
      nodes: simpleProductFixture.nodes.map((n) =>
        n.id === 'n-ops' ? { ...n, inputs: {} } : n,
      ),
    }
    const result = evaluate(model)
    expect(result.results['n-ops']?.value.status).toBe('unresolved')
    expect(result.results['n-contribution']?.value.status).toBe('unresolved')
  })
})

describe('Money', () => {
  it('defaults currency to EUR and hides float drift', () => {
    const money = Money.of('0.1').add(Money.of('0.2'))
    expect(money.currency).toBe('EUR')
    expect(money.displayAmount()).toBe('0.30')
  })

  it('rounds display HALF_UP to 2 dp', () => {
    expect(Money.of('1.005').displayAmount()).toBe('1.01')
    expect(Money.of('1.004').displayAmount()).toBe('1.00')
  })

  it('rejects mixed-currency aggregation', () => {
    expect(() => Money.of(10, 'EUR').add(Money.of(5, 'USD'))).toThrow(CurrencyMismatchError)
  })
})

describe('pricing gross/net', () => {
  it('resolves gross 89 EUR at 19% VAT to net 74.79', () => {
    const result = resolveNetRevenue({
      sellingPrice: 89,
      priceKind: 'gross',
      taxRatePercent: 19,
      pricingBasis: 'per_order',
      currency: 'EUR',
    })
    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.netRevenue).toBe(74.79)
      expect(result.grossRevenue).toBe(89)
    }
  })

  it('rejects invalid tax without silent NaN', () => {
    const result = resolveNetRevenue({
      sellingPrice: 89,
      priceKind: 'gross',
      taxRatePercent: 100,
      pricingBasis: 'per_order',
      currency: 'EUR',
    })
    expect(result.status).toBe('unresolved')
  })
})

describe('templates', () => {
  it('saas template yields deterministic contribution', () => {
    // rev 29*200=5800; fixed 500; cac 15% of 29 = 4.35 * 200 = 870; contrib = 5800-500-870=4430
    const snap = calculateModel(saasTemplateFixture)
    expect(snap.revenueNet).toBe(5800)
    expect(snap.costNet).toBe(1370)
    expect(snap.contributionNet).toBe(4430)
  })

  it('service template yields deterministic contribution', () => {
    // rev 120*40=4800; labor 55*1.5*40=3300; mat 18*40=720; contrib=780
    const snap = calculateModel(serviceTemplateFixture)
    expect(snap.revenueNet).toBe(4800)
    expect(snap.costNet).toBe(4020)
    expect(snap.contributionNet).toBe(780)
  })
})
