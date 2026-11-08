/**
 * ConnectApiKeyModal — Verbinden flow for API-key providers (Ads keys, Brevo, …).
 * Ads → Integration Core; feature gates (Brevo/Metricool) → settings_secrets.
 * Location: apps/web/src/features/settings/ConnectApiKeyModal.tsx
 */
import { useState, type MouseEvent } from 'react'
import { X } from '@phosphor-icons/react'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { ConnProviderIcon } from './connProviderIcons'

const CORE_ADS_KEY = new Set([
  'tiktok_ads',
  'chatgpt_ads',
  'reddit_ads',
  'pinterest_ads',
  'microsoft_ads',
])

type Props = {
  slug: string
  providerId: string
  providerLabel: string
  onClose: () => void
  onConnected: () => void
}

export function ConnectApiKeyModal({
  slug,
  providerId,
  providerLabel,
  onClose,
  onConnected,
}: Props) {
  const { t } = useI18n()
  const [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    const key = apiKey.trim()
    if (!key) {
      setError(t('connApiKeyRequired'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (CORE_ADS_KEY.has(providerId)) {
        await api(`/api/b/${slug}/integrations/connections/ads-api-key`, {
          method: 'POST',
          body: JSON.stringify({ provider: providerId, apiKey: key }),
        })
        // Keep Funnel Direct-API gate working for known secret providers.
        if (
          providerId === 'tiktok_ads' ||
          providerId === 'chatgpt_ads' ||
          providerId === 'meta_ads' ||
          providerId === 'google_ads'
        ) {
          await api(`/api/b/${slug}/settings/secrets`, {
            method: 'PUT',
            body: JSON.stringify({ provider: providerId, apiKey: key }),
          }).catch(() => undefined)
        }
      } else {
        const r = await api<{ valid: boolean; detail: string }>(`/api/b/${slug}/settings/secrets`, {
          method: 'PUT',
          body: JSON.stringify({ provider: providerId, apiKey: key }),
        })
        if (!r.valid) {
          setError(`${t('statusInvalid')}: ${r.detail}`)
          return
        }
      }
      onConnected()
      onClose()
    } catch (e) {
      setError(String((e as Error).message || e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="crm-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="crm-modal conn-connect-modal"
        role="dialog"
        aria-modal
        aria-labelledby="conn-api-key-title"
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        <header className="crm-modal-head">
          <div className="co-card-title-row" style={{ gap: 10 }}>
            <ConnProviderIcon id={providerId} size={28} />
            <div>
              <h3 id="conn-api-key-title" className="co-card-title">
                {t('connConnectTitle')} · {providerLabel}
              </h3>
              <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                {t('connApiKeyModalHint')}
              </p>
            </div>
          </div>
          <button type="button" className="btn icon" onClick={onClose} aria-label={t('cancel')}>
            <X size={16} weight="bold" />
          </button>
        </header>
        <div className="crm-modal-body stack">
          {error ? (
            <p className="inbox-error" role="alert">
              {error}
            </p>
          ) : null}
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12 }}>
              {t('apiKey')}
            </span>
            <input
              className="input"
              type="password"
              autoComplete="off"
              autoFocus
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit().catch(console.error)
              }}
              placeholder={t('apiKey')}
            />
          </label>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn" onClick={onClose} disabled={busy}>
              {t('cancel')}
            </button>
            <button type="button" className="btn primary" onClick={() => submit()} disabled={busy}>
              {busy ? t('loading') : t('connectBannerCta')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
