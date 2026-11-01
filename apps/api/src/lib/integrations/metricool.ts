/**
 * Metricool API client — scheduler SoR for social.
 * Live when apiKey present; otherwise returns stub payloads with identical shapes.
 */

export type MetricoolNetwork =
  | 'facebook'
  | 'instagram'
  | 'linkedin'
  | 'tiktok'
  | 'youtube'
  | 'x'
  | 'pinterest'
  | 'threads'

export type MediaKind = 'image' | 'video' | 'carousel' | 'text'

export type NetworkCapability = {
  network: MetricoolNetwork
  canSchedule: boolean
  supportsImage: boolean
  supportsVideo: boolean
  supportsCarousel: boolean
  maxTextLength: number
  notes?: string
}

/** Conservative capability matrix from Metricool public docs (platform limits). */
export const NETWORK_CAPABILITIES: NetworkCapability[] = [
  { network: 'facebook', canSchedule: true, supportsImage: true, supportsVideo: true, supportsCarousel: true, maxTextLength: 63206 },
  { network: 'instagram', canSchedule: true, supportsImage: true, supportsVideo: true, supportsCarousel: true, maxTextLength: 2200 },
  { network: 'linkedin', canSchedule: true, supportsImage: true, supportsVideo: true, supportsCarousel: false, maxTextLength: 3000 },
  { network: 'tiktok', canSchedule: true, supportsImage: false, supportsVideo: true, supportsCarousel: false, maxTextLength: 2200, notes: 'Stories not via Metricool API' },
  { network: 'youtube', canSchedule: true, supportsImage: false, supportsVideo: true, supportsCarousel: false, maxTextLength: 5000, notes: 'Community posts not via Metricool' },
  { network: 'x', canSchedule: true, supportsImage: true, supportsVideo: true, supportsCarousel: false, maxTextLength: 280 },
  { network: 'pinterest', canSchedule: true, supportsImage: true, supportsVideo: true, supportsCarousel: false, maxTextLength: 500 },
  { network: 'threads', canSchedule: true, supportsImage: true, supportsVideo: true, supportsCarousel: false, maxTextLength: 500 },
]

export type ScheduleTarget = {
  network: MetricoolNetwork
  text?: string
  mediaUrls?: string[]
  mediaKind?: MediaKind
  format?: string
  scheduledAt?: string
  enabled?: boolean
}

export type ScheduleResult = {
  network: MetricoolNetwork
  status: 'scheduled' | 'unsupported' | 'failed' | 'skipped'
  mode: 'live' | 'stub'
  remoteId?: string
  error?: string
  retryable: boolean
}

async function mcFetch(
  apiKey: string,
  path: string,
  init?: RequestInit & { query?: Record<string, string> },
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const q = new URLSearchParams(init?.query ?? {})
  const url = `https://app.metricool.com${path}${q.toString() ? `?${q}` : ''}`
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 30_000)
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        'X-Mc-Auth': apiKey,
        accept: 'application/json',
        'content-type': 'application/json',
        ...(init?.headers ?? {}),
      },
      signal: ctrl.signal,
    })
    const text = await res.text()
    let body: unknown = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = { raw: text }
    }
    return { ok: res.ok, status: res.status, body }
  } catch (e) {
    return { ok: false, status: 502, body: { error: String(e) } }
  } finally {
    clearTimeout(t)
  }
}

export function capabilityFor(network: MetricoolNetwork): NetworkCapability | undefined {
  return NETWORK_CAPABILITIES.find((c) => c.network === network)
}

export function preflightTarget(target: ScheduleTarget): { ok: boolean; reason?: string } {
  if (target.enabled === false) return { ok: false, reason: 'disabled' }
  const cap = capabilityFor(target.network)
  if (!cap?.canSchedule) return { ok: false, reason: 'unsupported_network' }
  const kind = target.mediaKind ?? (target.mediaUrls?.length ? 'image' : 'text')
  if (kind === 'video' && !cap.supportsVideo) return { ok: false, reason: 'video_unsupported' }
  if (kind === 'image' && !cap.supportsImage) return { ok: false, reason: 'image_unsupported' }
  if (kind === 'carousel' && !cap.supportsCarousel) return { ok: false, reason: 'carousel_unsupported' }
  const text = target.text ?? ''
  if (text.length > cap.maxTextLength) return { ok: false, reason: 'text_too_long' }
  return { ok: true }
}

export async function listBrands(apiKey: string, userId?: string) {
  if (!apiKey || apiKey.length < 8) {
    return { mode: 'stub' as const, brands: [] as { blogId: string; label: string; networks: unknown }[] }
  }
  const q: Record<string, string> = {}
  if (userId) q.userId = userId
  const res = await mcFetch(apiKey, '/api/admin/simpleProfiles', { query: q })
  if (!res.ok) {
    return {
      mode: 'stub' as const,
      brands: [],
      error: `metricool ${res.status}`,
    }
  }
  const data = res.body
  const list = Array.isArray(data)
    ? data
    : ((data as { data?: unknown[]; profiles?: unknown[] })?.data ??
      (data as { profiles?: unknown[] })?.profiles ??
      [])
  const brands = (Array.isArray(list) ? list : []).map((p) => {
    const row = p as Record<string, unknown>
    return {
      blogId: String(row.id ?? row.blogId ?? row.blog_id ?? ''),
      label: String(row.title ?? row.name ?? row.label ?? row.id ?? ''),
      networks: row.networks ?? row.network ?? null,
    }
  }).filter((b) => b.blogId)
  return { mode: 'live' as const, brands }
}

export async function scheduleTargets(opts: {
  apiKey: string
  blogId?: string
  userId?: string
  masterText: string
  title: string
  targets: ScheduleTarget[]
  onlyNetworks?: MetricoolNetwork[]
}): Promise<{ results: ScheduleResult[]; mode: 'live' | 'stub' | 'mixed' }> {
  const results: ScheduleResult[] = []
  let anyLive = false
  let anyStub = false

  for (const target of opts.targets) {
    if (opts.onlyNetworks && !opts.onlyNetworks.includes(target.network)) {
      results.push({
        network: target.network,
        status: 'skipped',
        mode: 'stub',
        retryable: false,
      })
      continue
    }
    const pf = preflightTarget(target)
    if (!pf.ok) {
      results.push({
        network: target.network,
        status: pf.reason === 'disabled' ? 'skipped' : 'unsupported',
        mode: 'stub',
        error: pf.reason,
        retryable: false,
      })
      continue
    }

    const text = target.text ?? opts.masterText
    const payload = {
      text,
      title: opts.title,
      providers: [target.network],
      publicationDate: target.scheduledAt,
      autoPublish: true,
      media: (target.mediaUrls ?? []).map((url) => ({ url })),
      blogId: opts.blogId,
      userId: opts.userId,
    }

    if (!opts.apiKey || opts.apiKey.length < 8) {
      anyStub = true
      results.push({
        network: target.network,
        status: 'scheduled',
        mode: 'stub',
        remoteId: `stub-${target.network}-${Date.now()}`,
        retryable: true,
      })
      continue
    }

    const res = await mcFetch(opts.apiKey, '/api/v2/scheduler/posts', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      anyLive = true
      const body = res.body as { id?: string | number }
      results.push({
        network: target.network,
        status: 'scheduled',
        mode: 'live',
        remoteId: body?.id != null ? String(body.id) : undefined,
        retryable: false,
      })
    } else {
      anyStub = true
      // Preserve draft success for other targets; mark this one retryable
      results.push({
        network: target.network,
        status: 'failed',
        mode: 'stub',
        error: `http_${res.status}`,
        retryable: true,
        remoteId: `pending-retry-${target.network}`,
      })
    }
  }

  const mode = anyLive && anyStub ? 'mixed' : anyLive ? 'live' : 'stub'
  return { results, mode }
}

export async function retryFailedTargets(opts: {
  apiKey: string
  blogId?: string
  userId?: string
  masterText: string
  title: string
  targets: ScheduleTarget[]
  previous: Record<string, { status?: string; retryable?: boolean }>
}) {
  const retryNets = opts.targets.filter((t) => {
    const prev = opts.previous[t.network]
    return prev?.retryable || prev?.status === 'failed'
  })
  return scheduleTargets({
    ...opts,
    targets: retryNets,
  })
}
