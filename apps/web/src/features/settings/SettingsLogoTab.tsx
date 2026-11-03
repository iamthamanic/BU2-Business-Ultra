/**
 * SettingsLogoTab — company logo identity card with square crop + upload.
 * Location: apps/web/src/features/settings/SettingsLogoTab.tsx
 */
import { useRef, useState } from 'react'
import { Image as ImageIcon, Trash, UploadSimple } from '@phosphor-icons/react'
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
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  function onFile(file: File) {
    setMsg('')
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
      img.onerror = () => setMsg(t('logoReadError'))
      img.src = String(reader.result)
    }
    reader.onerror = () => setMsg(t('logoReadError'))
    reader.readAsDataURL(file)
  }

  async function upload() {
    if (!preview || busy) return
    setBusy(true)
    setMsg('')
    try {
      const r = await api<{ logoPath: string }>(`/api/b/${slug}/settings/logo`, {
        method: 'POST',
        body: JSON.stringify({ dataUrl: preview }),
      })
      setPreview(null)
      onChanged(r.logoPath)
      setMsg(t('logoSaved'))
    } catch (e) {
      setMsg(String(e))
    } finally {
      setBusy(false)
    }
  }

  async function clearLogo() {
    if (!confirm(t('removeLogoConfirm')) || busy) return
    setBusy(true)
    setMsg('')
    try {
      await api(`/api/b/${slug}/settings/logo`, { method: 'DELETE' })
      setPreview(null)
      onChanged(null)
      setMsg(t('logoRemoved'))
    } catch (e) {
      setMsg(String(e))
    } finally {
      setBusy(false)
    }
  }

  function cancelPreview() {
    if (busy) return
    setPreview(null)
    setMsg('')
  }

  const shown = preview || logoPath

  return (
    <section className="panel stack co-identity-panel">
      <div className="co-card-head">
        <div>
          <h3 className="co-card-title">{t('companyLogo')}</h3>
          <p className="muted co-card-hint">{t('logoHint')}</p>
        </div>
      </div>

      <div className="co-identity-body">
        <button
          type="button"
          className={`co-identity-mark${preview ? ' is-preview' : ''}${shown ? ' has-media' : ''}`}
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          aria-label={t('pickLogo')}
        >
          {preview ? (
            <img src={preview} alt="" width={112} height={112} />
          ) : logoPath ? (
            <BizLogo name={name} logoPath={logoPath} className="co-identity-logo" />
          ) : (
            <span className="co-identity-empty">
              <ImageIcon size={28} weight="regular" aria-hidden />
              <span>{t('pickLogo')}</span>
            </span>
          )}
          <span className="co-identity-mark-hint">
            <UploadSimple size={14} weight="bold" aria-hidden />
            {t('pickLogo')}
          </span>
        </button>

        <div className="co-identity-actions">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) onFile(f)
            }}
          />
          {preview ? (
            <>
              <p className="muted co-identity-preview-note">{t('logoPreviewHint')}</p>
              <div className="co-identity-btn-row">
                <button type="button" className="btn" disabled={busy} onClick={cancelPreview}>
                  {t('cancel')}
                </button>
                <button type="button" className="btn primary" disabled={busy} onClick={() => void upload()}>
                  {busy ? '…' : t('upload')}
                </button>
              </div>
            </>
          ) : (
            <div className="co-identity-btn-row">
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                <UploadSimple size={14} weight="bold" aria-hidden />
                {t('pickLogo')}
              </button>
              {logoPath ? (
                <button
                  type="button"
                  className="btn icon-btn"
                  disabled={busy}
                  aria-label={t('removeLogo')}
                  title={t('removeLogo')}
                  onClick={() => void clearLogo()}
                >
                  <Trash size={14} weight="regular" aria-hidden />
                </button>
              ) : null}
            </div>
          )}
          {msg ? <p className={msg.startsWith('Error') || msg.includes('error') ? 'error' : 'muted'}>{msg}</p> : null}
        </div>
      </div>
    </section>
  )
}
