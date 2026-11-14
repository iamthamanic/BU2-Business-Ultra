/**
 * finAPI platform credentials — from env only (never Settings UI).
 * Location: apps/api/src/lib/integrations/finapi/config.ts
 */
import { loadDotenvFromRoot } from '../../env.js'

function trimEnv(name: string): string {
  loadDotenvFromRoot()
  return process.env[name]?.trim() ?? ''
}

export type FinapiPlatformConfig = {
  clientId: string
  clientSecret: string
  dataDecryptionKey: string | null
  baseUrl: string
  configured: boolean
}

const DEFAULT_SANDBOX = 'https://sandbox.finapi.io'

export function getFinapiPlatformConfig(): FinapiPlatformConfig {
  const clientId = trimEnv('FINAPI_CLIENT_ID')
  const clientSecret = trimEnv('FINAPI_CLIENT_SECRET')
  const dataDecryptionKey = trimEnv('FINAPI_DATA_DECRYPTION_KEY') || null
  const baseUrl = (trimEnv('FINAPI_BASE_URL') || DEFAULT_SANDBOX).replace(/\/$/, '')
  return {
    clientId,
    clientSecret,
    dataDecryptionKey,
    baseUrl,
    configured: Boolean(clientId && clientSecret),
  }
}

/** Client-credentials token probe — fail-closed when env missing. */
export async function verifyFinapiPlatformCredentials(): Promise<{
  ok: boolean
  detail: string
}> {
  const cfg = getFinapiPlatformConfig()
  if (!cfg.configured) {
    return { ok: false, detail: 'finapi_env_not_configured' }
  }
  try {
    const res = await fetch(`${cfg.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
      }),
    })
    if (!res.ok) {
      return { ok: false, detail: `finapi_token_http_${res.status}` }
    }
    const json = (await res.json()) as { access_token?: string }
    if (!json.access_token) {
      return { ok: false, detail: 'finapi_token_missing' }
    }
    return { ok: true, detail: 'ok' }
  } catch (e) {
    return { ok: false, detail: String((e as Error).message || e) }
  }
}
