/**
 * lastCompany — persist the last selected company slug for post-login / home redirect.
 * Location: apps/web/src/lib/lastCompany.ts
 */

const KEY = 'bu2_last_company'

export function readLastCompany(): string | null {
  try {
    const v = localStorage.getItem(KEY)
    return v && v.trim() ? v.trim() : null
  } catch {
    return null
  }
}

export function writeLastCompany(slug: string) {
  try {
    if (slug) localStorage.setItem(KEY, slug)
    else localStorage.removeItem(KEY)
  } catch {
    /* ignore quota / private mode */
  }
}

export type CompanyPick = { slug: string; status: string }

/** Prefer stored slug among active memberships; else first active. */
export function pickLandingSlug(companies: CompanyPick[]): string | null {
  const active = companies.filter((c) => c.status !== 'archived')
  if (!active.length) return null
  const last = readLastCompany()
  if (last && active.some((c) => c.slug === last)) return last
  return active[0]!.slug
}
