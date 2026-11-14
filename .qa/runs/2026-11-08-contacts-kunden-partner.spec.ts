/**
 * Kontakte — Kunden/Partner acceptance (API + UI smoke).
 * Run: E2E_NO_SERVER=1 pnpm --filter @bu2/e2e exec playwright test ../../.qa/runs/2026-11-08-contacts-kunden-partner.spec.ts
 * Or from apps/e2e with config path pointing here — prefer copying into apps/e2e if CI needs it.
 *
 * Location: .qa/runs/2026-11-08-contacts-kunden-partner.spec.ts
 */
/**
 * Mirror of apps/e2e/tests/contacts-kunden-partner.spec.ts for verify-ui evidence path.
 * Prefer running the e2e package copy.
 */
import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import path from 'node:path'

const API = process.env.PUBLIC_API_URL ?? 'http://127.0.0.1:8742'
const EVIDENCE = path.resolve(process.cwd(), '.qa/evidence/contacts-kunden-partner')

async function loginAsBootstrap(request: APIRequestContext) {
  const email = process.env.BOOTSTRAP_OWNER_EMAIL ?? 'raccoova@gmail.com'
  const password = process.env.BOOTSTRAP_OWNER_PASSWORD ?? '1234'
  const login = await request.post(`${API}/api/auth/login`, {
    data: { email, password },
  })
  if (login.ok()) return
  const magic = await request.post(`${API}/api/auth/magic-link`, { data: { email } })
  expect(magic.ok()).toBeTruthy()
  const otpRes = await request.post(`${API}/api/auth/dev/last-otp`, { data: { email } })
  if (!otpRes.ok()) test.skip(true, 'login helpers unavailable')
  const { code } = (await otpRes.json()) as { code: string }
  const verify = await request.post(`${API}/api/auth/verify-otp`, { data: { email, code } })
  expect(verify.ok()).toBeTruthy()
}

async function loginUi(page: Page) {
  const email = process.env.BOOTSTRAP_OWNER_EMAIL ?? 'raccoova@gmail.com'
  const password = process.env.BOOTSTRAP_OWNER_PASSWORD ?? '1234'
  await page.goto('/login')
  const passwordTab = page.getByRole('button', { name: /Passwort|Password/i })
  if (await passwordTab.isVisible().catch(() => false)) await passwordTab.click()
  await page.locator('input[type="email"], input[name="email"]').first().fill(email)
  const pw = page.locator('input[type="password"]')
  if (await pw.count()) await pw.first().fill(password)
  await page.getByRole('button', { name: /Anmelden|Sign in|Login/i }).first().click()
  await page.waitForURL(/\/(co|b)\//, { timeout: 20_000 }).catch(() => null)
}

test.describe('contacts kunden/partner @contacts', () => {
  test('API: customer + partner + dual-role + archive/restore + role filters', async ({
    request,
  }) => {
    await loginAsBootstrap(request)
    const slug = `contacts-${Date.now().toString(36)}`
    const biz = await request.post(`${API}/api/businesses`, {
      data: { name: 'Contacts QA', slug },
    })
    expect(biz.ok()).toBeTruthy()

    const customer = await request.post(`${API}/api/b/${slug}/customers`, {
      data: {
        kind: 'person',
        firstName: 'Kunde',
        lastName: 'Eins',
        isCustomer: true,
        isPartner: false,
        relationStatus: 'customer',
      },
    })
    expect(customer.status()).toBe(201)
    const custBody = await customer.json()
    expect(custBody.customer.isCustomer).toBe(true)
    expect(custBody.customer.customerNumberLabel).toMatch(/^K-/)

    const partner = await request.post(`${API}/api/b/${slug}/customers`, {
      data: {
        kind: 'org',
        displayName: 'Partner GmbH',
        isCustomer: false,
        isPartner: true,
        partnerCategory: 'Dienstleister',
        partnerStatus: 'active',
      },
    })
    expect(partner.status()).toBe(201)
    const partnerBody = await partner.json()
    expect(partnerBody.customer.isPartner).toBe(true)
    expect(partnerBody.customer.isCustomer).toBe(false)
    expect(partnerBody.customer.partnerNumberLabel).toMatch(/^P-/)
    const partnerId = partnerBody.customer.id as string

    const dualPatch = await request.patch(`${API}/api/b/${slug}/customers/${partnerId}`, {
      data: { isCustomer: true, isPartner: true, relationStatus: 'customer' },
    })
    expect(dualPatch.ok()).toBeTruthy()
    const dual = (await dualPatch.json()).customer
    expect(dual.isCustomer).toBe(true)
    expect(dual.isPartner).toBe(true)
    expect(dual.customerNumberLabel).toMatch(/^K-/)
    expect(dual.partnerNumberLabel).toMatch(/^P-/)

    const customersList = await request.get(`${API}/api/b/${slug}/customers?role=customer&archive=0`)
    expect(customersList.ok()).toBeTruthy()
    const customers = (await customersList.json()).customers as { id: string }[]
    expect(customers.some((c) => c.id === partnerId)).toBe(true)

    const partnersList = await request.get(`${API}/api/b/${slug}/customers?role=partner&archive=0`)
    expect(partnersList.ok()).toBeTruthy()
    const partners = (await partnersList.json()).customers as { id: string }[]
    expect(partners.some((c) => c.id === partnerId)).toBe(true)

    const archived = await request.post(`${API}/api/b/${slug}/customers/${partnerId}/archive`)
    expect(archived.ok()).toBeTruthy()
    const activeAfter = await request.get(`${API}/api/b/${slug}/customers?role=partner&archive=0`)
    expect(
      ((await activeAfter.json()).customers as { id: string }[]).some((c) => c.id === partnerId),
    ).toBe(false)
    const archivedList = await request.get(`${API}/api/b/${slug}/customers?role=partner&archive=1`)
    expect(
      ((await archivedList.json()).customers as { id: string }[]).some((c) => c.id === partnerId),
    ).toBe(true)

    const restored = await request.post(`${API}/api/b/${slug}/customers/${partnerId}/restore`)
    expect(restored.ok()).toBeTruthy()
    const activeAgain = await request.get(`${API}/api/b/${slug}/customers?role=partner&archive=0`)
    expect(
      ((await activeAgain.json()).customers as { id: string }[]).some((c) => c.id === partnerId),
    ).toBe(true)
  })

  test('UI: Kontakte tabs + create CTAs', async ({ page }) => {
    await loginUi(page)
    // Prefer existing open company from session, else first company card
    if (!page.url().includes('/co/')) {
      const link = page.locator('a[href*="/co/"]').first()
      if (await link.count()) await link.click()
    }
    const slugMatch = page.url().match(/\/co\/([^/]+)/)
    test.skip(!slugMatch, 'no company in session')
    const slug = slugMatch![1]!

    await page.goto(`/co/${slug}/contacts`)
    await expect(page.getByRole('heading', { name: /Kontakte|Contacts/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Kunden|Customers/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Partner|Partners/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Kunde anlegen|Create customer/i })).toBeVisible()

    await page.getByRole('tab', { name: /Partner|Partners/i }).click()
    await expect(page.getByRole('button', { name: /Partner anlegen|Create partner/i })).toBeVisible()

    await page.screenshot({
      path: path.join(EVIDENCE, '10-tabs-cta.png'),
      fullPage: true,
    })
  })
})
