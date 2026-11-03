/**
 * Login page: segmented Zugangsdaten (email+password) vs Magic Link / OTP.
 * Location: apps/web/src/features/auth/LoginPage.tsx
 */
import { useState, type FormEvent } from 'react'
import { Eye, EyeSlash } from '@phosphor-icons/react'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import type { AuthUser } from '../../app/App'
import { BrandMark } from '../../components/BrandMark'

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
        <BrandMark to={false} showName size="lg" />

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
                    <EyeSlash size={18} weight="regular" aria-hidden />
                  ) : (
                    <Eye size={18} weight="regular" aria-hidden />
                  )}
                </button>
              </div>
            </label>
            <button className="btn primary" type="submit" disabled={busy || password.length < 4}>
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
