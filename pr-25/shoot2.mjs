import { chromium } from '/workspace/bu2/apps/e2e/node_modules/@playwright/test/index.mjs'
import fs from 'node:fs'
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true })
const WEB = 'http://127.0.0.1:8741', S = 'physiopraxis-hammer'
const CID = 'f943264b-154f-4921-b1ad-5669e238068c', PID = '3c859f0b-1f6d-4463-90e1-3dffa1e4c33a'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 2200 }, locale: 'de-DE', timezoneId: 'Europe/Berlin', reducedMotion: 'reduce' })
const page = await ctx.newPage()
await page.clock.setFixedTime(new Date('2026-11-21T10:00:00+01:00'))
const log = []
async function settle() { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(700) }
async function shot(name) { await settle(); await page.mouse.move(0, 0); await page.screenshot({ path: `${out}/${name}.png`, animations: 'disabled', caret: 'hide' }) }
await page.goto(WEB + '/login')
await page.locator('input[autocomplete="username"]').first().fill(process.env.BOOTSTRAP_OWNER_EMAIL)
await page.locator('input[autocomplete="current-password"]').first().fill(process.env.BOOTSTRAP_OWNER_PASSWORD)
await page.getByRole('button', { name: /^Anmelden$/ }).click()
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 })
// customer detail tabs
await page.goto(`${WEB}/co/${S}/customer/${CID}`); await settle()
const tabs = await page.getByRole('tab').allTextContents()
log.push('customer tabs: ' + tabs.join(' | '))
for (let i = 0; i < tabs.length; i++) {
  await page.getByRole('tab').nth(i).click(); await shot(`t-kunde-tab-${String(i).padStart(2, '0')}`)
}
// inbox: open first conversation
await page.goto(`${WEB}/co/${S}/inbox`); await settle()
const conv = page.locator('[class*="inbox-conv"]').first()
if (await conv.count()) { await conv.click(); await shot('t-inbox-conversation') } else log.push('no inbox conv')
// products: first product
await page.goto(`${WEB}/co/${S}/product`); await settle()
const prow = page.getByText('Krankengymnastik Einzel').first()
if (await prow.count()) { await prow.click(); await shot('t-produkt-detail'); log.push('product url ' + page.url()) }
// product tabs
const mt = page.locator('.product-modal-overlay [role=tab]')
const ptabs = await mt.allTextContents(); log.push('product modal tabs: ' + ptabs.join(' | '))
for (let i = 0; i < ptabs.length; i++) { await mt.nth(i).click({ force: true }); await shot(`t-produkt-tab-${String(i).padStart(2, '0')}`) }
await page.keyboard.press('Escape')
// projects: board/table toggles + create modal
await page.goto(`${WEB}/co/${S}/projects/${PID}`); await shot('t-projekt-detail-tall')
const nb = page.getByRole('button', { name: /Projekt anlegen|Neues Projekt/i }).first()
await page.goto(`${WEB}/co/${S}/projects`); await settle()
if (await nb.count()) { await nb.click(); await shot('t-projekt-anlegen-modal') }
// customer create modal
await page.goto(`${WEB}/co/${S}/customer`); await settle()
const cb = page.getByRole('button', { name: /Kunde anlegen/i }).first()
if (await cb.count()) { await cb.click(); await shot('t-kunde-anlegen-modal') }
// connections tall + team
await page.goto(`${WEB}/co/${S}/settings#connections`); await shot('t-verbindungen-tall')
await page.goto(`${WEB}/co/${S}/marketing/personas`); await shot('t-personas-tall')
await page.goto(`${WEB}/co/${S}/finance`); await shot('t-finanzen-tall')
fs.writeFileSync(`${out}/_log.txt`, log.join('\n'))
await browser.close(); console.log(log.join('\n'))
