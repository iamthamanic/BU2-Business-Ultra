/**
 * ConnectAccountModal — multi-step connect flow for messaging providers.
 * OAuth (redirect URI copy) · IMAP/POP · Telegram Bot · Unipile Telegram User.
 * Location: apps/web/src/features/settings/ConnectAccountModal.tsx
 */
import { useEffect, useRef, useState } from 'react'
import { Copy, X } from '@phosphor-icons/react'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { ConnProviderIcon } from './connProviderIcons'

type ProviderRow = {
  id: string
  label: string
  authMethods: string[]
  adapterReady: boolean
  selectable?: boolean
  connectKind?: string
  redirectUri?: string | null
  oauthConfigured?: boolean | null
  clientConfigured?: boolean
}

type Props = {
  slug: string
  providers: ProviderRow[]
  onClose: () => void
  onConnected: () => void
}

export function ConnectAccountModal({ slug, providers, onClose, onConnected }: Props) {
  const { t } = useI18n()
  const [step, setStep] = useState<'provider' | 'auth'>('provider')
  const [picked, setPicked] = useState<ProviderRow | null>(null)
  const [botToken, setBotToken] = useState('')
  const [accountId, setAccountId] = useState('')
  const [qrAccountId, setQrAccountId] = useState<string | null>(null)
  const [qrCodeString, setQrCodeString] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pollHint, setPollHint] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [imapHost, setImapHost] = useState('')
  const [imapPort, setImapPort] = useState('993')
  const [imapUser, setImapUser] = useState('')
  const [imapPassword, setImapPassword] = useState('')
  const [imapSecure, setImapSecure] = useState(true)
  const [imapProtocol, setImapProtocol] = useState<'imap' | 'pop3'>('imap')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const connectable = providers.filter((p) => p.id !== 'mock')

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  function stopPoll() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  function statusLabel(p: ProviderRow): string {
    if (p.connectKind === 'oauth') {
      return p.oauthConfigured ? t('connProviderReady') : t('connOauthNeedsClient')
    }
    if (p.id === 'unipile' && !p.adapterReady) return t('connUnipileNotConfigured')
    if (p.adapterReady) return t('connProviderReady')
    return t('connProviderSoon')
  }

  function canOpen(p: ProviderRow): boolean {
    if (p.selectable != null) return p.selectable
    return p.adapterReady || p.connectKind === 'oauth'
  }

  async function copyRedirect(uri: string) {
    try {
      await navigator.clipboard.writeText(uri)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setError(t('connCopyFailed'))
    }
  }

  async function submitTelegram(ev: React.FormEvent) {
    ev.preventDefault()
    if (!botToken.trim()) return
    setBusy(true)
    setError(null)
    try {
      await api(`/api/b/${slug}/inbox/telegram/connect`, {
        method: 'POST',
        body: JSON.stringify({ botToken: botToken.trim() }),
      })
      onConnected()
      onClose()
    } catch (e) {
      setError(String((e as Error).message || e))
    } finally {
      setBusy(false)
    }
  }

  async function submitImap(ev: React.FormEvent) {
    ev.preventDefault()
    if (!imapHost.trim() || !imapUser.trim() || !imapPassword) return
    setBusy(true)
    setError(null)
    try {
      await api(`/api/b/${slug}/integrations/connections/imap`, {
        method: 'POST',
        body: JSON.stringify({
          host: imapHost.trim(),
          port: Number(imapPort) || undefined,
          user: imapUser.trim(),
          password: imapPassword,
          secure: imapSecure,
          protocol: imapProtocol,
        }),
      })
      onConnected()
      onClose()
    } catch (e) {
      setError(String((e as Error).message || e))
    } finally {
      setBusy(false)
    }
  }

  async function startOauth() {
    if (!picked) return
    setBusy(true)
    setError(null)
    try {
      const r = await api<{ authorizeUrl: string; redirectUri?: string }>(
        `/api/b/${slug}/integrations/oauth/${picked.id}/start`,
        { method: 'POST', body: '{}' },
      )
      if (r.authorizeUrl) {
        window.location.href = r.authorizeUrl
        return
      }
      setError(t('connOauthStartFailed'))
    } catch (e) {
      setError(String((e as Error).message || e))
    } finally {
      setBusy(false)
    }
  }

  async function linkUnipileAccount(ev: React.FormEvent) {
    ev.preventDefault()
    if (!accountId.trim()) return
    setBusy(true)
    setError(null)
    try {
      await api(`/api/b/${slug}/inbox/unipile/telegram/link`, {
        method: 'POST',
        body: JSON.stringify({ accountId: accountId.trim() }),
      })
      onConnected()
      onClose()
    } catch (e) {
      setError(String((e as Error).message || e))
    } finally {
      setBusy(false)
    }
  }

  async function startUnipileQr() {
    setBusy(true)
    setError(null)
    setPollHint(null)
    stopPoll()
    try {
      const r = await api<{ accountId: string; qrCodeString: string | null }>(
        `/api/b/${slug}/inbox/unipile/telegram/start`,
        { method: 'POST', body: '{}' },
      )
      setQrAccountId(r.accountId)
      setQrCodeString(r.qrCodeString)
      setPollHint(t('connUnipileWaiting'))
      pollRef.current = setInterval(() => {
        finalizePoll(r.accountId).catch(console.error)
      }, 2500)
    } catch (e) {
      setError(String((e as Error).message || e))
    } finally {
      setBusy(false)
    }
  }

  async function finalizePoll(id: string) {
    try {
      const r = await api<{ status: string; connection?: unknown }>(
        `/api/b/${slug}/inbox/unipile/telegram/finalize`,
        {
          method: 'POST',
          body: JSON.stringify({ accountId: id }),
        },
      )
      if (r.status === 'connected') {
        stopPoll()
        onConnected()
        onClose()
      }
    } catch (e) {
      const msg = String((e as Error).message || e)
      if (msg.includes('expired') || msg.includes('cancelled')) {
        stopPoll()
        setError(msg)
        setPollHint(null)
      }
    }
  }

  function pick(p: ProviderRow) {
    if (!canOpen(p)) return
    if (p.id === 'unipile' && !p.adapterReady) {
      setPicked(p)
      setStep('auth')
      setError(null)
      return
    }
    setPicked(p)
    setStep('auth')
    setError(null)
    setCopied(false)
    setQrAccountId(null)
    setQrCodeString(null)
    stopPoll()
  }

  function qrImgSrc(raw: string): string {
    if (raw.startsWith('data:') || raw.startsWith('http')) return raw
    return `https://quickchart.io/qr?text=${encodeURIComponent(raw)}&size=220`
  }

  function goBack() {
    stopPoll()
    setStep('provider')
  }

  return (
    <div className="bu-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="connect-acct-title">
      <div className="bu-modal panel crm-modal conn-connect-modal">
        <header className="bu-modal-head">
          <div>
            <h2 id="connect-acct-title" className="bu-modal-title">
              {t('connConnectTitle')}
            </h2>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
              {step === 'provider' ? t('connConnectStepProvider') : t('connConnectStepAuth')}
            </p>
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

          {step === 'provider' ? (
            <ul className="conn-provider-list">
              {connectable.map((p) => {
                const open = canOpen(p)
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={`conn-provider-card${open ? '' : ' is-disabled'}`}
                      data-ic={p.id}
                      disabled={!open}
                      onClick={() => pick(p)}
                    >
                      <ConnProviderIcon id={p.id} />
                      <span className="conn-provider-copy">
                        <span className="conn-provider-name">{p.label}</span>
                        <span className="muted" style={{ fontSize: 12 }}>
                          {statusLabel(p)}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : null}

          {step === 'auth' && picked?.connectKind === 'oauth' ? (
            <div className="stack">
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                {t('connOauthRedirectHint')}
              </p>
              {picked.redirectUri ? (
                <div className="conn-redirect-box">
                  <code className="conn-redirect-uri">{picked.redirectUri}</code>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => copyRedirect(picked.redirectUri!).catch(console.error)}
                  >
                    <Copy size={14} weight="bold" aria-hidden />
                    {copied ? t('connCopied') : t('connCopy')}
                  </button>
                </div>
              ) : null}
              {!picked.oauthConfigured ? (
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                  {t('connOauthEnvHint')}
                </p>
              ) : null}
              <footer className="bu-modal-actions">
                <button type="button" className="btn" onClick={goBack}>
                  {t('back')}
                </button>
                <button
                  type="button"
                  className="btn primary"
                  disabled={busy || !picked.oauthConfigured}
                  onClick={() => startOauth().catch(console.error)}
                >
                  {busy ? t('loading') : t('connOauthStart')}
                </button>
              </footer>
            </div>
          ) : null}

          {step === 'auth' && picked?.id === 'imap' ? (
            <form className="stack" onSubmit={submitImap}>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                {t('connImapHint')}
              </p>
              <label className="label" htmlFor="conn-imap-protocol">
                {t('connImapProtocol')}
              </label>
              <select
                id="conn-imap-protocol"
                className="input"
                value={imapProtocol}
                onChange={(e) => {
                  const v = e.target.value === 'pop3' ? 'pop3' : 'imap'
                  setImapProtocol(v)
                  setImapPort(v === 'pop3' ? '995' : '993')
                }}
              >
                <option value="imap">IMAP</option>
                <option value="pop3">POP3</option>
              </select>
              <label className="label" htmlFor="conn-imap-host">
                {t('connImapHost')}
              </label>
              <input
                id="conn-imap-host"
                className="input"
                value={imapHost}
                onChange={(e) => setImapHost(e.target.value)}
                placeholder="imap.example.com"
                required
                autoComplete="off"
              />
              <label className="label" htmlFor="conn-imap-port">
                {t('connImapPort')}
              </label>
              <input
                id="conn-imap-port"
                className="input"
                value={imapPort}
                onChange={(e) => setImapPort(e.target.value)}
                inputMode="numeric"
                required
              />
              <label className="label" htmlFor="conn-imap-user">
                {t('connImapUser')}
              </label>
              <input
                id="conn-imap-user"
                className="input"
                value={imapUser}
                onChange={(e) => setImapUser(e.target.value)}
                required
                autoComplete="username"
              />
              <label className="label" htmlFor="conn-imap-pass">
                {t('connImapPassword')}
              </label>
              <input
                id="conn-imap-pass"
                className="input"
                type="password"
                value={imapPassword}
                onChange={(e) => setImapPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <label className="conn-toggle-row" htmlFor="conn-imap-secure">
                <span>{t('connImapSecure')}</span>
                <input
                  id="conn-imap-secure"
                  type="checkbox"
                  checked={imapSecure}
                  onChange={(e) => setImapSecure(e.target.checked)}
                />
              </label>
              <footer className="bu-modal-actions">
                <button type="button" className="btn" onClick={goBack}>
                  {t('back')}
                </button>
                <button
                  type="submit"
                  className="btn primary"
                  disabled={busy || !imapHost.trim() || !imapUser.trim() || !imapPassword}
                >
                  {busy ? t('loading') : t('inboxConnect')}
                </button>
              </footer>
            </form>
          ) : null}

          {step === 'auth' && picked?.id === 'telegram' ? (
            <form className="stack" onSubmit={submitTelegram}>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                {t('inboxTelegramHint')}
              </p>
              <label className="label" htmlFor="conn-tg-token">
                {t('inboxTelegramConnect')}
              </label>
              <input
                id="conn-tg-token"
                className="input"
                type="password"
                autoComplete="off"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="123456:ABC…"
                required
              />
              <footer className="bu-modal-actions">
                <button type="button" className="btn" onClick={goBack}>
                  {t('back')}
                </button>
                <button
                  type="submit"
                  className="btn primary"
                  disabled={busy || !botToken.trim()}
                >
                  {busy ? t('loading') : t('inboxConnect')}
                </button>
              </footer>
            </form>
          ) : null}

          {step === 'auth' && picked?.id === 'unipile' ? (
            <div className="stack">
              {!picked.adapterReady ? (
                <>
                  <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                    {t('connUnipileNotConfigured')}
                  </p>
                  <footer className="bu-modal-actions">
                    <button type="button" className="btn" onClick={goBack}>
                      {t('back')}
                    </button>
                  </footer>
                </>
              ) : (
                <>
                  <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                    {t('connUnipileHint')}
                  </p>

                  <button
                    type="button"
                    className="btn primary"
                    disabled={busy}
                    onClick={() => startUnipileQr().catch(console.error)}
                  >
                    {busy ? t('loading') : t('connUnipileStartQr')}
                  </button>

                  {qrCodeString ? (
                    <div className="conn-qr-wrap">
                      <img
                        className="conn-qr-img"
                        src={qrImgSrc(qrCodeString)}
                        alt={t('connUnipileQrAlt')}
                        width={220}
                        height={220}
                      />
                    </div>
                  ) : null}
                  {qrAccountId ? (
                    <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                      account_id: {qrAccountId}
                    </p>
                  ) : null}
                  {pollHint ? <p className="muted">{pollHint}</p> : null}

                  <div className="conn-or-sep muted">{t('connOr')}</div>

                  <form className="stack" onSubmit={linkUnipileAccount}>
                    <label className="label" htmlFor="conn-unipile-acct">
                      {t('connUnipileAccountId')}
                    </label>
                    <input
                      id="conn-unipile-acct"
                      className="input"
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      placeholder="acc_…"
                      autoComplete="off"
                      required
                    />
                    <footer className="bu-modal-actions">
                      <button type="button" className="btn" onClick={goBack}>
                        {t('back')}
                      </button>
                      <button
                        type="submit"
                        className="btn primary"
                        disabled={busy || !accountId.trim()}
                      >
                        {busy ? t('loading') : t('inboxConnect')}
                      </button>
                    </footer>
                  </form>
                </>
              )}
            </div>
          ) : null}
        </div>

        {step === 'provider' ? (
          <footer className="bu-modal-actions">
            <button type="button" className="btn" onClick={onClose}>
              {t('cancel')}
            </button>
          </footer>
        ) : null}
      </div>
    </div>
  )
}
