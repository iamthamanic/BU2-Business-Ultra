/**
 * SettingsConnectionsTab — Verbindungen as 6 surface tabs (Social, Ads, Email, Finance, Aggregators, Tools).
 * Location: apps/web/src/features/settings/SettingsConnectionsTab.tsx
 */
import { useEffect, useState } from 'react'
import {
  Bank,
  CirclesThreePlus,
  EnvelopeSimple,
  Megaphone,
  ShareNetwork,
  Wrench,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { MktTab, MktTabs } from '../../components/MktTabs'
import { api } from '../../lib/api'
import { companyRoutes } from '../../lib/companyPaths'
import { useI18n } from '../../lib/i18n'
import {
  CONN_SURFACES,
  type ConnSurfaceId,
  hashForSurface,
  SURFACE_PROVIDERS,
  SURFACE_SOON,
  surfaceFromHash,
} from './connectionSurfaces'
import { ConnProviderIcon } from './connProviderIcons'
import { FinanceBankPanel } from './FinanceBankPanel'
import { MessagingConnectionsPanel } from './MessagingConnectionsPanel'
const SURFACE_ICONS: Record<ConnSurfaceId, Icon> = {
  social: ShareNetwork,
  ads: Megaphone,
  email: EnvelopeSimple,
  finance: Bank,
  aggregators: CirclesThreePlus,
  tools: Wrench,
}

const SURFACE_DATA_IC: Record<ConnSurfaceId, string> = {
  social: 'organic',
  ads: 'paid',
  email: 'email',
  finance: 'offline',
  aggregators: 'catalog',
  tools: 'seo',
}

type SecretRow = { provider: string; valid: boolean; keyHint?: string | null }

type MetricoolPayload = {
  linked: { id: string; blogId: string; label: string | null }[]
  available: { blogId: string; label: string }[]
  brandsError: string | null
  keyReady: boolean
  keyHint: string | null
}

type Props = {
  slug: string
  secrets: SecretRow[]
  canManage: boolean
  onSecretsChanged: () => void
}

export function SettingsConnectionsTab({ slug, secrets, canManage, onSecretsChanged }: Props) {
  const { t } = useI18n()
  const routes = companyRoutes(slug)
  const [surface, setSurface] = useState<ConnSurfaceId>(() => surfaceFromHash(window.location.hash) ?? 'social')
  const [mc, setMc] = useState<MetricoolPayload | null>(null)
  const [brandId, setBrandId] = useState('')
  const [brandLabel, setBrandLabel] = useState('')
  const [keys, setKeys] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState('')
  const [seoStatus, setSeoStatus] = useState('…')

  async function loadMetricool() {
    try {
      const r = await api<MetricoolPayload>(`/api/b/${slug}/settings/integrations/metricool`)
      setMc(r)
    } catch (e) {
      setMc(null)
      setMsg(String(e))
    }
  }

  useEffect(() => {
    loadMetricool().catch(console.error)
    api<{ instance?: { status?: string } }>(`/api/b/${slug}/openseo`)
      .then((r) => setSeoStatus(r.instance?.status ?? 'not_provisioned'))
      .catch(() => setSeoStatus('—'))
  }, [slug])

  useEffect(() => {
    const apply = () => {
      const next = surfaceFromHash(window.location.hash)
      if (next) setSurface(next)
    }
    apply()
    window.addEventListener('hashchange', apply)
    return () => window.removeEventListener('hashchange', apply)
  }, [])

  function selectSurface(next: ConnSurfaceId) {
    setSurface(next)
    const hash = hashForSurface(next)
    if (window.location.hash !== hash) {
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}${hash}`)
    }
  }

  function secretFor(p: string) {
    return secrets.find((s) => s.provider === p)
  }

  async function saveKey(provider: string) {
    const apiKey = keys[provider]
    if (!apiKey) return
    const r = await api<{ valid: boolean; detail: string }>(`/api/b/${slug}/settings/secrets`, {
      method: 'PUT',
      body: JSON.stringify({ provider, apiKey }),
    })
    setMsg(`${providerLabel(provider, t)}: ${r.valid ? 'OK' : t('statusInvalid')} — ${r.detail}`)
    setKeys((k) => ({ ...k, [provider]: '' }))
    onSecretsChanged()
    if (provider === 'metricool') await loadMetricool()
  }

  async function clearKey(provider: string) {
    if (!confirm(t('clearKeyConfirm'))) return
    await api(`/api/b/${slug}/settings/secrets/${provider}`, { method: 'DELETE' })
    setMsg(`${providerLabel(provider, t)}: ${t('keyRemoved')}`)
    onSecretsChanged()
    if (provider === 'metricool') await loadMetricool()
  }

  async function linkBrand() {
    if (!brandId) {
      setMsg(t('pickBrand'))
      return
    }
    await api(`/api/b/${slug}/settings/integrations/metricool`, {
      method: 'POST',
      body: JSON.stringify({ blogId: brandId, label: brandLabel || undefined }),
    })
    setBrandId('')
    setBrandLabel('')
    setMsg(t('brandLinked'))
    await loadMetricool()
    onSecretsChanged()
  }

  async function unlinkBrand(id: string) {
    if (!confirm(t('unlinkBrandConfirm'))) return
    await api(`/api/b/${slug}/settings/integrations/metricool/${id}`, { method: 'DELETE' })
    setMsg(t('brandUnlinked'))
    await loadMetricool()
    onSecretsChanged()
  }

  async function provisionSeo() {
    setMsg(t('provisioning'))
    try {
      await api(`/api/b/${slug}/openseo/provision`, { method: 'POST', body: '{}' })
      const r = await api<{ instance?: { status?: string } }>(`/api/b/${slug}/openseo`)
      setSeoStatus(r.instance?.status ?? 'not_provisioned')
      setMsg(t('seoProvisioned'))
      onSecretsChanged()
    } catch (e) {
      setMsg(String(e))
    }
  }

  const metricoolSecret = secretFor('metricool')
  const brevoSecret = secretFor('brevo')
  const seoOk = seoStatus !== 'not_provisioned' && seoStatus !== '—'

  const coreSocial = SURFACE_PROVIDERS.social
  const coreEmail = SURFACE_PROVIDERS.email
  const coreAds = SURFACE_PROVIDERS.ads
  const coreAgg = ['unipile']

  return (
    <div className="stack" id="connections">
      <MktTabs level="l2" label={t('connSurfacesLabel')} className="conn-surface-tabs">
        {CONN_SURFACES.map((id) => (
          <MktTab
            key={id}
            active={surface === id}
            label={surfaceLabel(id, t)}
            icon={SURFACE_ICONS[id]}
            dataIc={SURFACE_DATA_IC[id]}
            onClick={() => selectSurface(id)}
          />
        ))}
      </MktTabs>

      {surface === 'social' ? (
        <MessagingConnectionsPanel
          slug={slug}
          canManage={canManage}
          providerIds={coreSocial}
          soonProviders={SURFACE_SOON.social}
          title={t('connSurfaceSocialTitle')}
          sectionId="connections-social"
          hideHeaderConnect
        />
      ) : null}

      {surface === 'ads' ? (
        <MessagingConnectionsPanel
          slug={slug}
          canManage={canManage}
          providerIds={coreAds}
          soonProviders={SURFACE_SOON.ads}
          title={t('connSurfaceAdsTitle')}
          sectionId="connections-ads"
          hideHeaderConnect
          secrets={secrets}
          onSecretsChanged={onSecretsChanged}
        />
      ) : null}

      {surface === 'email' ? (
        <MessagingConnectionsPanel
          slug={slug}
          canManage={canManage}
          providerIds={coreEmail}
          accountProviderIds={[...coreEmail.filter((id) => id !== 'brevo'), 'unipile']}
          soonProviders={SURFACE_SOON.email}
          title={t('connSurfaceEmailTitle')}
          sectionId="connections-email"
          hideHeaderConnect
          secrets={secrets}
          onSecretsChanged={onSecretsChanged}
        />
      ) : null}

      {surface === 'finance' ? (
        <div className="stack" id="finance-connections-wrap">
          <FinanceBankPanel slug={slug} canManage={canManage} />
          {SURFACE_SOON.finance.length ? (
            <section className="panel stack">
              <h3 className="co-card-title">{t('connSoonFinanceTitle')}</h3>
              <p className="muted co-card-hint">{t('connSoonFinanceHint')}</p>
              <ul className="conn-provider-list conn-provider-grid">
                {SURFACE_SOON.finance.map((s) => (
                  <li key={s.id}>
                    <div className="conn-provider-card conn-provider-card--premium is-disabled" data-ic={s.id}>
                      <ConnProviderIcon id={s.id} size={28} />
                      <span className="conn-provider-copy">
                        <span className="conn-provider-name">{s.label}</span>
                        <span className="muted" style={{ fontSize: 12 }}>
                          {t('connProviderSoon')}
                        </span>
                      </span>
                      <button type="button" className="btn conn-provider-cta" disabled>
                        {t('connectBannerCta')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      {surface === 'aggregators' ? (
        <div className="stack">
          <section className="panel stack">
            <div className="co-card-head">
              <div className="co-card-title-row">
                <ConnProviderIcon id="metricool" size={28} />
                <div>
                  <h3 className="co-card-title">Metricool</h3>
                  <p className="muted co-card-hint">{t('metricoolHint')}</p>
                </div>
              </div>
              <span className={`badge ${mc?.linked.length || metricoolSecret?.valid ? 'ok' : 'warn'}`}>
                {mc?.linked.length || metricoolSecret?.valid ? t('statusConnected') : t('statusOpen')}
              </span>
            </div>

            {canManage ? (
              <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                <input
                  className="input"
                  style={{ flex: 1, minWidth: 180 }}
                  type="password"
                  autoComplete="off"
                  placeholder={
                    metricoolSecret?.keyHint
                      ? `${t('apiKey')} · ${metricoolSecret.keyHint}`
                      : t('apiKey')
                  }
                  value={keys.metricool ?? ''}
                  onChange={(e) => setKeys({ ...keys, metricool: e.target.value })}
                />
                <button className="btn primary" type="button" onClick={() => saveKey('metricool')}>
                  {t('save')}
                </button>
                {metricoolSecret ? (
                  <button className="btn" type="button" onClick={() => clearKey('metricool')}>
                    {t('removeKey')}
                  </button>
                ) : null}
              </div>
            ) : null}

            {mc?.linked.length ? (
              <div className="co-brand-chips">
                {mc.linked.map((b) => (
                  <div key={b.id} className="co-brand-chip">
                    <span className="co-brand-chip-name">{b.label || b.blogId}</span>
                    <span className="kpi muted">{b.blogId}</span>
                    {canManage ? (
                      <button className="btn" type="button" onClick={() => unlinkBrand(b.id)}>
                        {t('unlink')}
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                {t('noBrandsLinked')}
              </p>
            )}

            {canManage ? (
              <div className="co-connect-box stack">
                <div className="co-connect-label">{t('linkBrand')}</div>
                <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                  <select
                    className="input"
                    style={{ flex: 1, minWidth: 160 }}
                    value={brandId}
                    onChange={(e) => setBrandId(e.target.value)}
                    aria-label="Metricool Brand"
                    disabled={!mc?.keyReady}
                  >
                    <option value="">
                      {mc?.brandsError === 'metricool_key_required'
                        ? t('keyRequired')
                        : mc?.brandsError
                          ? t('brandsLoadError')
                          : t('pickBrand')}
                    </option>
                    {(mc?.available ?? []).map((b) => (
                      <option key={b.blogId} value={b.blogId}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input"
                    style={{ maxWidth: 160 }}
                    placeholder={t('labelOptional')}
                    value={brandLabel}
                    onChange={(e) => setBrandLabel(e.target.value)}
                  />
                  <button
                    className="btn primary"
                    type="button"
                    onClick={linkBrand}
                    disabled={!mc?.keyReady}
                  >
                    {t('link')}
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <MessagingConnectionsPanel
            slug={slug}
            canManage={canManage}
            providerIds={coreAgg}
            title={t('connSurfaceAggCoreTitle')}
            sectionId="connections-aggregators-core"
            hideHeaderConnect
          />
        </div>
      ) : null}

      {surface === 'tools' ? (
        <section className="panel stack" id="connections-tools">
          <div className="co-card-head">
            <div className="co-card-title-row">
              <ConnProviderIcon id="openseo" size={28} />
              <div>
                <h3 className="co-card-title">OpenSEO</h3>
                <p className="muted co-card-hint">{t('openseoHint')}</p>
              </div>
            </div>
            <span className={`badge ${seoOk ? 'ok' : 'warn'}`}>
              {seoOk ? t('statusConnected') : t('statusOpen')}
            </span>
          </div>
          <p className="kpi muted" style={{ margin: 0 }}>
            {t('status')}: {seoStatus}
          </p>
          <div className="row" style={{ gap: 8 }}>
            {canManage ? (
              <button className="btn primary" type="button" onClick={provisionSeo}>
                {t('provisionSeo')}
              </button>
            ) : null}
            <Link className="btn" to={routes.openseo}>
              {t('launchOpenSeo')}
            </Link>
          </div>
        </section>
      ) : null}

      {msg ? <p className="muted">{msg}</p> : null}
    </div>
  )
}

function surfaceLabel(
  id: ConnSurfaceId,
  t: (
    k:
      | 'connSurfaceSocial'
      | 'connSurfaceAds'
      | 'connSurfaceEmail'
      | 'connSurfaceFinance'
      | 'connSurfaceAggregators'
      | 'connSurfaceTools',
  ) => string,
) {
  if (id === 'social') return t('connSurfaceSocial')
  if (id === 'ads') return t('connSurfaceAds')
  if (id === 'email') return t('connSurfaceEmail')
  if (id === 'finance') return t('connSurfaceFinance')
  if (id === 'aggregators') return t('connSurfaceAggregators')
  return t('connSurfaceTools')
}

function providerLabel(
  p: string,
  t: (k: 'googleAds' | 'metaAds' | 'tiktokAds' | 'chatgptAds' | 'metricoolHint') => string,
) {
  if (p === 'google_ads') return t('googleAds')
  if (p === 'meta_ads') return t('metaAds')
  if (p === 'tiktok_ads') return t('tiktokAds')
  if (p === 'chatgpt_ads') return t('chatgptAds')
  if (p === 'metricool') return 'Metricool'
  if (p === 'brevo') return 'Brevo'
  return p
}
