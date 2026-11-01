import { readFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { loadEnv } from '../lib/env.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function main() {
  const env = loadEnv()
  const sql = postgres(env.DATABASE_URL, { max: 1 })

  // Ensure SQL migrations dir exists; prefer drizzle SQL or bootstrap DDL
  const drizzleDir = join(__dirname, '../../drizzle')
  if (!existsSync(drizzleDir)) mkdirSync(drizzleDir, { recursive: true })

  const bootstrap = join(__dirname, 'bootstrap.sql')
  const sqlText = readFileSync(bootstrap, 'utf8')
  await sql.unsafe(sqlText)

  // Apply any additional numbered .sql files
  const files = existsSync(drizzleDir)
    ? readdirSync(drizzleDir).filter((f) => f.endsWith('.sql')).sort()
    : []
  for (const f of files) {
    const body = readFileSync(join(drizzleDir, f), 'utf8')
    if (body.trim()) await sql.unsafe(body)
  }

  console.info('[db] migrations applied')
  await sql.end()
}

main().catch((err) => {
  console.error('[db] migrate failed', err)
  process.exit(1)
})
