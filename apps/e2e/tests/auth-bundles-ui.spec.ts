/**
 * Auth Bundles UI proof — login, company shell, Settings → Team/bundles.
 * Screenshots → ../../.qa/evidence/auth-bundles-phase1/
 */
import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'

const API = process.env.PUBLIC_API_URL ?? 'http://127.0.0.1:8742'
const EMAIL = process.env.BOOTSTRAP_OWNER_EMAIL ?? 'raccoova@gmail.com'
const PASSWORD =
  (process.env.BOOTSTRAP_OWNER_PASSWORD && process.env.BOOTSTRAP_OWNER_PASSWORD.length >= 8
    ? process.env.BOOTSTRAP_OWNER_PASSWORD
    : null) ?? 'change-me-local'

const evidenceDir = path.resolve(process.cwd(), '../../.qa/evidence/auth-bundles-phase1')

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(evidenceDir, name), fullPage: true })
}

async function uiLogin(page: Page) {
  await page.goto('/login')
  await expect(page.getByText('Business Ultra')).toBeVisible()
  await page.locator('input[type="email"]').fill(EMAIL)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: /anmelden|sign in|login/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 })
}

test.describe('auth bundles UI @verify-ui', () => {
  test('setup status + login + team bundles screenshots', async ({ page, request }) => {
    const status = await request.get(`${API}/api/setup/status`)
    expect(status.ok()).toBeTruthy()
    const { required } = (await status.json()) as { required: boolean }

    if (required) {
      await page.goto('/')
      await expect(page.locator('form, .login-page, .setup-page').first()).toBeVisible()
      await shot(page, '01-setup-wizard.png')
    } else {
      // Bootstrap already done — capture login as primary AuthN surface
      await page.goto('/login')
      await expect(page.getByText('Business Ultra')).toBeVisible()
      await shot(page, '01-setup-skipped-login.png')
    }

    await page.goto('/login')
    await expect(page.getByText('Business Ultra')).toBeVisible()
    await shot(page, '02-login-password.png')

    await uiLogin(page)

    // Prefer existing company; else create via API with session cookie from UI is hard —
    // list businesses after login via page context cookies by navigating home.
    await page.goto('/')
    await page.waitForTimeout(800)

    const bizRes = await request.post(`${API}/api/auth/login`, {
      data: { email: EMAIL, password: PASSWORD },
    })
    expect(bizRes.ok()).toBeTruthy()
    const list = await request.get(`${API}/api/businesses`)
    expect(list.ok()).toBeTruthy()
    const businesses = ((await list.json()) as { businesses: { slug: string; name: string }[] })
      .businesses
    expect(businesses.length).toBeGreaterThan(0)
    const slug = businesses.find((b) => b.slug === 'business-ultra')?.slug ?? businesses[0]!.slug

    await page.goto(`/co/${slug}`)
    await expect(page.locator('.shell-root, .sb-nav, [data-ic]').first()).toBeVisible({
      timeout: 15_000,
    })
    await shot(page, '03-company-switcher-create.png')

    await page.goto(`/co/${slug}/settings#team`)
    await expect(page.getByRole('heading', { name: /team/i }).first()).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText(/bundle|bundles|einladen|invite/i).first()).toBeVisible()
    await shot(page, '04-team-bundles.png')
  })
})
