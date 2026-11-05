/**
 * BusinessShell — `/co/:slug` layout with department sidebar IA.
 * Flat Inbox · Marketing · Product · Customer · Projects · Finance · Tools (Sortanize).
 * Settings in footer; company switcher in sidebar. Nav filtered by membership.tabs.
 * API calls remain `/api/b/:slug`. Location: apps/web/src/components/BusinessShell.tsx
 */
import { useEffect, useMemo, useState } from 'react'
import { Outlet, useParams } from 'react-router-dom'
import {
  ArrowsDownUp,
  GearSix,
  Megaphone,
  Cube,
  UsersThree,
  Folders,
  CurrencyEur,
  Tray,
} from '@phosphor-icons/react'
import { canSeeNavTab } from '@bu2/shared'
import { api } from '../lib/api'
import { companyRoutes } from '../lib/companyPaths'
import { writeLastCompany } from '../lib/lastCompany'
import { useI18n } from '../lib/i18n'
import type { AuthUser } from '../app/App'
import { AppShell } from './AppShell'
import type { RailGroup, RailItem } from './IconRail'

export type MembershipPayload = {
  role: 'owner' | 'admin' | 'editor' | 'viewer'
  grantSeoOpen: boolean
  tabs: string[] | null
}

/** Outlet context for company pages (MarketingShell reads membership). */
export type CompanyOutletContext = {
  slug: string
  user: AuthUser
  membership: MembershipPayload | null
}

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
  const [membership, setMembership] = useState<MembershipPayload | null>(null)

  useEffect(() => {
    if (!slug) return
    api<{
      business: { name: string; status: string; logoPath?: string | null }
      membership: MembershipPayload | null
    }>(`/api/b/${slug}`)
      .then((r) => {
        setBiz(r.business)
        setMembership(r.membership)
        if (r.business.status !== 'archived') writeLastCompany(slug)
      })
      .catch(() => {
        setBiz(null)
        setMembership(null)
      })
  }, [slug])

  const routes = useMemo(() => (slug ? companyRoutes(slug) : null), [slug])

  /** null tabs = unrestricted (owner/admin); missing membership (e.g. superadmin) → all. */
  const tabs = membership ? membership.tabs : null

  const topItems: RailItem[] = useMemo(() => {
    if (!routes) return []
    const items: RailItem[] = []
    // Order: Inbox → Marketing → Product → Customer → Projects → Finance
    if (canSeeNavTab(tabs, 'inbox') || canSeeNavTab(tabs, 'projects')) {
      items.push({
        key: 'inbox',
        to: routes.inbox,
        label: t('inbox'),
        icon: Tray,
        dataIc: 'inbox',
      })
    }
    if (canSeeNavTab(tabs, 'overview') || canSeeNavTab(tabs, 'home') || canSeeNavTab(tabs, 'instagram')) {
      items.push({
        key: 'marketing',
        to: routes.marketing,
        label: t('marketing'),
        icon: Megaphone,
        dataIc: 'marketing',
      })
    }
    if (canSeeNavTab(tabs, 'product') || canSeeNavTab(tabs, 'catalog') || canSeeNavTab(tabs, 'cmb')) {
      items.push({
        key: 'product',
        to: routes.product,
        label: t('product'),
        icon: Cube,
        dataIc: 'product',
      })
    }
    if (canSeeNavTab(tabs, 'customer')) {
      items.push({
        key: 'customer',
        to: routes.customer,
        label: t('customer'),
        icon: UsersThree,
        dataIc: 'customer',
      })
    }
    if (canSeeNavTab(tabs, 'projects')) {
      items.push({
        key: 'projects',
        to: routes.projects,
        label: t('projects'),
        icon: Folders,
        dataIc: 'projects',
      })
    }
    if (canSeeNavTab(tabs, 'finance')) {
      items.push({
        key: 'finance',
        to: routes.finance,
        label: t('finance'),
        icon: CurrencyEur,
        dataIc: 'finance',
      })
    }
    return items
  }, [routes, t, tabs])

  const groups: RailGroup[] = useMemo(() => {
    if (!routes) return []
    const out: RailGroup[] = []

    const toolItems: RailItem[] = []
    if (canSeeNavTab(tabs, 'sortanize')) {
      toolItems.push({
        key: 'sortanize',
        to: routes.sortanize,
        label: t('sortanize'),
        icon: ArrowsDownUp,
        dataIc: 'sortanize',
      })
    }
    if (toolItems.length) {
      out.push({ id: 'tools', label: t('navTools'), items: toolItems })
    }

    return out
  }, [routes, t, tabs])

  const settingsItem: RailItem | null =
    routes && canSeeNavTab(tabs, 'settings') && (membership?.role === 'owner' || membership?.role === 'admin' || user.isSuperadmin)
      ? { key: 'settings', to: routes.settings, label: t('settings'), icon: GearSix, dataIc: 'settings' }
      : null

  const canCreateCompany =
    user.isSuperadmin || membership?.role === 'owner' || membership?.role === 'admin'

  return (
    <AppShell
      user={user}
      railItems={topItems}
      railGroups={groups}
      settingsItem={settingsItem}
      company={{
        slug: slug!,
        name: biz?.name ?? slug ?? '',
        logoPath: biz?.logoPath,
        status: biz?.status,
      }}
      canCreateCompany={canCreateCompany}
      onLogout={onLogout}
    >
      <Outlet
        context={
          {
            slug: slug!,
            user,
            membership,
          } satisfies CompanyOutletContext
        }
      />
    </AppShell>
  )
}
