// Usage: node shoot.mjs <outDir> ; expects web on 8741, api on 8742, legal static on 8800
import { chromium } from '/workspace/bu2/apps/e2e/node_modules/@playwright/test/index.mjs'
import fs from 'node:fs'
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true })
const WEB = 'http://127.0.0.1:8741', LEGAL = 'http://127.0.0.1:8800'
const S = 'physiopraxis-hammer'
const CID = 'f943264b-154f-4921-b1ad-5669e238068c', PID = '3c859f0b-1f6d-4463-90e1-3dffa1e4c33a'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'de-DE', timezoneId: 'Europe/Berlin', reducedMotion: 'reduce' })
const page = await ctx.newPage()
await page.clock.setFixedTime(new Date('2026-11-21T10:00:00+01:00'))
const errors = []
page.on('pageerror', (e) => errors.push(`${page.url()} :: ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error') errors.push(`${page.url()} :: console: ${m.text()}`) })
async function settle() { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(800) }
async function shot(name, full = true) { await settle(); await page.screenshot({ path: `${out}/${name}.png`, fullPage: full, animations: 'disabled', caret: 'hide' }) }
// setup screen (status mocked -> required)
await page.route('**/api/setup/status', (r) => r.fulfill({ json: { required: true } }))
await page.goto(WEB + '/'); await shot('01-setup')
await page.unroute('**/api/setup/status')
await page.goto(WEB + '/login'); await shot('02-login')
await page.locator('input[autocomplete="username"]').first().fill(process.env.BOOTSTRAP_OWNER_EMAIL)
await page.locator('input[autocomplete="current-password"]').first().fill(process.env.BOOTSTRAP_OWNER_PASSWORD)
await page.getByRole('button', { name: /^Anmelden$/ }).click()
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 })
const routes = [
  ['03-admin', '/admin'],
  ['10-kontakte-kunden', `/co/${S}/customer`],
  ['11-kontakte-partner', `/co/${S}/partner`],
  ['12-kundendetail', `/co/${S}/customer/${CID}`],
  ['20-inbox', `/co/${S}/inbox`],
  ['30-verbindungen', `/co/${S}/settings#connections`],
  ['31-settings-details', `/co/${S}/settings#details`],
  ['32-settings-team', `/co/${S}/settings#team`],
  ['40-projekte', `/co/${S}/projects`],
  ['41-projekt-detail', `/co/${S}/projects/${PID}`],
  ['42-meine-aufgaben', `/co/${S}/projects/mine`],
  ['50-produkte', `/co/${S}/product`],
  ['60-marketing', `/co/${S}/marketing`],
  ['61-marketing-personas', `/co/${S}/marketing/personas`],
  ['62-marketing-planung', `/co/${S}/marketing/funnel/organic/planung`],
  ['63-marketing-paid', `/co/${S}/marketing/funnel/paid`],
  ['64-marketing-email', `/co/${S}/marketing/funnel/custom/email`],
  ['70-finanzen', `/co/${S}/finance`],
  ['80-tools', `/co/${S}/tools`],
  ['90-app-rechtliches', '/rechtliches'],
  ['91-app-rechtliches-datenschutz', '/rechtliches/datenschutz'],
]
const finalUrls = {}
for (const [name, path] of routes) {
  await page.goto(WEB + path); await shot(name); finalUrls[name] = page.url().replace(WEB, '')
}
// legacy redirects / deep links
for (const p of ['/co/' + S + '/catalog', '/co/' + S + '/contacts', '/co/' + S + '/overview', '/co/' + S + '/ads', '/co/' + S + '/cmb', '/legal', '/b/' + S + '/customers']) {
  await page.goto(WEB + p); await settle(); finalUrls['redirect ' + p] = page.url().replace(WEB, '')
}
// static legal deploy site
for (const [name, p] of [['95-legal-root', '/'], ['96-legal-rechtliches', '/rechtliches/'], ['97-legal-datenschutz', '/rechtliches/datenschutz/'], ['98-legal-nutzungsbedingungen', '/rechtliches/nutzungsbedingungen/'], ['99-legal-datenloeschung', '/rechtliches/datenloeschung/']]) {
  const p2 = await ctx.newPage(); const failed = []
  p2.on('requestfailed', (r) => failed.push(r.url())); p2.on('response', (r) => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()) })
  await p2.goto(LEGAL + p, { waitUntil: 'commit' })
  if (name === '95-legal-root') { await p2.waitForTimeout(150); await p2.screenshot({ path: `${out}/${name}-before-redirect.png` }) }
  await p2.waitForLoadState('networkidle'); await p2.waitForTimeout(500)
  await p2.screenshot({ path: `${out}/${name}.png`, fullPage: true }); finalUrls[name] = p2.url() + (failed.length ? ' FAILED:' + failed.join(',') : '')
  await p2.close()
}
fs.writeFileSync(`${out}/_urls.json`, JSON.stringify(finalUrls, null, 2))
fs.writeFileSync(`${out}/_errors.txt`, errors.join('\n'))
await browser.close()
console.log('done', out, 'errors:', errors.length)
