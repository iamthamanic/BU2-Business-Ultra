/**
 * MarketingShell — tabbed Marketing IA under `/co/:slug/marketing`.
 * Top: Funnel | Persona Journey · Funnel: Organic | Paid | Custom ·
 * Organic/Paid: Analyse | Planung · channels only under Analyse.
 * Deep links sync via nested routes (`Outlet`). Location: apps/web/src/features/marketing/MarketingShell.tsx
 */
import { useMemo, useRef } from 'react'
import { Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { CalendarBlank, ChartBar } from '@phosphor-icons/react'
import { canOpenSeo, canSeeNavTab } from '@bu2/shared'
import type { CompanyOutletContext } from '../../components/BusinessShell'
import { MktTab, MktTabs } from '../../components/MktTabs'
import {
  MKT_CUSTOM_ICONS,
  MKT_L1_ICONS,
  MKT_L2_ICONS,
  MKT_ORGANIC_ICONS,
  MKT_PAID_ICONS,
} from '../../components/mktTabIcons'
import {
  CUSTOM_CHANNELS,
  ORGANIC_TABS,
  PAID_CHANNELS,
  marketingPath,
  parseMarketingLocation,
  type FunnelKind,
  type FunnelSurface,
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

  /** Remember last Analyse channel per funnel so Planung → Analyse restores it. */
  const lastChannelRef = useRef<{ organic: string; paid: string }>({
    organic: 'instagram',
    paid: 'meta',
  })
  if (parsed.surface === 'analyse' && parsed.funnel === 'organic') {
    lastChannelRef.current.organic = parsed.channel
  }
  if (parsed.surface === 'analyse' && parsed.funnel === 'paid') {
    lastChannelRef.current.paid = parsed.channel
  }

  const tabs = ctx?.membership ? ctx.membership.tabs : null
  const membershipAuthz = ctx?.membership
    ? { isOwner: ctx.membership.isOwner, permissions: ctx.membership.permissions ?? [] }
    : { isOwner: false, permissions: [] as string[] }
  const showSeo =
    canOpenSeo(membershipAuthz) &&
    (canSeeNavTab(tabs, 'seo') || canSeeNavTab(tabs, 'geo') || tabs == null)

  const organicTabs = ORGANIC_TABS.filter((ch) => {
    if (ch === 'website') return showSeo
    return canSeeNavTab(tabs, ch)
  })

  const paidTabs = PAID_CHANNELS.filter((ch) => canSeeNavTab(tabs, PAID_TAB_KEY[ch]))

  const customTabs = CUSTOM_CHANNELS.filter((ch) =>
    canSeeNavTab(tabs, ch === 'email' ? 'email' : 'offline'),
  )

  function go(sel: {
    top: MarketingTopTab
    funnel?: FunnelKind
    channel?: string
    surface?: FunnelSurface
  }) {
    if (!slug) return
    navigate(marketingPath(slug, sel))
  }

  function analyseChannel(funnel: 'organic' | 'paid'): string {
    if (funnel === 'paid') {
      const pref = lastChannelRef.current.paid
      return paidTabs.includes(pref as (typeof PAID_CHANNELS)[number])
        ? pref
        : (paidTabs[0] ?? 'meta')
    }
    const pref = lastChannelRef.current.organic
    return organicTabs.includes(pref as (typeof ORGANIC_TABS)[number])
      ? pref
      : (organicTabs[0] ?? 'instagram')
  }

  if (!slug) return null

  const showSurfaceTabs = parsed.funnel === 'organic' || parsed.funnel === 'paid'
  const showChannels =
    parsed.funnel === 'custom' ||
    (showSurfaceTabs && parsed.surface === 'analyse')

  return (
    <div className="stack mkt-shell">
      <div className="mkt-chrome">
        <MktTabs level="l1" label={t('marketing')}>
          <MktTab
            active={parsed.top === 'funnel'}
            onClick={() =>
              go({
                top: 'funnel',
                funnel: parsed.funnel,
                channel: defaultChannel(parsed.funnel, organicTabs, paidTabs, customTabs),
                surface: 'analyse',
              })
            }
            label={t('navFunnel')}
            icon={MKT_L1_ICONS.funnel}
            dataIc="funnel"
          />
          {canSeeNavTab(tabs, 'personas') ? (
            <MktTab
              active={parsed.top === 'personas'}
              onClick={() => go({ top: 'personas' })}
              label={t('personaJourney')}
              icon={MKT_L1_ICONS.personas}
              dataIc="personas"
            />
          ) : null}
          <MktTab
            active={parsed.top === 'styleguide'}
            onClick={() => go({ top: 'styleguide' })}
            label={t('styleguide')}
            icon={MKT_L1_ICONS.styleguide}
            dataIc="styleguide"
          />
        </MktTabs>

        {parsed.top === 'funnel' ? (
          <>
            <MktTabs level="l2" label={t('navFunnel')}>
              {organicTabs.length ? (
                <MktTab
                  active={parsed.funnel === 'organic'}
                  onClick={() =>
                    go({
                      top: 'funnel',
                      funnel: 'organic',
                      channel: analyseChannel('organic'),
                      surface: 'analyse',
                    })
                  }
                  label={t('navOrganic')}
                  icon={MKT_L2_ICONS.organic}
                  dataIc="organic"
                />
              ) : null}
              {paidTabs.length ? (
                <MktTab
                  active={parsed.funnel === 'paid'}
                  onClick={() =>
                    go({
                      top: 'funnel',
                      funnel: 'paid',
                      channel: analyseChannel('paid'),
                      surface: 'analyse',
                    })
                  }
                  label={t('navPaid')}
                  icon={MKT_L2_ICONS.paid}
                  dataIc="paid"
                />
              ) : null}
              {customTabs.length ? (
                <MktTab
                  active={parsed.funnel === 'custom'}
                  onClick={() =>
                    go({
                      top: 'funnel',
                      funnel: 'custom',
                      channel: customTabs[0] ?? 'email',
                      surface: 'analyse',
                    })
                  }
                  label={t('navCustom')}
                  icon={MKT_L2_ICONS.custom}
                  dataIc="custom"
                />
              ) : null}
            </MktTabs>

            {showSurfaceTabs ? (
              <MktTabs level="l3" label={t('tabAnalyse')}>
                <MktTab
                  active={parsed.surface === 'analyse'}
                  onClick={() =>
                    go({
                      top: 'funnel',
                      funnel: parsed.funnel,
                      channel: analyseChannel(parsed.funnel === 'paid' ? 'paid' : 'organic'),
                      surface: 'analyse',
                    })
                  }
                  label={t('tabAnalyse')}
                  icon={ChartBar}
                  dataIc="analyse"
                />
                <MktTab
                  active={parsed.surface === 'planung'}
                  onClick={() =>
                    go({
                      top: 'funnel',
                      funnel: parsed.funnel,
                      surface: 'planung',
                    })
                  }
                  label={t('tabPlanung')}
                  icon={CalendarBlank}
                  dataIc="planung"
                />
              </MktTabs>
            ) : null}

            {showChannels ? (
              <MktTabs
                level={showSurfaceTabs ? 'surface' : 'l3'}
                label={t('hubColChannel')}
              >
                {parsed.funnel === 'organic'
                  ? organicTabs.map((ch) => (
                      <MktTab
                        key={ch}
                        active={parsed.channel === ch}
                        onClick={() =>
                          go({ top: 'funnel', funnel: 'organic', channel: ch, surface: 'analyse' })
                        }
                        label={ch === 'website' ? t('navWebsite') : t(`ch_${ch}` as 'ch_instagram')}
                        icon={MKT_ORGANIC_ICONS[ch]}
                        dataIc={ch === 'website' ? 'website' : ch}
                      />
                    ))
                  : null}
                {parsed.funnel === 'paid'
                  ? paidTabs.map((ch) => (
                      <MktTab
                        key={ch}
                        active={parsed.channel === ch}
                        onClick={() =>
                          go({ top: 'funnel', funnel: 'paid', channel: ch, surface: 'analyse' })
                        }
                        label={t(PAID_LABEL[ch])}
                        icon={MKT_PAID_ICONS[ch]}
                        dataIc={PAID_TAB_KEY[ch]}
                      />
                    ))
                  : null}
                {parsed.funnel === 'custom'
                  ? customTabs.map((ch) => (
                      <MktTab
                        key={ch}
                        active={parsed.channel === ch}
                        onClick={() =>
                          go({ top: 'funnel', funnel: 'custom', channel: ch, surface: 'analyse' })
                        }
                        label={t(CUSTOM_LABEL[ch])}
                        icon={MKT_CUSTOM_ICONS[ch]}
                        dataIc={ch}
                      />
                    ))
                  : null}
              </MktTabs>
            ) : null}
          </>
        ) : null}
      </div>

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
