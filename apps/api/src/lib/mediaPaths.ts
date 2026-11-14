/**
 * Canonical private media URL helpers (authenticated routes only).
 * Disk layout: `{UPLOADS_DIR}/{businessId}/…`
 * Location: apps/api/src/lib/mediaPaths.ts
 */
import { resolve, sep } from 'node:path'

/** Public API path for a file under a business uploads tree. */
export function mediaApiPath(businessId: string, ...relativeParts: string[]): string {
  const safe = relativeParts.map((p) => p.replace(/^\/+/, '').replace(/\.\./g, ''))
  return `/api/media/${businessId}/${safe.join('/')}`
}

/**
 * Resolve a request path under uploadsDir confined to businessId.
 * Returns null on traversal / escape attempts.
 */
export function resolveBusinessMediaFile(
  uploadsDir: string,
  businessId: string,
  relativePath: string,
): string | null {
  if (!businessId || businessId.includes('..') || businessId.includes('/') || businessId.includes('\\')) {
    return null
  }
  const cleaned = relativePath.replace(/^\/+/, '').replace(/\\/g, '/')
  if (!cleaned || cleaned.includes('\0') || cleaned.split('/').some((p) => p === '..')) {
    return null
  }
  const root = resolve(uploadsDir, businessId)
  const full = resolve(root, cleaned)
  const rootWithSep = root.endsWith(sep) ? root : root + sep
  if (full !== root && !full.startsWith(rootWithSep)) return null
  return full
}

/** Map legacy `/uploads/{businessId}/…` or `/api/media/{businessId}/…` to relative parts. */
export function parseMediaUrlPath(urlPath: string): { businessId: string; relative: string } | null {
  const p = urlPath.replace(/^\/+/, '')
  const uploads = p.match(/^uploads\/([^/]+)\/(.+)$/)
  if (uploads) return { businessId: uploads[1]!, relative: uploads[2]! }
  const api = p.match(/^api\/media\/([^/]+)\/(.+)$/)
  if (api) return { businessId: api[1]!, relative: api[2]! }
  return null
}
