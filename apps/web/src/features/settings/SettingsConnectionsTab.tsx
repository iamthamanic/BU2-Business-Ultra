/**
 * SettingsConnectionsTab — Messaging, Bank (finAPI), Metricool, Brevo, OpenSEO, Ads.
 * Location: apps/web/src/features/settings/SettingsConnectionsTab.tsx
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { companyRoutes } from '../../lib/companyPaths'
import { useI18n } from '../../lib/i18n'
import { ConnProviderIcon } from './connProviderIcons'
import { FinanceBankPanel } from './FinanceBankPanel'
import { MessagingConnectionsPanel } from './MessagingConnectionsPanel'

const DIRECT_PROVIDERS = ['google_ads', 'meta_ads', 'tiktok_ads', 'chatgpt_ads'] as const

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
  const [mc, setMc] = useState<MetricoolPayload | null>(null)
  const [brandId, setBrandId] = useState('')
  const [brandLabel, setBrandLabel] = useState('')
  const [keys, setKeys] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState('')
  const [seoStatus, setSeoStatus] = useState('…')
  const [showDirect, setShowDirect] = useState(false)

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
    const raw = window.location.hash.replace(/^#/, '').toLowerCase()
    if (raw !== 'finance-connections' && raw !== 'finapi') return
    const el = document.getElementById('finance-connections')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [slug])

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

  return (
    <div className="stack" id="connections">
      <MessagingConnectionsPanel slug={slug} canManage={canManage} />

      <FinanceBankPanel slug={slug} canManage={canManage} />

      <h3 className="conn-legacy-heading">{t('connLegacyHeading')}</h3>

      {/* Metricool */}
      <section className="panel stack">
        <div className="co-card-head">
          <div className="co-card-title-row">
            <ConnProviderIcon id="metricool" size={22} />
            <div>
              <h3 className="co-card-title">Metricool</h3>
              <p className="muted co-card-hint">{t('metricoolHint')}</p>
            </div>
          </div>
          <span className={`badge ${mc?.linked.length || metricoolSecret?.valid ? 'ok' : 'warn'}`}>
            {mc?.linked.length || metricoolSecret?.valid ? t('statusConnected') : t('statusOpen')}
          </span>
        </div>

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

        {mc?.linked.length ? (
          <div className="co-brand-chips">
            {mc.linked.map((b) => (
              <div key={b.id} className="co-brand-chip">
                <span className="co-brand-chip-name">{b.label || b.blogId}</span>
                <span className="kpi muted">{b.blogId}</span>
                <button className="btn" type="button" onClick={() => unlinkBrand(b.id)}>
                  {t('unlink')}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            {t('noBrandsLinked')}
          </p>
        )}

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
            <button className="btn primary" type="button" onClick={linkBrand} disabled={!mc?.keyReady}>
              {t('link')}
            </button>
          </div>
        </div>
      </section>

      {/* Brevo */}
      <section className="panel stack">
        <div className="co-card-head">
          <div className="co-card-title-row">
            <ConnProviderIcon id="brevo" size={22} />
            <div>
              <h3 className="co-card-title">
                {t('emailMarketing')} · Brevo
              </h3>
              <p className="muted co-card-hint">{t('brevoHint')}</p>
            </div>
          </div>
          <span className={`badge ${brevoSecret?.valid ? 'ok' : 'warn'}`}>
            {brevoSecret?.valid ? t('statusConnected') : t('statusOpen')}
          </span>
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <input
            className="input"
            style={{ flex: 1, minWidth: 180 }}
            type="password"
            autoComplete="off"
            placeholder={
              brevoSecret?.keyHint ? `${t('apiKey')} · ${brevoSecret.keyHint}` : 'xkeysib-…'
            }
            value={keys.brevo ?? ''}
            onChange={(e) => setKeys({ ...keys, brevo: e.target.value })}
          />
          <button className="btn primary" type="button" onClick={() => saveKey('brevo')}>
            {t('save')}
          </button>
          {brevoSecret ? (
            <button className="btn" type="button" onClick={() => clearKey('brevo')}>
              {t('removeKey')}
            </button>
          ) : null}
        </div>
      </section>

      {/* OpenSEO */}
      <section className="panel stack">
        <div className="co-card-head">
          <div className="co-card-title-row">
            <ConnProviderIcon id="openseo" size={22} />
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
          <button className="btn primary" type="button" onClick={provisionSeo}>
            {t('provisionSeo')}
          </button>
          <Link className="btn" to={routes.openseo}>
            {t('launchOpenSeo')}
          </Link>
        </div>
      </section>

      {/* Direct Ads */}
      <section className="panel stack">
        <div className="co-card-head">
          <div className="co-card-title-row">
            <ConnProviderIcon id="direct_ads" size={22} />
            <div>
              <h3 className="co-card-title">{t('directAdsKeys')}</h3>
              <p className="muted co-card-hint">{t('directAdsHint')}</p>
            </div>
          </div>
          <button className="btn" type="button" onClick={() => setShowDirect((v) => !v)}>
            {showDirect ? t('hide') : t('show')}
          </button>
        </div>
        {showDirect
          ? DIRECT_PROVIDERS.map((p) => {
              const st = secretFor(p)
              return (
                <div key={p} className="stack" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span className="co-card-title-row" style={{ gap: 8 }}>
                      <ConnProviderIcon id={p} size={18} />
                      <strong>{providerLabel(p, t)}</strong>
                    </span>
                    <span className={`badge ${st?.valid ? 'ok' : 'warn'}`}>
                      {st?.valid ? `${t('statusValid')} ${st.keyHint ?? ''}` : t('statusMissing')}
                    </span>
                  </div>
                  <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                    <input
                      className="input"
                      style={{ flex: 1, minWidth: 160 }}
                      type="password"
                      autoComplete="off"
                      placeholder={t('apiKey')}
                      value={keys[p] ?? ''}
                      onChange={(e) => setKeys({ ...keys, [p]: e.target.value })}
                    />
                    <button className="btn primary" type="button" onClick={() => saveKey(p)}>
                      {t('save')}
                    </button>
                    {st ? (
                      <button className="btn" type="button" onClick={() => clearKey(p)}>
                        {t('removeKey')}
                      </button>
                    ) : null}
                  </div>
                </div>
              )
            })
          : null}
      </section>

      {msg ? <p className="muted">{msg}</p> : null}
    </div>
  )
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
