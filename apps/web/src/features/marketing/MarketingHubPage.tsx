/**
 * MarketingHubPage — company default landing: connection status + Organic/Paid/Custom matrices.
 * Dense Dark-Ops ops surface; clickable rows → channel routes; empty → Settings Verbindungen.
 * Location: apps/web/src/features/marketing/MarketingHubPage.tsx
 */
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import {
  companyRoutes,
  ORGANIC_CHANNELS,
  PAID_CHANNELS,
  CUSTOM_CHANNELS,
} from '../../lib/companyPaths'
import { useI18n } from '../../lib/i18n'

type GateMap = Record<string, boolean>

type HubRow = {
  key: string
  label: string
  to: string
  metric: string
  ready: boolean
  hint: string
}

/** Deterministic stub 7d counts until Metricool/Ads aggregates land. */
function stubCount(seed: string, max: number): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return h % (max + 1)
}

export function MarketingHubPage() {
  const { slug } = useParams()
  const { t } = useI18n()
  const [bizName, setBizName] = useState('')
  const [gates, setGates] = useState<GateMap>({})
  const [seoReady, setSeoReady] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    Promise.all([
      api<{ business: { name: string } }>(`/api/b/${slug}`),
      api<{ gates: GateMap }>(`/api/b/${slug}/settings/feature-gates`),
      api<{ instance?: { status?: string } }>(`/api/b/${slug}/openseo`).catch(() => ({
        instance: { status: 'not_provisioned' },
      })),
    ])
      .then(([biz, gateRes, seo]) => {
        if (cancelled) return
        setBizName(biz.business.name)
        setGates(gateRes.gates || {})
        const st = seo.instance?.status
        setSeoReady(!!st && st !== 'not_provisioned')
        setLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  if (!slug) return null
  const routes = companyRoutes(slug)
  const metricoolOk = !!gates.metricool
  const brevoOk = !!gates.brevo

  const organicRows: HubRow[] = ORGANIC_CHANNELS.map((ch) => ({
    key: ch,
    label: t(`ch_${ch}` as 'ch_instagram'),
    to: routes.organic(ch),
    metric: metricoolOk ? `${stubCount(`${slug}-${ch}`, 14)} ${t('hubPostsShort')}` : '—',
    ready: metricoolOk,
    hint: metricoolOk ? t('statusReady') : t('statusNeedBrand'),
  }))

  const paidRows: HubRow[] = PAID_CHANNELS.map((ch) => {
    const gateKey =
      ch === 'google'
        ? 'google_ads'
        : ch === 'meta'
          ? 'meta_ads'
          : ch === 'tiktok'
            ? 'tiktok_ads'
            : 'chatgpt_ads'
    const ready = ch === 'chatgpt' ? !!gates.chatgpt_ads : metricoolOk || !!gates[gateKey]
    return {
      key: ch,
      label: t(
        ch === 'google'
          ? 'googleAds'
          : ch === 'meta'
            ? 'metaAds'
            : ch === 'tiktok'
              ? 'tiktokAds'
              : 'chatgptAds',
      ),
      to: routes.paid(ch),
      metric: ready ? `${stubCount(`${slug}-paid-${ch}`, 6)} ${t('hubCampaignsShort')}` : '—',
      ready,
      hint: ready ? t('statusReady') : t('statusNeedKey'),
    }
  })

  const customRows: HubRow[] = CUSTOM_CHANNELS.map((ch) => {
    const ready = ch === 'email' ? brevoOk : true
    return {
      key: ch,
      label: t(ch === 'email' ? 'emailMarketing' : 'offlineFlyer'),
      to: routes.customCh(ch),
      metric: ch === 'email' ? (brevoOk ? `${stubCount(`${slug}-email`, 4)} ${t('hubCampaignsShort')}` : '—') : '—',
      ready,
      hint: ready ? t('statusReady') : t('statusNeedKey'),
    }
  })

  return (
    <div className="stack hub-page">
      <header className="hub-head">
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            {t('marketing')} · {t('marketingHub')}
          </h1>
          <p className="muted page-lede" style={{ margin: '4px 0 0' }}>
            {bizName || slug} · {t('funnelOverview')}
          </p>
        </div>
      </header>

      <section className="hub-status-strip" aria-label={t('connectionStatus')}>
        <StatusChip
          label="Metricool"
          ok={metricoolOk}
          readyLabel={t('statusConnected')}
          missingLabel={t('statusNotConnected')}
        />
        <StatusChip
          label="Brevo"
          ok={brevoOk}
          readyLabel={t('statusConnected')}
          missingLabel={t('statusNotConnected')}
        />
        <StatusChip
          label={t('seo')}
          ok={seoReady}
          readyLabel={t('statusConnected')}
          missingLabel={t('statusNotConnected')}
        />
        <Link className="btn" to={routes.settingsConnections}>
          {t('openConnections')}
        </Link>
      </section>

      {!loaded && <p className="muted">{t('loading')}</p>}

      <div className="hub-matrices">
        <ChannelMatrix title={t('navOrganic')} rows={organicRows} connectTo={routes.settingsConnections} />
        <ChannelMatrix title={t('navPaid')} rows={paidRows} connectTo={routes.settingsConnections} />
      </div>

      <section className="panel hub-section">
        <div className="hub-section-head">
          <h2 className="hub-section-title">{t('navCustom')}</h2>
        </div>
        <ul className="hub-row-list">
          {customRows.map((row) => (
            <li key={row.key}>
              <Link className="hub-row" to={row.to}>
                <span className="hub-row-label">{row.label}</span>
                <span className="hub-row-metric kpi">{row.metric}</span>
                <span className={`badge ${row.ready ? 'ok' : 'warn'}`}>{row.hint}</span>
              </Link>
            </li>
          ))}
        </ul>
        {!brevoOk && (
          <p className="muted hub-empty-cta">
            {t('hubConnectHint')}{' '}
            <Link to={routes.settingsConnections}>{t('openConnections')}</Link>
          </p>
        )}
      </section>

      <section className="panel hub-section">
        <div className="hub-section-head">
          <h2 className="hub-section-title">
            {t('seo')} / {t('geo')}
          </h2>
        </div>
        <ul className="hub-row-list">
          <li>
            <Link className="hub-row" to={routes.openseo}>
              <span className="hub-row-label">{t('seo')}</span>
              <span className="hub-row-metric kpi">{seoReady ? t('statusReady') : '—'}</span>
              <span className={`badge ${seoReady ? 'ok' : 'warn'}`}>
                {seoReady ? t('statusConnected') : t('statusNotConnected')}
              </span>
            </Link>
          </li>
          <li>
            <Link className="hub-row" to={routes.geo}>
              <span className="hub-row-label">{t('geo')}</span>
              <span className="hub-row-metric kpi">{seoReady ? t('statusReady') : '—'}</span>
              <span className={`badge ${seoReady ? 'ok' : 'warn'}`}>
                {seoReady ? t('statusConnected') : t('statusNotConnected')}
              </span>
            </Link>
          </li>
        </ul>
      </section>

      <section className="panel hub-section hub-persona">
        <Link className="hub-row" to={routes.personas}>
          <span className="hub-row-label">{t('personaJourney')}</span>
          <span className="hub-row-metric muted">{t('open')}</span>
        </Link>
      </section>
    </div>
  )
}

function StatusChip({
  label,
  ok,
  readyLabel,
  missingLabel,
}: {
  label: string
  ok: boolean
  readyLabel: string
  missingLabel: string
}) {
  return (
    <div className={`hub-chip ${ok ? 'ok' : 'warn'}`} role="listitem">
      <span className="hub-chip-dot" aria-hidden />
      <span className="hub-chip-label">{label}</span>
      <span className="hub-chip-state">{ok ? readyLabel : missingLabel}</span>
    </div>
  )
}

function ChannelMatrix({
  title,
  rows,
  connectTo,
}: {
  title: string
  rows: HubRow[]
  connectTo: string
}) {
  const { t } = useI18n()
  const anyReady = rows.some((r) => r.ready)
  return (
    <section className="panel hub-section">
      <div className="hub-section-head">
        <h2 className="hub-section-title">{title}</h2>
        <span className="muted hub-col-hint">7d</span>
      </div>
      <table className="hub-table">
        <thead>
          <tr>
            <th>{t('hubColChannel')}</th>
            <th>{t('hubColMetric')}</th>
            <th>{t('hubColStatus')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="hub-table-row">
              <td>
                <Link to={row.to}>{row.label}</Link>
              </td>
              <td className="kpi">{row.metric}</td>
              <td>
                <span className={`badge ${row.ready ? 'ok' : 'warn'}`}>{row.hint}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!anyReady && (
        <p className="muted hub-empty-cta">
          {t('hubConnectHint')} <Link to={connectTo}>{t('openConnections')}</Link>
        </p>
      )}
    </section>
  )
}
