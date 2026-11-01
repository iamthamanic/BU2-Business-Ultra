/**
 * BusinessShell — `/co/:slug` layout with collapsible module sidebar (legacy URL + IA parity).
 * Grouped Organic / Paid / Custom / Tools / Website nav; settings in footer; company name in topbar (switcher on Settings).
 * Nav filtered by membership.tabs (legacy ME.tabs); owner/admin see all (tabs null).
 * API calls remain `/api/b/:slug`. Location: apps/web/src/components/BusinessShell.tsx
 */
import { useEffect, useMemo, useState } from 'react'
import { Outlet, useParams } from 'react-router-dom'
import {
  SquaresFour,
  Package,
  InstagramLogo,
  FacebookLogo,
  TiktokLogo,
  LinkedinLogo,
  YoutubeLogo,
  GoogleLogo,
  MetaLogo,
  EnvelopeSimple,
  Newspaper,
  Calculator,
  MapTrifold,
  UsersThree,
  ArrowsDownUp,
  MagnifyingGlass,
  GearSix,
  Buildings,
  Sparkle,
} from '@phosphor-icons/react'
import { canOpenSeo, canSeeNavTab } from '@bu2/shared'
import { api } from '../lib/api'
import {
  companyRoutes,
  ORGANIC_CHANNELS,
  PAID_CHANNELS,
  CUSTOM_CHANNELS,
} from '../lib/companyPaths'
import { useI18n } from '../lib/i18n'
import type { AuthUser } from '../app/App'
import { AppShell } from './AppShell'
import type { RailGroup, RailItem } from './IconRail'

const ORGANIC_ICONS = {
  instagram: InstagramLogo,
  facebook: FacebookLogo,
  tiktok: TiktokLogo,
  linkedin: LinkedinLogo,
  youtube: YoutubeLogo,
} as const

const PAID_META: Record<(typeof PAID_CHANNELS)[number], { labelKey: 'googleAds' | 'metaAds' | 'tiktokAds' | 'chatgptAds'; dataIc: string }> = {
  google: { labelKey: 'googleAds', dataIc: 'google_ads' },
  meta: { labelKey: 'metaAds', dataIc: 'meta_ads' },
  tiktok: { labelKey: 'tiktokAds', dataIc: 'tiktok' },
  chatgpt: { labelKey: 'chatgptAds', dataIc: 'chatgpt_ads' },
}

const CUSTOM_META: Record<(typeof CUSTOM_CHANNELS)[number], { labelKey: 'emailMarketing' | 'offlineFlyer'; icon: typeof EnvelopeSimple; dataIc: string }> = {
  email: { labelKey: 'emailMarketing', icon: EnvelopeSimple, dataIc: 'email' },
  offline: { labelKey: 'offlineFlyer', icon: Newspaper, dataIc: 'offline' },
}

type MembershipPayload = {
  role: 'owner' | 'admin' | 'editor' | 'viewer'
  grantSeoOpen: boolean
  tabs: string[] | null
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
    if (canSeeNavTab(tabs, 'home')) {
      items.push({ key: 'home', to: '/', end: true, label: t('businesses'), icon: Buildings, dataIc: 'home' })
    }
    if (canSeeNavTab(tabs, 'catalog')) {
      items.push({ key: 'catalog', to: routes.catalog, label: t('catalog'), icon: Package, dataIc: 'catalog' })
    }
    return items
  }, [routes, t, tabs])

  const groups: RailGroup[] = useMemo(() => {
    if (!routes) return []
    const out: RailGroup[] = []

    const overviewItems: RailItem[] = []
    if (canSeeNavTab(tabs, 'overview')) {
      overviewItems.push({
        key: 'overview',
        to: routes.overview,
        end: true,
        label: t('overview'),
        icon: SquaresFour,
        dataIc: 'overview',
      })
    }
    if (overviewItems.length) {
      out.push({ id: 'overview', label: t('navOverview'), items: overviewItems })
    }

    const organicItems = ORGANIC_CHANNELS.filter((ch) => canSeeNavTab(tabs, ch)).map((ch) => ({
      key: `organic-${ch}`,
      to: routes.organic(ch),
      label: t(`ch_${ch}` as 'ch_instagram'),
      icon: ORGANIC_ICONS[ch],
      dataIc: ch,
    }))
    if (organicItems.length) {
      out.push({ id: 'organic', label: t('navOrganic'), items: organicItems })
    }

    const paidItems = PAID_CHANNELS.filter((ch) => canSeeNavTab(tabs, PAID_META[ch].dataIc)).map((ch) => ({
      key: `paid-${ch}`,
      to: routes.paid(ch),
      label: t(PAID_META[ch].labelKey),
      icon:
        ch === 'google'
          ? GoogleLogo
          : ch === 'meta'
            ? MetaLogo
            : ch === 'tiktok'
              ? TiktokLogo
              : Sparkle,
      dataIc: PAID_META[ch].dataIc,
    }))
    if (paidItems.length) {
      out.push({ id: 'paid', label: t('navPaid'), items: paidItems })
    }

    const customItems = CUSTOM_CHANNELS.filter((ch) => canSeeNavTab(tabs, CUSTOM_META[ch].dataIc)).map(
      (ch) => ({
        key: `custom-${ch}`,
        to: routes.customCh(ch),
        label: t(CUSTOM_META[ch].labelKey),
        icon: CUSTOM_META[ch].icon,
        dataIc: CUSTOM_META[ch].dataIc,
      }),
    )
    if (customItems.length) {
      out.push({ id: 'custom', label: t('navCustom'), items: customItems })
    }

    const toolItems: RailItem[] = []
    if (canSeeNavTab(tabs, 'cmb')) {
      toolItems.push({ key: 'cmb', to: routes.cmb, label: t('cmb'), icon: Calculator, dataIc: 'cmb' })
    }
    if (canSeeNavTab(tabs, 'sortanize')) {
      toolItems.push({
        key: 'sortanize',
        to: routes.sortanize,
        label: t('sortanize'),
        icon: ArrowsDownUp,
        dataIc: 'sortanize',
      })
    }
    if (canSeeNavTab(tabs, 'personas')) {
      toolItems.push({
        key: 'personas',
        to: routes.personas,
        label: t('personaJourney'),
        icon: UsersThree,
        dataIc: 'personas',
      })
    }
    if (canSeeNavTab(tabs, 'checkmap')) {
      toolItems.push({
        key: 'checkmap',
        to: routes.checkmap,
        label: t('checkmap'),
        icon: MapTrifold,
        dataIc: 'checkmap',
      })
    }
    if (toolItems.length) {
      out.push({ id: 'tools', label: t('navTools'), items: toolItems })
    }

    const role = membership?.role ?? (user.isSuperadmin ? 'owner' : 'viewer')
    const grantSeo = membership?.grantSeoOpen ?? false
    const websiteItems: RailItem[] = []
    if (canSeeNavTab(tabs, 'seo') && canOpenSeo(role, grantSeo)) {
      websiteItems.push({
        key: 'seo',
        to: routes.openseo,
        label: t('seo'),
        icon: MagnifyingGlass,
        dataIc: 'seo',
      })
    }
    if (websiteItems.length) {
      out.push({ id: 'website', label: t('navWebsite'), items: websiteItems })
    }

    return out
  }, [routes, t, tabs, membership, user.isSuperadmin])

  const settingsItem: RailItem | null =
    routes && canSeeNavTab(tabs, 'settings') && (membership?.role === 'owner' || membership?.role === 'admin' || user.isSuperadmin)
      ? { key: 'settings', to: routes.settings, label: t('settings'), icon: GearSix, dataIc: 'settings' }
      : null

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
      onLogout={onLogout}
    >
      <Outlet context={{ slug: slug!, user }} />
    </AppShell>
  )
}
