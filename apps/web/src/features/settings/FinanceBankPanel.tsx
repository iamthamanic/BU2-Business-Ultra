/**
 * FinanceBankPanel — finAPI via platform env (FINAPI_*); no Client-ID in UI.
 * Bank Web Form connect is the next slice after env verification.
 * Location: apps/web/src/features/settings/FinanceBankPanel.tsx
 */
import { useCallback, useEffect, useState } from 'react'
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

type PlatformStatus = {
  finapi: boolean
  finapiBaseUrl?: string
}

type Props = {
  slug: string
  canManage: boolean
}

export function FinanceBankPanel({ slug, canManage }: Props) {
  const { t } = useI18n()
  const [connections, setConnections] = useState<PublicConnection[]>([])
  const [platform, setPlatform] = useState<PlatformStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([
        api<{ connections: PublicConnection[] }>(`/api/b/${slug}/integrations/connections`),
        api<PlatformStatus>(`/api/b/${slug}/integrations/platform-status`),
      ])
      setConnections((c.connections || []).filter((row) => row.provider === 'finapi'))
      setPlatform({ finapi: p.finapi, finapiBaseUrl: p.finapiBaseUrl })
    } catch (e) {
      setError(String(e))
    }
  }, [slug])

  useEffect(() => {
    load().catch(console.error)
  }, [load])

  async function connect() {
    setBusy(true)
    setError('')
    setMsg('')
    try {
      await api(`/api/b/${slug}/integrations/connections/finapi`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      setMsg(t('finapiConnectedEnv'))
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
  const envReady = Boolean(platform?.finapi)

  return (
    <section className="panel stack" id="finance-connections">
      <div className="co-card-head">
        <div className="co-card-title-row">
          <ConnProviderIcon id="finapi" size={28} />
          <div>
            <h3 className="co-card-title">{t('finapiTitle')}</h3>
            <p className="muted co-card-hint">{t('finapiHintEnv')}</p>
          </div>
        </div>
        <span className={`badge ${connected ? 'ok' : envReady ? 'ok' : 'warn'}`}>
          {connected
            ? t('statusConnected')
            : envReady
              ? t('finapiEnvReady')
              : t('finapiEnvMissing')}
        </span>
      </div>

      {platform?.finapiBaseUrl ? (
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          {t('finapiBaseUrlLabel')}: {platform.finapiBaseUrl}
        </p>
      ) : null}

      {connections.length > 0 ? (
        <div className="co-brand-chips">
          {connections.map((c) => (
            <div key={c.id} className="co-brand-chip">
              <span className="co-brand-chip-name">{c.displayName || c.externalAccountId}</span>
              <span className="kpi muted">{c.status}</span>
              {canManage ? (
                <button className="btn" type="button" disabled={busy} onClick={() => disconnect(c.id)}>
                  {t('unlink')}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          {envReady ? t('finapiEmptyReady') : t('finapiEmpty')}
        </p>
      )}

      {canManage ? (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button
            className="btn primary"
            type="button"
            disabled={busy || !envReady}
            onClick={() => connect()}
          >
            {t('finapiVerifyConnect')}
          </button>
        </div>
      ) : null}

      <p className="muted" style={{ margin: 0, fontSize: 11.5 }}>
        {t('finapiSyncNoteEnv')}
      </p>

      {error ? (
        <p className="inbox-error" role="alert">
          {error}
        </p>
      ) : null}
      {msg ? <p className="muted">{msg}</p> : null}
    </section>
  )
}
