/**
 * MarketingShell — tabbed Marketing IA under `/co/:slug/marketing`.
 * Top: Funnel | Persona Journey · Funnel: Organic | Paid | Custom · channel tertiary tabs.
 * Deep links sync via nested routes (`Outlet`). Location: apps/web/src/features/marketing/MarketingShell.tsx
 */
import { useMemo } from 'react'
import { Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { canOpenSeo, canSeeNavTab } from '@bu2/shared'
import type { CompanyOutletContext } from '../../components/BusinessShell'
import {
  CUSTOM_CHANNELS,
  ORGANIC_TABS,
  PAID_CHANNELS,
  marketingPath,
  parseMarketingLocation,
  type FunnelKind,
  type MarketingTopTab,
} from '../../lib/companyPaths'
import { useI18n } from '../../lib/i18n'

const PAID_LABEL: Record<
  (typeof PAID_CHANNELS)[number],
  'metaAds' | 'googleAds' | 'tiktokAds' | 'linkedinAds' | 'chatgptAds' | 'microsoftAds'
> = {
  meta: 'metaAds',
  google: 'googleAds',
  tiktok: 'tiktokAds',
  linkedin: 'linkedinAds',
  chatgpt: 'chatgptAds',
  microsoft: 'microsoftAds',
}

const PAID_TAB_KEY: Record<(typeof PAID_CHANNELS)[number], string> = {
  meta: 'meta_ads',
  google: 'google_ads',
  tiktok: 'tiktok_ads',
  linkedin: 'linkedin_ads',
  chatgpt: 'chatgpt_ads',
  microsoft: 'microsoft_ads',
}

const CUSTOM_LABEL: Record<(typeof CUSTOM_CHANNELS)[number], 'emailMarketing' | 'offlineFlyer'> = {
  email: 'emailMarketing',
  offline: 'offlineFlyer',
}

export function MarketingShell() {
  const { slug } = useParams()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { t } = useI18n()
  const ctx = useOutletContext<CompanyOutletContext | undefined>()

  const parsed = useMemo(() => parseMarketingLocation(pathname), [pathname])

  const tabs = ctx?.membership ? ctx.membership.tabs : null
  const role = ctx?.membership?.role ?? (ctx?.user.isSuperadmin ? 'owner' : 'viewer')
  const grantSeo = ctx?.membership?.grantSeoOpen ?? false
  const showSeo =
    canOpenSeo(role, grantSeo) && (canSeeNavTab(tabs, 'seo') || canSeeNavTab(tabs, 'geo') || tabs == null)

  const organicTabs = ORGANIC_TABS.filter((ch) => {
    if (ch === 'website') return showSeo
    return canSeeNavTab(tabs, ch)
  })

  const paidTabs = PAID_CHANNELS.filter((ch) => canSeeNavTab(tabs, PAID_TAB_KEY[ch]))

  const customTabs = CUSTOM_CHANNELS.filter((ch) =>
    canSeeNavTab(tabs, ch === 'email' ? 'email' : 'offline'),
  )

  function go(sel: { top: MarketingTopTab; funnel?: FunnelKind; channel?: string }) {
    if (!slug) return
    navigate(marketingPath(slug, sel))
  }

  if (!slug) return null

  return (
    <div className="stack mkt-shell">
      <div className="mkt-tabs mkt-tabs-l1" role="tablist" aria-label={t('marketing')}>
        <TabBtn
          active={parsed.top === 'funnel'}
          onClick={() =>
            go({
              top: 'funnel',
              funnel: parsed.funnel,
              channel: defaultChannel(parsed.funnel, organicTabs, paidTabs, customTabs),
            })
          }
          label={t('navFunnel')}
        />
        {canSeeNavTab(tabs, 'personas') ? (
          <TabBtn
            active={parsed.top === 'personas'}
            onClick={() => go({ top: 'personas' })}
            label={t('personaJourney')}
          />
        ) : null}
      </div>

      {parsed.top === 'funnel' ? (
        <>
          <div className="mkt-tabs mkt-tabs-l2" role="tablist" aria-label={t('navFunnel')}>
            {organicTabs.length ? (
              <TabBtn
                active={parsed.funnel === 'organic'}
                onClick={() =>
                  go({ top: 'funnel', funnel: 'organic', channel: organicTabs[0] ?? 'instagram' })
                }
                label={t('navOrganic')}
              />
            ) : null}
            {paidTabs.length ? (
              <TabBtn
                active={parsed.funnel === 'paid'}
                onClick={() => go({ top: 'funnel', funnel: 'paid', channel: paidTabs[0] ?? 'meta' })}
                label={t('navPaid')}
              />
            ) : null}
            {customTabs.length ? (
              <TabBtn
                active={parsed.funnel === 'custom'}
                onClick={() =>
                  go({ top: 'funnel', funnel: 'custom', channel: customTabs[0] ?? 'email' })
                }
                label={t('navCustom')}
              />
            ) : null}
          </div>

          <div className="mkt-tabs mkt-tabs-l3" role="tablist" aria-label={t('hubColChannel')}>
            {parsed.funnel === 'organic'
              ? organicTabs.map((ch) => (
                  <TabBtn
                    key={ch}
                    active={parsed.channel === ch}
                    onClick={() => go({ top: 'funnel', funnel: 'organic', channel: ch })}
                    label={ch === 'website' ? t('navWebsite') : t(`ch_${ch}` as 'ch_instagram')}
                  />
                ))
              : null}
            {parsed.funnel === 'paid'
              ? paidTabs.map((ch) => (
                  <TabBtn
                    key={ch}
                    active={parsed.channel === ch}
                    onClick={() => go({ top: 'funnel', funnel: 'paid', channel: ch })}
                    label={t(PAID_LABEL[ch])}
                  />
                ))
              : null}
            {parsed.funnel === 'custom'
              ? customTabs.map((ch) => (
                  <TabBtn
                    key={ch}
                    active={parsed.channel === ch}
                    onClick={() => go({ top: 'funnel', funnel: 'custom', channel: ch })}
                    label={t(CUSTOM_LABEL[ch])}
                  />
                ))
              : null}
          </div>
        </>
      ) : null}

      <div className="mkt-pane" role="tabpanel">
        <Outlet context={ctx} />
      </div>
    </div>
  )
}

function defaultChannel(
  funnel: FunnelKind,
  organic: readonly string[],
  paid: readonly string[],
  custom: readonly string[],
): string {
  if (funnel === 'paid') return paid[0] ?? 'meta'
  if (funnel === 'custom') return custom[0] ?? 'email'
  return organic[0] ?? 'instagram'
}

function TabBtn({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="tab"
      className={`mkt-tab ${active ? 'active' : ''}`}
      aria-selected={active}
      onClick={onClick}
    >
      {label}
    </button>
  )
}
