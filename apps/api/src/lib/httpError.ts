/**
 * Map thrown errors (optionally with statusCode) to HTTP status + message.
 * Location: apps/api/src/lib/httpError.ts
 */
export function httpError(e: unknown): { status: number; error: string } {
  const err = e as Error & { statusCode?: number }
  return {
    status: err.statusCode && err.statusCode >= 400 ? err.statusCode : 500,
    error: err.message || 'error',
  }
}
