/**
 * Google Ads API helpers — list customers + read campaigns via OAuth (Cloud project access).
 * Location: apps/api/src/lib/integrations/googleAds/client.ts
 */

async function adsFetch(opts: {
  accessToken: string
  path: string
  method?: string
  body?: unknown
  loginCustomerId?: string
}): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${opts.accessToken}`,
    'content-type': 'application/json',
  }
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim()
  if (developerToken) {
    headers['developer-token'] = developerToken
  }
  if (opts.loginCustomerId) {
    headers['login-customer-id'] = opts.loginCustomerId.replace(/-/g, '')
  }
  const res = await fetch(`https://googleads.googleapis.com/v18/${opts.path}`, {
    method: opts.method || 'GET',
    headers,
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  })
  const text = await res.text()
  let json: Record<string, unknown> = {}
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch {
    json = { raw: text }
  }
  return { ok: res.ok, status: res.status, json }
}

function adsApiError(prefix: string, status: number, json: Record<string, unknown>): Error {
  const msg =
    typeof (json as { error?: { message?: string } }).error?.message === 'string'
      ? String((json as { error: { message: string } }).error.message)
      : `${prefix}_${status}`
  const hint =
    status === 403 || status === 401
      ? ' Enable Google Ads API on the OAuth Cloud project and ensure Ads API access (Test/Explorer) in Cloud Console.'
      : ''
  return Object.assign(new Error(`${msg}${hint}`.trim()), {
    statusCode: status >= 400 && status < 600 ? status : 502,
    detail: json,
  })
}

/** List customer IDs reachable with this OAuth token. */
export async function listAccessibleCustomers(accessToken: string): Promise<string[]> {
  const { ok, status, json } = await adsFetch({
    accessToken,
    path: 'customers:listAccessibleCustomers',
    method: 'POST',
    body: {},
  })
  if (!ok) throw adsApiError('google_ads_list_customers', status, json)
  const names = Array.isArray(json.resourceNames) ? (json.resourceNames as string[]) : []
  return names
    .map((n) => n.replace(/^customers\//, '').replace(/-/g, ''))
    .filter(Boolean)
}

export type GoogleAdsCampaignRow = {
  id: string
  name: string
  status: string
  channelType: string | null
}

export async function listCampaigns(
  accessToken: string,
  customerId: string,
): Promise<GoogleAdsCampaignRow[]> {
  const cid = customerId.replace(/-/g, '')
  const { ok, status, json } = await adsFetch({
    accessToken,
    path: `customers/${cid}/googleAds:search`,
    method: 'POST',
    body: {
      query:
        'SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type FROM campaign ORDER BY campaign.id',
    },
    loginCustomerId: cid,
  })
  if (!ok) throw adsApiError('google_ads_search', status, json)
  const results = Array.isArray(json.results) ? json.results : []
  const out: GoogleAdsCampaignRow[] = []
  for (const row of results) {
    const r = row as {
      campaign?: {
        id?: string
        name?: string
        status?: string
        advertisingChannelType?: string
      }
    }
    if (!r.campaign?.id) continue
    out.push({
      id: String(r.campaign.id),
      name: r.campaign.name || String(r.campaign.id),
      status: r.campaign.status || 'UNKNOWN',
      channelType: r.campaign.advertisingChannelType || null,
    })
  }
  return out
}
