/**
 * Interactive CLI bootstrap for first install.
 * Location: apps/api/scripts/setup.ts
 * Run: pnpm --filter @bu2/api setup  OR  pnpm setup (root)
 */
import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { isBootstrapRequired, runBootstrap } from '../src/modules/auth/bootstrap.js'

async function ask(rl: readline.Interface, q: string, def?: string) {
  const hint = def ? ` [${def}]` : ''
  const a = (await rl.question(`${q}${hint}: `)).trim()
  return a || def || ''
}

async function main() {
  if (!(await isBootstrapRequired())) {
    console.error('Setup already completed (users exist).')
    process.exit(1)
  }
  const rl = readline.createInterface({ input, output })
  try {
    console.log('Business Ultra — first-time setup')
    const email = await ask(rl, 'Admin email')
    const password = await ask(rl, 'Admin password (min 8)')
    const displayName = await ask(rl, 'Display name', email.split('@')[0])
    const companyName = await ask(rl, 'First company name', 'My Company')
    const companySlug = await ask(
      rl,
      'Company slug',
      companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 64) || 'my-company',
    )
    const result = await runBootstrap({
      email,
      password,
      displayName,
      companyName,
      companySlug,
    })
    console.log('OK — user', result.user.email, 'company', result.business.slug)
    console.log('Log in at the web app with these credentials.')
  } finally {
    rl.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
