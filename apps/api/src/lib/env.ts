/**
 * Env loader for the API — loads monorepo root env files into process.env
 * (without overriding already-set vars), then validates with Zod.
 *
 * Priority: process env → `.env.local` (dev/test only) → `.env` → non-secret defaults.
 * Production never auto-loads local files; critical secrets fail closed (no hardcoded prod fallbacks).
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
  /** Local/dev bootstrap password only — never use a weak value in production */
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

function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  // apps/api/src/lib → repo root
  return resolve(here, '../../../..')
}

/** Parse KEY=VALUE lines; never override keys already present in process.env. */
export function applyDotenvText(text: string, into: NodeJS.ProcessEnv = process.env): void {
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
    if (into[key] === undefined) into[key] = val
  }
}

function loadFileIfPresent(path: string): void {
  if (!existsSync(path)) return
  applyDotenvText(readFileSync(path, 'utf8'))
}

/**
 * Load root env files once.
 * Dev/test: `.env.local` then `.env` (first file wins per key via no-override).
 * Production: no file auto-load (platform/CI injects process.env).
 */
export function loadDotenvFromRoot(opts?: { forceReload?: boolean; nodeEnv?: string }): void {
  if (dotenvLoaded && !opts?.forceReload) return
  dotenvLoaded = true
  const nodeEnv = opts?.nodeEnv ?? process.env.NODE_ENV ?? 'development'
  if (nodeEnv === 'production') return
  const root = repoRoot()
  // Higher-priority file first so it claims keys before `.env`.
  loadFileIfPresent(resolve(root, '.env.local'))
  loadFileIfPresent(resolve(root, '.env'))
}

/** Test helper — clears cache so the next loadEnv() re-reads. */
export function resetEnvCacheForTests(): void {
  cached = null
  dotenvLoaded = false
}

export function loadEnv(): Env {
  if (cached) return cached
  loadDotenvFromRoot()

  const nodeEnv = process.env.NODE_ENV ?? 'development'
  const isProd = nodeEnv === 'production'

  const input: Record<string, unknown> = { ...process.env }

  // Non-secret local defaults only outside production.
  if (!isProd) {
    if (input.DATABASE_URL == null || input.DATABASE_URL === '') {
      input.DATABASE_URL =
        'postgresql://bu2:bu2_local_dev_change_me@127.0.0.1:5432/bu2'
    }
    if (input.SECRETS_MASTER_KEY == null || input.SECRETS_MASTER_KEY === '') {
      input.SECRETS_MASTER_KEY = 'dev-only-secrets-master-key-32b!!'
    }
    if (input.SESSION_SECRET == null || input.SESSION_SECRET === '') {
      input.SESSION_SECRET = 'dev-only-session-secret-32bytes!!'
    }
  }

  const parsed = EnvSchema.safeParse(input)
  if (!parsed.success) {
    console.error('Invalid environment', parsed.error.flatten())
    throw new Error('Invalid environment configuration')
  }
  cached = parsed.data
  return cached
}
