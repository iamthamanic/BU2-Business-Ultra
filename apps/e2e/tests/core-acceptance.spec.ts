import { test, expect, type APIRequestContext } from '@playwright/test'

/**
 * Core acceptance subset (decision 23B) — API + UI smoke.
 * Tags: @core23b
 */

const API = process.env.PUBLIC_API_URL ?? 'http://127.0.0.1:8742'

async function loginAsBootstrap(request: APIRequestContext) {
  const email = process.env.BOOTSTRAP_OWNER_EMAIL ?? 'raccoova@gmail.com'
  const password = process.env.BOOTSTRAP_OWNER_PASSWORD ?? 'change-me-local'
  const login = await request.post(`${API}/api/auth/login`, {
    data: { email, password },
  })
  if (login.ok()) return

  // Fallback: magic-link + OTP (dev helper) if password not seeded yet
  const magic = await request.post(`${API}/api/auth/magic-link`, {
    data: { email },
  })
  expect(magic.ok()).toBeTruthy()
  const otpRes = await request.post(`${API}/api/auth/dev/last-otp`, {
    data: { email },
  })
  if (otpRes.ok()) {
    const { code } = (await otpRes.json()) as { code: string }
    const verify = await request.post(`${API}/api/auth/verify-otp`, {
      data: { email, code },
    })
    expect(verify.ok()).toBeTruthy()
    return
  }
  test.skip(true, 'password login failed and OTP helper unavailable')
}

test.describe('core 23B @core23b', () => {
  test('API health', async ({ request }) => {
    const res = await request.get(`${API}/api/health`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.service).toBe('bu2-api')
  })

  test('login + create business + catalog + cmb + checkmap', async ({ request }) => {
    await loginAsBootstrap(request)

    const slug = `e2e-${Date.now().toString(36)}`
    const biz = await request.post(`${API}/api/businesses`, {
      data: { name: 'E2E Biz', slug },
    })
    expect(biz.ok()).toBeTruthy()

    const catalog = await request.post(`${API}/api/b/${slug}/catalog`, {
      data: { name: 'Product', currency: 'EUR', netPriceCents: 1000, taxRateBps: 1900, active: true },
    })
    expect(catalog.ok()).toBeTruthy()

    const cmb = await request.post(`${API}/api/b/${slug}/cmb/models`, {
      data: { name: 'Simple', useSimpleFixture: true },
    })
    expect(cmb.ok()).toBeTruthy()
    const model = (await cmb.json()).model
    const calc = await request.post(`${API}/api/b/${slug}/cmb/models/${model.id}/calculate`, {
      data: {},
    })
    expect(calc.ok()).toBeTruthy()
    const snap = (await calc.json()).snapshot
    expect(snap.contributionNet).toBe(3000)

    const board = await request.post(`${API}/api/b/${slug}/checkmap`, {
      data: {
        title: 'Map',
        nodes: [{ id: 'n1', type: 'todo', title: 'Task', x: 10, y: 10, status: 'open', priority: 'p2' }],
        edges: [],
      },
    })
    expect(board.ok()).toBeTruthy()

    const persona = await request.post(`${API}/api/b/${slug}/personas`, {
      data: { name: 'Buyer', summary: 'Test', goals: [], pains: [], channels: [], journey: [] },
    })
    expect(persona.ok()).toBeTruthy()

    const gates = await request.get(`${API}/api/b/${slug}/settings/feature-gates`)
    expect(gates.ok()).toBeTruthy()
  })

  test('login page renders Dark-Ops brand', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('Business Ultra')).toBeVisible()
  })

  test('archive blocked semantics endpoint exists', async ({ request }) => {
    await loginAsBootstrap(request)
    const slug = `arc-${Date.now().toString(36)}`
    await request.post(`${API}/api/businesses`, { data: { name: 'Arc', slug } })
    const res = await request.post(`${API}/api/b/${slug}/archive`, { data: {} })
    // empty remote posts → ok archive
    expect([200, 409]).toContain(res.status())
  })
})
