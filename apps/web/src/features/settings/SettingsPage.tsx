import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'

const PROVIDERS = ['metricool', 'brevo', 'google_ads', 'meta_ads', 'tiktok_ads', 'chatgpt_ads'] as const

export function SettingsPage() {
  const { slug } = useParams()
  const { t } = useI18n()
  const [statuses, setStatuses] = useState<any[]>([])
  const [keys, setKeys] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteToken, setInviteToken] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)

  async function refresh() {
    const r = await api<{ secrets: any[] }>(`/api/b/${slug}/settings/secrets`)
    setStatuses(r.secrets)
  }

  useEffect(() => { refresh().catch(console.error) }, [slug])

  async function save(provider: string) {
    const apiKey = keys[provider]
    if (!apiKey) return
    const r = await api<{ valid: boolean; detail: string }>(`/api/b/${slug}/settings/secrets`, {
      method: 'PUT',
      body: JSON.stringify({ provider, apiKey }),
    })
    setMsg(`${provider}: ${r.valid ? 'OK' : 'invalid'} — ${r.detail}`)
    setKeys((k) => ({ ...k, [provider]: '' }))
    await refresh()
  }

  async function invite() {
    const r = await api<{ acceptToken: string }>(`/api/b/${slug}/invites`, {
      method: 'POST',
      body: JSON.stringify({ email: inviteEmail, role: 'editor' }),
    })
    setInviteToken(r.acceptToken)
  }

  function onFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const size = Math.min(img.width, img.height)
        const canvas = document.createElement('canvas')
        canvas.width = 256
        canvas.height = 256
        const ctx = canvas.getContext('2d')!
        const sx = (img.width - size) / 2
        const sy = (img.height - size) / 2
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 256, 256)
        setPreview(canvas.toDataURL('image/png'))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  }

  async function uploadLogo() {
    if (!preview) return
    const r = await api<{ logoPath: string }>(`/api/b/${slug}/settings/logo`, {
      method: 'POST',
      body: JSON.stringify({ dataUrl: preview }),
    })
    setMsg(`Logo saved: ${r.logoPath}`)
  }

  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>{t('settings')}</h1>
      <p className="muted">{t('disabledUntilKey')}</p>
      <div className="panel stack">
        {PROVIDERS.map((p) => {
          const st = statuses.find((s) => s.provider === p)
          return (
            <div key={p} className="stack" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong>{p}</strong>
                <span className={`badge ${st?.valid ? 'ok' : 'warn'}`}>{st?.valid ? `valid ${st.keyHint ?? ''}` : 'missing'}</span>
              </div>
              <div className="row">
                <input className="input" style={{ flex: 1 }} type="password" placeholder="API key" value={keys[p] ?? ''} onChange={(e) => setKeys({ ...keys, [p]: e.target.value })} />
                <button className="btn primary" onClick={() => save(p)}>{t('save')}</button>
              </div>
            </div>
          )
        })}
        {msg && <p className="muted">{msg}</p>}
      </div>

      <div className="panel stack">
        <h3 style={{ margin: 0 }}>{t('invite')}</h3>
        <input className="input" placeholder="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
        <button className="btn" onClick={invite}>{t('invite')}</button>
        {inviteToken && <p className="kpi">accept token: {inviteToken}</p>}
      </div>

      <div className="panel stack">
        <h3 style={{ margin: 0 }}>{t('logoCrop')}</h3>
        <input ref={fileRef} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        <div className="crop-stage">{preview ? <img src={preview} alt="crop" width={256} height={256} /> : <span className="muted">1:1 crop preview</span>}</div>
        <button className="btn primary" disabled={!preview} onClick={uploadLogo}>{t('upload')}</button>
      </div>
    </div>
  )
}
