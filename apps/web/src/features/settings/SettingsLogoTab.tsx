/**
 * SettingsLogoTab — 1:1 crop upload for company logo.
 * Location: apps/web/src/features/settings/SettingsLogoTab.tsx
 */
import { useRef, useState } from 'react'
import { BizLogo } from '../../components/BizLogo'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'

type Props = {
  slug: string
  name: string
  logoPath?: string | null
  onChanged: (logoPath: string | null) => void
}

export function SettingsLogoTab({ slug, name, logoPath, onChanged }: Props) {
  const { t } = useI18n()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

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
    reader.onerror = () => setMsg(t('logoReadError'))
    reader.readAsDataURL(file)
  }

  async function upload() {
    if (!preview) return
    try {
      const r = await api<{ logoPath: string }>(`/api/b/${slug}/settings/logo`, {
        method: 'POST',
        body: JSON.stringify({ dataUrl: preview }),
      })
      setMsg(t('logoSaved'))
      setPreview(null)
      onChanged(r.logoPath)
    } catch (e) {
      setMsg(String(e))
    }
  }

  async function clearLogo() {
    if (!confirm(t('removeLogoConfirm'))) return
    try {
      await api(`/api/b/${slug}/settings/logo`, { method: 'DELETE' })
      setMsg(t('logoRemoved'))
      setPreview(null)
      onChanged(null)
    } catch (e) {
      setMsg(String(e))
    }
  }

  return (
    <section className="panel stack">
      <div className="co-card-head">
        <div>
          <h3 className="co-card-title">{t('companyLogo')}</h3>
          <p className="muted co-card-hint">{t('logoHint')}</p>
        </div>
      </div>

      <div className="row" style={{ gap: 16, alignItems: 'center' }}>
        <BizLogo name={name} logoPath={logoPath} className="co-settings-logo" />
        <div className="stack" style={{ gap: 8 }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          <button className="btn" type="button" onClick={() => fileRef.current?.click()}>
            {t('pickLogo')}
          </button>
          {logoPath ? (
            <button className="btn" type="button" onClick={clearLogo}>
              {t('removeLogo')}
            </button>
          ) : null}
        </div>
      </div>

      {preview ? (
        <div className="stack">
          <div className="crop-stage">
            <img src={preview} alt="" width={256} height={256} />
          </div>
          <button className="btn primary" type="button" onClick={upload}>
            {t('upload')}
          </button>
        </div>
      ) : null}

      {msg ? <p className="muted">{msg}</p> : null}
    </section>
  )
}
