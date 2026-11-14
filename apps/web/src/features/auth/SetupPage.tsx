/**
 * First-run web wizard when no users exist.
 * Location: apps/web/src/features/auth/SetupPage.tsx
 */
import { useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import type { AuthUser } from '../../app/App'
import { BrandMark } from '../../components/BrandMark'

export function SetupPage({ onDone }: { onDone: (u: AuthUser) => void }) {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companySlug, setCompanySlug] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  function onName(v: string) {
    setCompanyName(v)
    if (!companySlug || companySlug === slugify(companyName)) {
      setCompanySlug(slugify(v))
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    try {
      const r = await api<{ user: AuthUser }>('/api/setup', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          displayName: displayName || undefined,
          companyName,
          companySlug,
        }),
      })
      // Session cookie set by API; refresh me
      const me = await api<{ user: AuthUser }>('/api/auth/me')
      onDone(me.user ?? r.user)
    } catch (err) {
      setMsg(String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <form className="login-card stack" onSubmit={(e) => void submit(e)}>
        <BrandMark />
        <h1>{t('setupTitle')}</h1>
        <p className="muted">{t('setupHint')}</p>
        <label>
          {t('email')}
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          {t('password')}
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label>
          {t('displayNameLabel')}
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        <label>
          {t('companyName')}
          <input required value={companyName} onChange={(e) => onName(e.target.value)} />
        </label>
        <label>
          {t('companySlug')}
          <input required value={companySlug} onChange={(e) => setCompanySlug(e.target.value)} />
        </label>
        {msg ? <p className="error">{msg}</p> : null}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {t('setupSubmit')}
        </button>
      </form>
    </div>
  )
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64)
}
