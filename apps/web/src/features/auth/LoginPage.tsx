/**
 * Login page: primary email+password; secondary Magic Link / OTP (collapsed).
 * Location: apps/web/src/features/auth/LoginPage.tsx
 */
import { useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import type { AuthUser } from '../../app/App'

export function LoginPage({ onAuthed }: { onAuthed: (u: AuthUser) => void }) {
  const { t } = useI18n()
  const [email, setEmail] = useState('raccoova@gmail.com')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

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
      const r = await api<{ mode: string }>('/api/auth/magic-link', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setMsg(r.mode === 'console' ? t('magicDevHint') : t('magicSent'))
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
        <p className="muted">Dark-Ops · {t('login')}</p>

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
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="btn primary" type="submit" disabled={busy || password.length < 8}>
            {t('login')}
          </button>
        </form>

        <details className="login-secondary">
          <summary className="muted">{t('magicOtpAlt')}</summary>
          <div className="stack" style={{ marginTop: 12 }}>
            <button className="btn" type="button" disabled={busy} onClick={sendMagic}>
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
              />
            </label>
            <button className="btn" type="button" disabled={busy || otp.length !== 6} onClick={verifyOtp}>
              {t('verifyOtp')}
            </button>
          </div>
        </details>

        {msg && <p className="muted">{msg}</p>}
      </div>
    </div>
  )
}
