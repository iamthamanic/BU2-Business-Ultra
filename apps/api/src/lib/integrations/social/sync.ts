/**
 * Organic social sync workers (LinkedIn / TikTok / X / Pinterest).
 * Connect stores tokens; live list APIs are best-effort — fail soft like Meta/Inbox.
 * Location: apps/api/src/lib/integrations/social/sync.ts
 */
import type { OrganicPostRow } from '../../funnel-source.js'
import { getSocialAccessToken } from './tokens.js'

export type SocialSyncResult = {
  mode: 'live' | 'stub'
  posts: OrganicPostRow[]
  detail?: string
}

function emptyRow(partial: Partial<OrganicPostRow> & { id: string; title: string }): OrganicPostRow {
  return {
    date: partial.date || new Date().toISOString(),
    type: partial.type || 'post',
    bucket: partial.bucket || 'feed',
    url: partial.url ?? null,
    image: partial.image ?? null,
    views: partial.views ?? 0,
    reach: partial.reach ?? null,
    likes: partial.likes ?? 0,
    comments: partial.comments ?? 0,
    shares: partial.shares ?? 0,
    saves: partial.saves ?? 0,
    engagement: partial.engagement ?? null,
    durationSec: partial.durationSec ?? null,
    watchPct: partial.watchPct ?? null,
    paidShare: partial.paidShare ?? null,
    sharesPer1000: partial.sharesPer1000 ?? null,
    savesPer1000: partial.savesPer1000 ?? null,
    savesPer100: partial.savesPer100 ?? null,
    kpiHit: partial.kpiHit ?? null,
    ...partial,
  }
}

async function syncTikTok(accessToken: string): Promise<SocialSyncResult> {
  const res = await fetch(
    'https://open.tiktokapis.com/v2/video/list/?fields=id,title,create_time,cover_image_url,view_count,like_count,comment_count,share_count',
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ max_count: 20 }),
    },
  )
  const json = (await res.json()) as {
    data?: {
      videos?: Array<{
        id?: string
        title?: string
        create_time?: number
        cover_image_url?: string
        view_count?: number
        like_count?: number
        comment_count?: number
        share_count?: number
      }>
    }
    error?: { message?: string }
  }
  if (!res.ok) {
    return { mode: 'stub', posts: [], detail: `tiktok_list_${res.status}` }
  }
  const videos = json.data?.videos || []
  return {
    mode: 'live',
    posts: videos.map((v) => {
      const views = Number(v.view_count || 0)
      const likes = Number(v.like_count || 0)
      const comments = Number(v.comment_count || 0)
      return emptyRow({
        id: v.id || '',
        title: v.title || '(untitled)',
        date: v.create_time
          ? new Date(v.create_time * 1000).toISOString()
          : new Date().toISOString(),
        type: 'video',
        bucket: 'short',
        image: v.cover_image_url || null,
        url: v.id ? `https://www.tiktok.com/@/video/${v.id}` : null,
        views,
        likes,
        comments,
        shares: Number(v.share_count || 0),
        engagement: views > 0 ? (likes + comments) / views : null,
      })
    }),
  }
}

async function syncPinterest(accessToken: string): Promise<SocialSyncResult> {
  const res = await fetch('https://api.pinterest.com/v5/pins?page_size=25', {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  const json = (await res.json()) as {
    items?: Array<{
      id?: string
      title?: string
      created_at?: string
      link?: string
      media?: { images?: { '400x300'?: { url?: string } } }
    }>
  }
  if (!res.ok) {
    return { mode: 'stub', posts: [], detail: `pinterest_list_${res.status}` }
  }
  return {
    mode: 'live',
    posts: (json.items || []).map((p) =>
      emptyRow({
        id: p.id || '',
        title: p.title || '(untitled)',
        date: p.created_at || new Date().toISOString(),
        type: 'pin',
        bucket: 'feed',
        url: p.link || (p.id ? `https://www.pinterest.com/pin/${p.id}/` : null),
        image: p.media?.images?.['400x300']?.url || null,
      }),
    ),
  }
}

async function syncX(accessToken: string, externalAccountId: string): Promise<SocialSyncResult> {
  const meRes = await fetch('https://api.twitter.com/2/users/me', {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  const meJson = (await meRes.json()) as { data?: { id?: string } }
  const userId = meJson.data?.id || externalAccountId
  if (!meRes.ok || !userId) {
    return { mode: 'stub', posts: [], detail: `x_me_${meRes.status}` }
  }
  const res = await fetch(
    `https://api.twitter.com/2/users/${encodeURIComponent(userId)}/tweets?max_results=20&tweet.fields=created_at,public_metrics`,
    { headers: { authorization: `Bearer ${accessToken}` } },
  )
  const json = (await res.json()) as {
    data?: Array<{
      id?: string
      text?: string
      created_at?: string
      public_metrics?: {
        like_count?: number
        reply_count?: number
        retweet_count?: number
        impression_count?: number
      }
    }>
  }
  if (!res.ok) {
    return { mode: 'stub', posts: [], detail: `x_tweets_${res.status}` }
  }
  return {
    mode: 'live',
    posts: (json.data || []).map((t) => {
      const views = Number(t.public_metrics?.impression_count || 0)
      const likes = Number(t.public_metrics?.like_count || 0)
      const comments = Number(t.public_metrics?.reply_count || 0)
      return emptyRow({
        id: t.id || '',
        title: (t.text || '').slice(0, 120) || '(tweet)',
        date: t.created_at || new Date().toISOString(),
        type: 'post',
        bucket: 'feed',
        url: t.id ? `https://x.com/i/status/${t.id}` : null,
        views,
        likes,
        comments,
        shares: Number(t.public_metrics?.retweet_count || 0),
        engagement: views > 0 ? (likes + comments) / views : null,
      })
    }),
  }
}

async function syncLinkedIn(accessToken: string): Promise<SocialSyncResult> {
  // Member UGC list requires additional product scopes; keep soft stub until channel UI lands.
  const meRes = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  if (!meRes.ok) {
    return { mode: 'stub', posts: [], detail: `linkedin_userinfo_${meRes.status}` }
  }
  return {
    mode: 'stub',
    posts: [],
    detail: 'linkedin_ugc_worker_pending',
  }
}

export async function syncOrganicSocial(opts: {
  businessId: string
  connectionId: string
  channel: string
}): Promise<SocialSyncResult> {
  const { accessToken, provider, externalAccountId } = await getSocialAccessToken(
    opts.businessId,
    opts.connectionId,
  )
  const ch = opts.channel.toLowerCase()
  try {
    if (ch === 'tiktok' || provider === 'tiktok') return await syncTikTok(accessToken)
    if (ch === 'pinterest' || provider === 'pinterest') return await syncPinterest(accessToken)
    if (ch === 'x' || provider === 'x') return await syncX(accessToken, externalAccountId)
    if (ch === 'linkedin' || provider === 'linkedin') return await syncLinkedIn(accessToken)
    return { mode: 'stub', posts: [], detail: 'unknown_social_channel' }
  } catch (e) {
    return { mode: 'stub', posts: [], detail: String(e) }
  }
}
