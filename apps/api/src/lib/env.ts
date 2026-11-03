/**
 * Env loader for the API — reads monorepo root `.env` into process.env (without
 * overriding already-set vars), then validates with Zod.
 * Location: apps/api/src/lib/env.ts
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().default(8742),
  DATABASE_URL: z.string().min(1),
  PUBLIC_WEB_URL: z.string().url().default('http://127.0.0.1:8741'),
  PUBLIC_API_URL: z.string().url().default('http://127.0.0.1:8742'),
  CORS_ORIGIN: z.string().default('http://127.0.0.1:8741'),
  SECRETS_MASTER_KEY: z.string().min(16),
  SESSION_SECRET: z.string().min(16),
  BOOTSTRAP_OWNER_EMAIL: z.string().email().default('raccoova@gmail.com'),
  /** Local/dev bootstrap password only — never use the default in production */
  // Local/dev: short passwords allowed (e.g. 1234). Tighten for real deploys.
  BOOTSTRAP_OWNER_PASSWORD: z.string().min(4).default('change-me-local'),
  BREVO_SENDER_EMAIL: z.string().email().default('social@halteverbot123.de'),
  BREVO_SENDER_NAME: z.string().default('Business Ultra'),
  BREVO_API_KEY: z.string().optional().default(''),
  OPENSEO_BASE_URL: z.string().default('http://127.0.0.1:8750'),
  OPENSEO_SSO_SHARED_SECRET: z.string().min(8).default('change-me-openseo-sso-secret'),
  SORTANIZE_URL: z.string().default('http://127.0.0.1:8760'),
  UPLOADS_DIR: z.string().default('./uploads'),
})

export type Env = z.infer<typeof EnvSchema>

let cached: Env | null = null
let dotenvLoaded = false

/** Load KEY=VALUE pairs from monorepo `.env` into process.env (no override). */
function loadDotenvFromRoot(): void {
  if (dotenvLoaded) return
  dotenvLoaded = true
  const here = dirname(fileURLToPath(import.meta.url))
  // apps/api/src/lib → repo root
  const rootEnv = resolve(here, '../../../../.env')
  if (!existsSync(rootEnv)) return
  const text = readFileSync(rootEnv, 'utf8')
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

export function loadEnv(): Env {
  if (cached) return cached
  loadDotenvFromRoot()
  const parsed = EnvSchema.safeParse({
    ...process.env,
    DATABASE_URL:
      process.env.DATABASE_URL ??
      'postgresql://bu2:bu2_local_dev_change_me@127.0.0.1:5432/bu2',
    SECRETS_MASTER_KEY:
      process.env.SECRETS_MASTER_KEY ?? 'dev-only-secrets-master-key-32b!!',
    SESSION_SECRET: process.env.SESSION_SECRET ?? 'dev-only-session-secret-32bytes!!',
  })
  if (!parsed.success) {
    console.error('Invalid environment', parsed.error.flatten())
    throw new Error('Invalid environment configuration')
  }
  cached = parsed.data
  return cached
}
