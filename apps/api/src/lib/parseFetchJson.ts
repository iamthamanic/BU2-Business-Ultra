/**
 * Parse Response body as JSON; never throw on empty/invalid payload.
 * Location: apps/api/src/lib/parseFetchJson.ts
 */
export async function parseFetchJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return { raw: text }
  }
}

/** Typed variant — returns null when body is empty; throws on invalid JSON if throwOnBad. */
export async function parseFetchJsonAs<T>(
  res: Response,
  opts?: { throwOnBad?: boolean; emptyAs?: T },
): Promise<T> {
  const text = await res.text()
  if (!text) {
    if (opts?.emptyAs !== undefined) return opts.emptyAs
    return {} as T
  }
  try {
    return JSON.parse(text) as T
  } catch {
    if (opts?.throwOnBad) {
      throw Object.assign(new Error(`bad_json:${res.status}`), { statusCode: 502 })
    }
    return { raw: text } as T
  }
}
