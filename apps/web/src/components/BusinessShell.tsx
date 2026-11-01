/**
 * BusinessShell — `/co/:slug` layout with collapsible module sidebar (legacy URL + IA parity).
 * Grouped Organic / Paid / Custom / Tools / Website nav; settings in footer; company switcher in header.
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

  const routes = useMemo(() => (slug ? companyRoutes(slug) : null), [slug])

  const topItems: RailItem[] = useMemo(() => {
    if (!routes) return []
    return [
      { key: 'home', to: '/', end: true, label: t('businesses'), icon: Buildings, dataIc: 'home' },
      { key: 'catalog', to: routes.catalog, label: t('catalog'), icon: Package, dataIc: 'catalog' },
    ]
  }, [routes, t])

  const groups: RailGroup[] = useMemo(() => {
    if (!routes) return []
    return [
      {
        id: 'overview',
        label: t('navOverview'),
        items: [
          {
            key: 'overview',
            to: routes.overview,
            end: true,
            label: t('overview'),
            icon: SquaresFour,
            dataIc: 'overview',
          },
        ],
      },
      {
        id: 'organic',
        label: t('navOrganic'),
        items: ORGANIC_CHANNELS.map((ch) => ({
          key: `organic-${ch}`,
          to: routes.organic(ch),
          label: t(`ch_${ch}` as 'ch_instagram'),
          icon: ORGANIC_ICONS[ch],
          dataIc: ch,
        })),
      },
      {
        id: 'paid',
        label: t('navPaid'),
        items: PAID_CHANNELS.map((ch) => ({
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
        })),
      },
      {
        id: 'custom',
        label: t('navCustom'),
        items: CUSTOM_CHANNELS.map((ch) => ({
          key: `custom-${ch}`,
          to: routes.customCh(ch),
          label: t(CUSTOM_META[ch].labelKey),
          icon: CUSTOM_META[ch].icon,
          dataIc: CUSTOM_META[ch].dataIc,
        })),
      },
      {
        id: 'tools',
        label: t('navTools'),
        items: [
          { key: 'cmb', to: routes.cmb, label: t('cmb'), icon: Calculator, dataIc: 'cmb' },
          { key: 'sortanize', to: routes.sortanize, label: t('sortanize'), icon: ArrowsDownUp, dataIc: 'sortanize' },
          {
            key: 'personas',
            to: routes.personas,
            label: t('personaJourney'),
            icon: UsersThree,
            dataIc: 'personas',
          },
          { key: 'checkmap', to: routes.checkmap, label: t('checkmap'), icon: MapTrifold, dataIc: 'checkmap' },
        ],
      },
      {
        id: 'website',
        label: t('navWebsite'),
        items: [
          { key: 'seo', to: routes.openseo, label: t('seo'), icon: MagnifyingGlass, dataIc: 'seo' },
        ],
      },
    ]
  }, [routes, t])

  const settingsItem: RailItem | null = routes
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
