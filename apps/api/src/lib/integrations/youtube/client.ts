/**
 * YouTube Data API helpers (channel stats + simple resumable upload).
 * Location: apps/api/src/lib/integrations/youtube/client.ts
 */
import type { OrganicPostRow } from '../../funnel-source.js'

type YtVideo = {
  id?: string
  snippet?: {
    title?: string
    publishedAt?: string
    thumbnails?: { medium?: { url?: string }; default?: { url?: string } }
  }
  statistics?: {
    viewCount?: string
    likeCount?: string
    commentCount?: string
  }
  contentDetails?: { duration?: string }
}

function parseDurationSec(iso: string | undefined): number | null {
  if (!iso) return null
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return null
  return (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Number(m[3] || 0)
}

export async function listChannelRecentVideos(
  accessToken: string,
  channelId: string,
  maxResults = 25,
): Promise<OrganicPostRow[]> {
  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
  searchUrl.searchParams.set('part', 'snippet')
  searchUrl.searchParams.set('channelId', channelId)
  searchUrl.searchParams.set('order', 'date')
  searchUrl.searchParams.set('type', 'video')
  searchUrl.searchParams.set('maxResults', String(maxResults))

  const searchRes = await fetch(searchUrl, {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  const searchJson = (await searchRes.json()) as {
    items?: Array<{ id?: { videoId?: string } }>
    error?: { message?: string }
  }
  if (!searchRes.ok) {
    throw Object.assign(new Error(`youtube_search_${searchRes.status}`), { statusCode: 502 })
  }
  const ids = (searchJson.items || [])
    .map((i) => i.id?.videoId)
    .filter((x): x is string => Boolean(x))
  if (!ids.length) return []

  const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
  videosUrl.searchParams.set('part', 'snippet,statistics,contentDetails')
  videosUrl.searchParams.set('id', ids.join(','))
  const videosRes = await fetch(videosUrl, {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  const videosJson = (await videosRes.json()) as { items?: YtVideo[] }
  if (!videosRes.ok) {
    throw Object.assign(new Error(`youtube_videos_${videosRes.status}`), { statusCode: 502 })
  }

  return (videosJson.items || []).map((v) => {
    const views = Number(v.statistics?.viewCount || 0)
    const likes = Number(v.statistics?.likeCount || 0)
    const comments = Number(v.statistics?.commentCount || 0)
    const durationSec = parseDurationSec(v.contentDetails?.duration)
    const isShort = durationSec != null && durationSec <= 60
    return {
      id: v.id || '',
      date: v.snippet?.publishedAt || new Date().toISOString(),
      type: isShort ? 'short' : 'video',
      bucket: isShort ? 'short' : 'long',
      title: v.snippet?.title || '(untitled)',
      url: v.id ? `https://www.youtube.com/watch?v=${v.id}` : null,
      image:
        v.snippet?.thumbnails?.medium?.url ||
        v.snippet?.thumbnails?.default?.url ||
        null,
      views,
      reach: null,
      likes,
      comments,
      shares: 0,
      saves: 0,
      engagement: views > 0 ? (likes + comments) / views : null,
      durationSec,
      watchPct: null,
      paidShare: null,
      sharesPer1000: null,
      savesPer1000: null,
      savesPer100: null,
      kpiHit: null,
    }
  })
}

/**
 * Resumable upload — metadata + binary body.
 * For large files callers should stream; V1 accepts full buffer.
 */
export async function uploadYoutubeVideo(opts: {
  accessToken: string
  title: string
  description?: string
  privacyStatus?: 'private' | 'unlisted' | 'public'
  mimeType: string
  body: Buffer
  publishAt?: string | null
}): Promise<{ id: string; status: string }> {
  const snippet: Record<string, unknown> = {
    title: opts.title,
    description: opts.description || '',
  }
  const status: Record<string, unknown> = {
    privacyStatus: opts.publishAt ? 'private' : opts.privacyStatus || 'private',
  }
  if (opts.publishAt) status.publishAt = opts.publishAt

  const initRes = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${opts.accessToken}`,
        'content-type': 'application/json; charset=UTF-8',
        'x-upload-content-type': opts.mimeType,
        'x-upload-content-length': String(opts.body.length),
      },
      body: JSON.stringify({ snippet, status }),
    },
  )
  const uploadUrl = initRes.headers.get('location')
  if (!initRes.ok || !uploadUrl) {
    throw Object.assign(new Error(`youtube_upload_init_${initRes.status}`), { statusCode: 502 })
  }

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'content-type': opts.mimeType,
      'content-length': String(opts.body.length),
    },
    body: opts.body,
  })
  const putJson = (await putRes.json()) as { id?: string; status?: { uploadStatus?: string } }
  if (!putRes.ok || !putJson.id) {
    throw Object.assign(new Error(`youtube_upload_${putRes.status}`), { statusCode: 502 })
  }
  return { id: putJson.id, status: putJson.status?.uploadStatus || 'uploaded' }
}
