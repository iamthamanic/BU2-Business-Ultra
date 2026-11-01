import { useState } from 'react'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import type { AuthUser } from '../../app/App'

export function LoginPage({ onAuthed }: { onAuthed: (u: AuthUser) => void }) {
  const { t } = useI18n()
  const [email, setEmail] = useState('raccoova@gmail.com')
  const [otp, setOtp] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function sendMagic() {
    setBusy(true)
    setMsg('')
    try {
      const r = await api<{ mode: string }>('/api/auth/magic-link', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setMsg(r.mode === 'console' ? 'Dev: Link/OTP in API-Konsole' : 'E-Mail gesendet / Email sent')
    } catch (e) {
      setMsg(String(e))
    } finally {
      setBusy(false)
    }
  }

  async function verifyOtp() {
    setBusy(true)
    try {
      const r = await api<{ user: AuthUser }>('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email, code: otp }),
      })
      onAuthed(r.user)
    } catch (e) {
      setMsg(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card stack">
        <div className="brand">{t('brand')}</div>
        <p className="muted">Dark-Ops · Magic Link / OTP</p>
        <label>
          <span className="label">{t('email')}</span>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button className="btn primary" disabled={busy} onClick={sendMagic}>{t('sendMagic')}</button>
        <label>
          <span className="label">{t('otp')}</span>
          <input className="input" value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} />
        </label>
        <button className="btn" disabled={busy || otp.length !== 6} onClick={verifyOtp}>{t('verifyOtp')}</button>
        {msg && <p className="muted">{msg}</p>}
      </div>
    </div>
  )
}
