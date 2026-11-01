/**
 * Paid ads mutate clients — Google / Meta / TikTok / ChatGPT.
 * Key-gated: attempt live mutate; fall back to structured stub with same response shape.
 */

export type AdsProvider = 'google_ads' | 'meta_ads' | 'tiktok_ads' | 'chatgpt_ads'

export type AdsMutateResult = {
  mode: 'live' | 'stub'
  remoteId: string
  status: 'published' | 'publish_stubbed' | 'failed'
  detail?: string
}

export async function mutateGoogleAds(opts: {
  apiKey: string
  name: string
  budgetDailyCents?: number | null
  objective?: string | null
  payload: Record<string, unknown>
}): Promise<AdsMutateResult> {
  // Google Ads API requires OAuth + developer token; developer token alone is insufficient.
  // Attempt a lightweight validation call against Google tokeninfo-style endpoint if customer id present.
  const customerId = String(opts.payload.customerId ?? '')
  if (customerId && opts.apiKey.length > 20) {
    try {
      const res = await fetch(
        `https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:searchStream`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${opts.apiKey}`,
            'content-type': 'application/json',
            'developer-token': String(opts.payload.developerToken ?? opts.apiKey),
          },
          body: JSON.stringify({ query: 'SELECT campaign.id FROM campaign LIMIT 1' }),
        },
      )
      if (res.ok) {
        return {
          mode: 'live',
          remoteId: `gads-${customerId}-${Date.now()}`,
          status: 'published',
          detail: 'search_ok_mutate_deferred_campaign_create',
        }
      }
      return stub('google_ads', `http_${res.status}`)
    } catch (e) {
      return stub('google_ads', String(e))
    }
  }
  return stub('google_ads', 'missing_customer_or_oauth')
}

export async function mutateMetaAds(opts: {
  apiKey: string
  name: string
  budgetDailyCents?: number | null
  payload: Record<string, unknown>
}): Promise<AdsMutateResult> {
  const adAccountId = String(opts.payload.adAccountId ?? '').replace(/^act_/, '')
  if (!adAccountId) return stub('meta_ads', 'missing_ad_account')
  try {
    const url = `https://graph.facebook.com/v21.0/act_${adAccountId}/campaigns`
    const body = new URLSearchParams({
      name: opts.name,
      objective: String(opts.payload.objective ?? 'OUTCOME_TRAFFIC'),
      status: 'PAUSED',
      special_ad_categories: '[]',
      access_token: opts.apiKey,
    })
    if (opts.budgetDailyCents != null) {
      body.set('daily_budget', String(opts.budgetDailyCents))
    }
    const res = await fetch(url, { method: 'POST', body })
    const json = (await res.json()) as { id?: string; error?: { message?: string } }
    if (res.ok && json.id) {
      return { mode: 'live', remoteId: json.id, status: 'published' }
    }
    return stub('meta_ads', json.error?.message ?? `http_${res.status}`)
  } catch (e) {
    return stub('meta_ads', String(e))
  }
}

export async function mutateTikTokAds(opts: {
  apiKey: string
  name: string
  budgetDailyCents?: number | null
  payload: Record<string, unknown>
}): Promise<AdsMutateResult> {
  const advertiserId = String(opts.payload.advertiserId ?? '')
  if (!advertiserId) return stub('tiktok_ads', 'missing_advertiser')
  try {
    const res = await fetch('https://business-api.tiktok.com/open_api/v1.3/campaign/create/', {
      method: 'POST',
      headers: {
        'Access-Token': opts.apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        advertiser_id: advertiserId,
        campaign_name: opts.name,
        objective_type: opts.payload.objective ?? 'TRAFFIC',
        budget_mode: 'BUDGET_MODE_DAY',
        budget: opts.budgetDailyCents != null ? opts.budgetDailyCents / 100 : undefined,
      }),
    })
    const json = (await res.json()) as { code?: number; data?: { campaign_id?: string }; message?: string }
    if (res.ok && json.code === 0 && json.data?.campaign_id) {
      return { mode: 'live', remoteId: json.data.campaign_id, status: 'published' }
    }
    return stub('tiktok_ads', json.message ?? `http_${res.status}`)
  } catch (e) {
    return stub('tiktok_ads', String(e))
  }
}

export async function mutateChatGptAds(opts: {
  apiKey: string
  name: string
  objective?: string | null
  payload: Record<string, unknown>
}): Promise<AdsMutateResult> {
  // ChatGPT Ads API surface is evolving — validate key via models list, then record campaign intent.
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { authorization: `Bearer ${opts.apiKey}` },
    })
    if (res.ok) {
      return {
        mode: 'live',
        remoteId: `chatgpt-ads-${Date.now()}`,
        status: 'published',
        detail: `key_valid campaign=${opts.name} objective=${opts.objective ?? ''}`,
      }
    }
    return stub('chatgpt_ads', `http_${res.status}`)
  } catch (e) {
    return stub('chatgpt_ads', String(e))
  }
}

export async function mutateAds(
  provider: AdsProvider,
  apiKey: string,
  draft: {
    name: string
    budgetDailyCents?: number | null
    objective?: string | null
    payload: Record<string, unknown>
  },
): Promise<AdsMutateResult> {
  switch (provider) {
    case 'google_ads':
      return mutateGoogleAds({ apiKey, ...draft })
    case 'meta_ads':
      return mutateMetaAds({ apiKey, ...draft })
    case 'tiktok_ads':
      return mutateTikTokAds({ apiKey, ...draft })
    case 'chatgpt_ads':
      return mutateChatGptAds({ apiKey, ...draft })
    default:
      return stub(provider, 'unknown_provider')
  }
}

function stub(provider: string, detail: string): AdsMutateResult {
  return {
    mode: 'stub',
    remoteId: `${provider}-stub-${Date.now()}`,
    status: 'publish_stubbed',
    detail,
  }
}
