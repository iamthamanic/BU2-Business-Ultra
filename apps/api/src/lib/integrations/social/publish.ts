/**
 * Organic social publish stubs — Connect stores tokens; mutate workers follow
 * separately (same pattern as Meta DMs / Inbox adapters).
 * Location: apps/api/src/lib/integrations/social/publish.ts
 */
import { getSocialAccessToken } from './tokens.js'

export type SocialPublishResult = {
  mode: 'live' | 'stub'
  remoteId: string
  status: 'published' | 'publish_stubbed' | 'failed'
  detail?: string
}

const SUPPORTED = new Set(['linkedin', 'tiktok', 'x', 'pinterest'])

/**
 * Publish a text/media post to a connected organic channel.
 * Currently fail-soft stub after verifying the connection token loads.
 */
export async function publishOrganicSocial(opts: {
  businessId: string
  connectionId: string
  provider: string
  text: string
  mediaUrl?: string | null
}): Promise<SocialPublishResult> {
  if (!SUPPORTED.has(opts.provider)) {
    return {
      mode: 'stub',
      remoteId: `${opts.provider}-stub-${Date.now()}`,
      status: 'publish_stubbed',
      detail: 'provider_unsupported',
    }
  }
  try {
    await getSocialAccessToken(opts.businessId, opts.connectionId)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'credential_error'
    return {
      mode: 'stub',
      remoteId: `${opts.provider}-failed-${Date.now()}`,
      status: 'failed',
      detail: msg.slice(0, 80),
    }
  }
  return {
    mode: 'stub',
    remoteId: `${opts.provider}-stub-${Date.now()}`,
    status: 'publish_stubbed',
    detail: 'channel_worker_pending',
  }
}
