/**
 * FinanceBankPanel — finAPI bank credentials (Settings → Verbindungen).
 * Stores client id/secret via Integration Core; transaction sync later.
 * Location: apps/web/src/features/settings/FinanceBankPanel.tsx
 */
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { ConnProviderIcon } from './connProviderIcons'

type PublicConnection = {
  id: string
  provider: string
  displayName: string | null
  externalAccountId: string
  status: string
}

type Props = {
  slug: string
  canManage: boolean
}

export function FinanceBankPanel({ slug, canManage }: Props) {
  const { t } = useI18n()
  const [connections, setConnections] = useState<PublicConnection[]>([])
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [dataKey, setDataKey] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  async function load() {
    try {
      const r = await api<{ connections: PublicConnection[] }>(
        `/api/b/${slug}/integrations/connections`,
      )
      setConnections((r.connections || []).filter((c) => c.provider === 'finapi'))
    } catch (e) {
      setError(String(e))
    }
  }

  useEffect(() => {
    load().catch(console.error)
  }, [slug])

  async function connect() {
    if (!clientId.trim() || !clientSecret.trim()) {
      setError(t('finapiMissingFields'))
      return
    }
    setBusy(true)
    setError('')
    setMsg('')
    try {
      await api(`/api/b/${slug}/integrations/connections/finapi`, {
        method: 'POST',
        body: JSON.stringify({
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
          dataDecryptionKey: dataKey.trim() || undefined,
          displayName: displayName.trim() || undefined,
        }),
      })
      setClientId('')
      setClientSecret('')
      setDataKey('')
      setDisplayName('')
      setMsg(t('finapiConnected'))
      await load()
    } catch (e) {
      setError(String((e as Error).message || e))
    } finally {
      setBusy(false)
    }
  }

  async function disconnect(id: string) {
    if (!confirm(t('finapiDisconnectConfirm'))) return
    setBusy(true)
    setError('')
    try {
      await api(`/api/b/${slug}/integrations/connections/${id}`, { method: 'DELETE' })
      setMsg(t('finapiDisconnected'))
      await load()
    } catch (e) {
      setError(String((e as Error).message || e))
    } finally {
      setBusy(false)
    }
  }

  const connected = connections.length > 0

  return (
    <section className="panel stack" id="finance-connections">
      <div className="co-card-head">
        <div className="co-card-title-row">
          <ConnProviderIcon id="finapi" size={28} />
          <div>
            <h3 className="co-card-title">{t('finapiTitle')}</h3>
            <p className="muted co-card-hint">{t('finapiHint')}</p>
          </div>
        </div>
        <span className={`badge ${connected ? 'ok' : 'warn'}`}>
          {connected ? t('statusConnected') : t('statusOpen')}
        </span>
      </div>

      {connections.length > 0 ? (
        <div className="co-brand-chips">
          {connections.map((c) => (
            <div key={c.id} className="co-brand-chip">
              <span className="co-brand-chip-name">
                {c.displayName || c.externalAccountId}
              </span>
              <span className="kpi muted">{c.status}</span>
              {canManage ? (
                <button
                  className="btn"
                  type="button"
                  disabled={busy}
                  onClick={() => disconnect(c.id)}
                >
                  {t('unlink')}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          {t('finapiEmpty')}
        </p>
      )}

      {canManage ? (
        <div className="co-connect-box stack">
          <div className="co-connect-label">{t('finapiConnectLabel')}</div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <input
              className="input"
              style={{ flex: 1, minWidth: 160 }}
              autoComplete="off"
              placeholder={t('finapiClientId')}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
            <input
              className="input"
              style={{ flex: 1, minWidth: 160 }}
              type="password"
              autoComplete="off"
              placeholder={t('finapiClientSecret')}
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
            />
          </div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <input
              className="input"
              style={{ flex: 1, minWidth: 160 }}
              type="password"
              autoComplete="off"
              placeholder={t('finapiDataKeyOptional')}
              value={dataKey}
              onChange={(e) => setDataKey(e.target.value)}
            />
            <input
              className="input"
              style={{ maxWidth: 200 }}
              placeholder={t('labelOptional')}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <button
              className="btn primary"
              type="button"
              disabled={busy}
              onClick={() => connect()}
            >
              {t('connectBannerCta')}
            </button>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 11.5 }}>
            {t('finapiSyncNote')}
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="inbox-error" role="alert">
          {error}
        </p>
      ) : null}
      {msg ? <p className="muted">{msg}</p> : null}
    </section>
  )
}
