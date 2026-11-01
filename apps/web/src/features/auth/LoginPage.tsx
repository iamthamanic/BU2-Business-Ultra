/**
 * Login page: segmented Zugangsdaten (email+password) vs Magic Link / OTP.
 * Location: apps/web/src/features/auth/LoginPage.tsx
 */
import { useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import type { AuthUser } from '../../app/App'

type LoginMode = 'credentials' | 'magic'

export function LoginPage({ onAuthed }: { onAuthed: (u: AuthUser) => void }) {
  const { t } = useI18n()
  const [mode, setMode] = useState<LoginMode>('credentials')
  const [email, setEmail] = useState('raccoova@gmail.com')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [otp, setOtp] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  function switchMode(next: LoginMode) {
    setMode(next)
    setMsg('')
  }

  async function loginPassword(e?: FormEvent) {
    e?.preventDefault()
    setBusy(true)
    setMsg('')
    try {
      const r = await api<{ user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      onAuthed(r.user)
    } catch (err) {
      setMsg(String(err))
    } finally {
      setBusy(false)
    }
  }

  async function sendMagic() {
    setBusy(true)
    setMsg('')
    try {
      await api<{ mode: string }>('/api/auth/magic-link', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setMsg(t('magicSent'))
    } catch (err) {
      setMsg(String(err))
    } finally {
      setBusy(false)
    }
  }

  async function verifyOtp() {
    setBusy(true)
    setMsg('')
    try {
      const r = await api<{ user: AuthUser }>('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email, code: otp }),
      })
      onAuthed(r.user)
    } catch (err) {
      setMsg(String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card stack">
        <div className="brand">
          <img
            className="brand-mark"
            src="/brand/bu-mark.png"
            alt="Business Ultra"
            width={80}
            height={50}
          />
          <span className="brand-name">{t('brand')}</span>
        </div>

        <div className="login-mode-toggle" role="tablist" aria-label={t('login')}>
          <button
            type="button"
            role="tab"
            className={mode === 'credentials' ? 'active' : ''}
            aria-selected={mode === 'credentials'}
            onClick={() => switchMode('credentials')}
          >
            {t('loginModeCredentials')}
          </button>
          <button
            type="button"
            role="tab"
            className={mode === 'magic' ? 'active' : ''}
            aria-selected={mode === 'magic'}
            onClick={() => switchMode('magic')}
          >
            {t('loginModeMagic')}
          </button>
        </div>

        {mode === 'credentials' ? (
          <form className="stack" onSubmit={loginPassword}>
            <label>
              <span className="label">{t('email')}</span>
              <input
                className="input"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              <span className="label">{t('password')}</span>
              <div className="password-field">
                <input
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                      <path
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10.5 10.5 0 0 1 12 5c5 0 9.3 3.1 11 7.5a11.7 11.7 0 0 1-4.2 5.1M6.1 6.1A11.7 11.7 0 0 0 1 12.5C2.7 16.9 7 20 12 20c1.5 0 2.9-.3 4.2-.8"
                      />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                      <path
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M1 12.5C2.7 8.1 7 5 12 5s9.3 3.1 11 7.5C21.3 16.9 17 20 12 20S2.7 16.9 1 12.5z"
                      />
                      <circle cx="12" cy="12.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
                    </svg>
                  )}
                </button>
              </div>
            </label>
            <button className="btn primary" type="submit" disabled={busy || password.length < 8}>
              {t('login')}
            </button>
          </form>
        ) : (
          <div className="stack">
            <label>
              <span className="label">{t('email')}</span>
              <input
                className="input"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <button className="btn primary" type="button" disabled={busy} onClick={sendMagic}>
              {t('sendMagic')}
            </button>
            <label>
              <span className="label">{t('otp')}</span>
              <input
                className="input"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
              />
            </label>
            <button className="btn" type="button" disabled={busy || otp.length !== 6} onClick={verifyOtp}>
              {t('verifyOtp')}
            </button>
          </div>
        )}

        {msg && <p className="muted">{msg}</p>}
      </div>
    </div>
  )
}
