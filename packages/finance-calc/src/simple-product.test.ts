import { describe, expect, it } from 'vitest'
import { calculateModel, simpleProductFixture } from './index.js'

describe('CMB simple-product golden', () => {
  it('matches expected contribution for volume 100', () => {
    // revenue: 50 * 100 = 5000
    // ops: 40 * 0.5 * 100 = 2000
    // contribution: 3000
    const snap = calculateModel(simpleProductFixture)
    expect(snap.revenueNet).toBe(5000)
    expect(snap.costNet).toBe(2000)
    expect(snap.contributionNet).toBe(3000)
  })
})
