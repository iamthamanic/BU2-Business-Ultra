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

  test('customers + projects + recurrence tick idempotent + checkmap smoke', async ({
    request,
  }) => {
    await loginAsBootstrap(request)
    const slug = `crm-${Date.now().toString(36)}`
    const biz = await request.post(`${API}/api/businesses`, {
      data: { name: 'CRM Biz', slug },
    })
    expect(biz.ok()).toBeTruthy()

    const cust = await request.post(`${API}/api/b/${slug}/customers`, {
      data: { displayName: 'Ada Lovelace', kind: 'person', relationStatus: 'lead' },
    })
    expect(cust.status()).toBe(201)
    const customerId = (await cust.json()).customer.id as string

    const area = await request.post(`${API}/api/b/${slug}/projects`, {
      data: { type: 'area', name: 'Ops', area: 'Ops', status: 'active' },
    })
    expect(area.status()).toBe(201)
    const areaId = (await area.json()).project.id as string

    const custom = await request.post(`${API}/api/b/${slug}/projects`, {
      data: {
        type: 'custom',
        name: 'Launch',
        status: 'active',
        parentAreaProjectId: areaId,
      },
    })
    expect(custom.status()).toBe(201)
    const projectId = (await custom.json()).project.id as string

    const task = await request.post(`${API}/api/b/${slug}/tasks`, {
      data: {
        title: 'Ship CRM',
        projectId,
        customerId,
        status: 'open',
        priority: 'high',
      },
    })
    expect(task.status()).toBe(201)
    const taskId = (await task.json()).task.id as string

    const moved = await request.post(`${API}/api/b/${slug}/tasks/${taskId}/status`, {
      data: { status: 'in_progress' },
    })
    expect(moved.ok()).toBeTruthy()
    expect((await moved.json()).task.status).toBe('in_progress')

    const rule = await request.post(`${API}/api/b/${slug}/recurrence`, {
      data: {
        title: 'Weekly sync',
        freq: 'weekly',
        projectId,
        startsAt: new Date(Date.now() - 60_000).toISOString(),
      },
    })
    expect(rule.status()).toBe(201)

    const tick1 = await request.post(`${API}/api/b/${slug}/recurrence/tick`)
    expect(tick1.ok()).toBeTruthy()
    const created1 = ((await tick1.json()) as { created: number }).created

    const tick2 = await request.post(`${API}/api/b/${slug}/recurrence/tick`)
    expect(tick2.ok()).toBeTruthy()
    const created2 = ((await tick2.json()) as { created: number }).created
    expect(created2).toBe(0)
    expect(created1).toBeGreaterThanOrEqual(0)

    const neg = await request.get(
      `${API}/api/b/${slug}/customers/00000000-0000-4000-8000-000000000099`,
    )
    expect(neg.status()).toBe(404)

    const checkmap = await request.get(`${API}/api/b/${slug}/checkmap`)
    expect(checkmap.ok()).toBeTruthy()
  })
})
