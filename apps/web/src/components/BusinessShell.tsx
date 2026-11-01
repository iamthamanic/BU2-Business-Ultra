/**
 * BusinessShell — /b/:slug layout with collapsible module sidebar (legacy parity).
 * Location: apps/web/src/components/BusinessShell.tsx
 */
import { useEffect, useMemo, useState } from 'react'
import { Outlet, useParams } from 'react-router-dom'
import {
  SquaresFour,
  Package,
  Megaphone,
  Target,
  Calculator,
  MapTrifold,
  UsersThree,
  ArrowsDownUp,
  MagnifyingGlass,
  GearSix,
  Buildings,
} from '@phosphor-icons/react'
import { api } from '../lib/api'
import { useI18n } from '../lib/i18n'
import type { AuthUser } from '../app/App'
import { AppShell } from './AppShell'
import type { RailItem } from './IconRail'

export function BusinessShell({
  user,
  onLogout,
}: {
  user: AuthUser
  onLogout: () => void
}) {
  const { slug } = useParams()
  const { t } = useI18n()
  const [biz, setBiz] = useState<{ name: string; status: string; logoPath?: string | null } | null>(null)

  useEffect(() => {
    if (!slug) return
    api<{ business: { name: string; status: string; logoPath?: string | null } }>(`/api/b/${slug}`)
      .then((r) => setBiz(r.business))
      .catch(() => setBiz(null))
  }, [slug])

  const base = `/b/${slug}`
  const railItems: RailItem[] = useMemo(
    () => [
      { key: 'home', to: '/', end: true, label: t('businesses'), icon: Buildings },
      { key: 'overview', to: base, end: true, label: t('overview'), icon: SquaresFour },
      { key: 'catalog', to: `${base}/catalog`, label: t('catalog'), icon: Package },
      { key: 'marketing', to: `${base}/marketing`, label: t('marketing'), icon: Megaphone },
      { key: 'ads', to: `${base}/ads`, label: t('ads'), icon: Target },
      { key: 'cmb', to: `${base}/cmb`, label: t('cmb'), icon: Calculator },
      { key: 'checkmap', to: `${base}/checkmap`, label: t('checkmap'), icon: MapTrifold },
      { key: 'personas', to: `${base}/personas`, label: t('personas'), icon: UsersThree },
      { key: 'sortanize', to: `${base}/sortanize`, label: t('sortanize'), icon: ArrowsDownUp },
      { key: 'openseo', to: `${base}/openseo`, label: t('openseo'), icon: MagnifyingGlass },
      { key: 'settings', to: `${base}/settings`, label: t('settings'), icon: GearSix },
    ],
    [base, t],
  )

  const subtitle = (
    <>
      <span>{biz?.name ?? slug}</span>
      {biz?.status === 'archived' ? <span className="badge warn">archived</span> : null}
    </>
  )

  return (
    <AppShell user={user} railItems={railItems} subtitle={subtitle} onLogout={onLogout}>
      <Outlet context={{ slug: slug!, user }} />
    </AppShell>
  )
}
