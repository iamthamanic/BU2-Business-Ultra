/**
 * Contact number / role helpers.
 * Location: apps/api/src/modules/customers/service.contacts.test.ts
 */
import { describe, expect, it } from 'vitest'
import { CustomerSchema, CustomerPatchSchema } from '@bu2/shared'
import { formatCustomerNumber, formatPartnerNumber } from './service.js'

describe('contact numbers', () => {
  it('formats K- and P- prefixes from 100100', () => {
    expect(formatCustomerNumber(100100)).toBe('K-100100')
    expect(formatPartnerNumber(100100)).toBe('P-100100')
    expect(formatCustomerNumber(100101)).toBe('K-100101')
  })
})

describe('contact roles schema', () => {
  it('requires at least one role on create', () => {
    const bad = CustomerSchema.safeParse({
      kind: 'org',
      displayName: 'Acme',
      isCustomer: false,
      isPartner: false,
    })
    expect(bad.success).toBe(false)

    const ok = CustomerSchema.safeParse({
      kind: 'org',
      displayName: 'Acme',
      isCustomer: false,
      isPartner: true,
      partnerCategory: 'Agentur',
    })
    expect(ok.success).toBe(true)
  })

  it('rejects patch that clears both roles', () => {
    const bad = CustomerPatchSchema.safeParse({ isCustomer: false, isPartner: false })
    expect(bad.success).toBe(false)
  })

  it('defaults legacy create to customer role', () => {
    const ok = CustomerSchema.safeParse({ kind: 'org', displayName: 'Legacy Co' })
    expect(ok.success).toBe(true)
    if (ok.success) {
      expect(ok.data.isCustomer).toBe(true)
      expect(ok.data.isPartner).toBe(false)
    }
  })

  it('accepts dual-role create and dual-role patch', () => {
    const created = CustomerSchema.safeParse({
      kind: 'person',
      firstName: 'Dual',
      lastName: 'Role',
      isCustomer: true,
      isPartner: true,
      partnerCategory: 'Agentur',
    })
    expect(created.success).toBe(true)

    const patched = CustomerPatchSchema.safeParse({
      isCustomer: true,
      isPartner: true,
      partnerCategory: 'Dienstleister',
      partnerStatus: 'active',
    })
    expect(patched.success).toBe(true)
  })
})
