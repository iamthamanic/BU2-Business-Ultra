/**
 * CreateCompanyModal — Dark-Ops dialog to create a company (name+slug row, optional logo).
 * Used from HomePage; posts `/api/businesses` then optional `/api/b/:slug/settings/logo`.
 * Location: apps/web/src/components/CreateCompanyModal.tsx
 */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { CircleNotch, Plus, X } from '@phosphor-icons/react'
import { api } from '../lib/api'
import { useI18n } from '../lib/i18n'

type CreatedBiz = { id: string; name: string; slug: string; logoPath?: string | null }

type Props = {
  open: boolean
  onClose: () => void
  onCreated: (biz: CreatedBiz) => void
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

function cropToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read_failed'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('image_failed'))
      img.onload = () => {
        const size = Math.min(img.width, img.height)
        const canvas = document.createElement('canvas')
        canvas.width = 256
        canvas.height = 256
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('canvas_failed'))
          return
        }
        const sx = (img.width - size) / 2
        const sy = (img.height - size) / 2
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 256, 256)
        resolve(canvas.toDataURL('image/png'))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

export function CreateCompanyModal({ open, onClose, onCreated }: Props) {
  const { t } = useI18n()
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!open) return
    setName('')
    setSlug('')
    setSlugTouched(false)
    setLogoPreview(null)
    setErr('')
    setCreating(false)
    const tmr = window.setTimeout(() => nameRef.current?.focus(), 0)
    return () => window.clearTimeout(tmr)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') {
        ev.preventDefault()
        onClose()
      }
      if (ev.key !== 'Tab' || !dialogRef.current) return
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable.length) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (ev.shiftKey && document.activeElement === first) {
        ev.preventDefault()
        last.focus()
      } else if (!ev.shiftKey && document.activeElement === last) {
        ev.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  function onNameChange(value: string) {
    setName(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  async function onLogoFile(file: File | undefined) {
    if (!file) return
    try {
      const dataUrl = await cropToDataUrl(file)
      setLogoPreview(dataUrl)
    } catch {
      setErr(t('logoReadError'))
    }
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault()
    if (!name.trim() || !slug.trim() || creating) return
    setCreating(true)
    setErr('')
    try {
      const r = await api<{ business: CreatedBiz }>('/api/businesses', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), slug: slug.trim() }),
      })
      let logoPath = r.business.logoPath ?? null
      if (logoPreview) {
        try {
          const up = await api<{ logoPath: string }>(`/api/b/${r.business.slug}/settings/logo`, {
            method: 'POST',
            body: JSON.stringify({ dataUrl: logoPreview }),
          })
          logoPath = up.logoPath
        } catch (logoErr) {
          // Company exists; surface logo failure but still complete create
          setErr(String(logoErr))
        }
      }
      onCreated({ ...r.business, logoPath })
      onClose()
    } catch (ex) {
      setErr(String(ex))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div
      className="bu-modal-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="bu-modal panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="bu-modal-head">
          <h2 id={titleId} className="section-title" style={{ margin: 0 }}>
            {t('createBusiness')}
          </h2>
          <button type="button" className="btn icon-btn" onClick={onClose} aria-label={t('cancel')}>
            <X size={16} weight="bold" aria-hidden />
          </button>
        </div>
        <p className="muted page-lede">{t('createBusinessLede')}</p>
        <form className="stack" onSubmit={submit}>
          <div className="bu-modal-row-2">
            <label>
              <span className="label">{t('name')}</span>
              <input
                ref={nameRef}
                className="input"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                autoComplete="organization"
                required
              />
            </label>
            <label>
              <span className="label">{t('slug')}</span>
              <input
                className="input kpi"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true)
                  setSlug(slugify(e.target.value))
                }}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                required
              />
            </label>
          </div>

          <div className="bu-modal-logo">
            <span className="label">{t('companyLogo')}</span>
            <div className="bu-modal-logo-row">
              <button
                type="button"
                className="bu-logo-thumb crop-stage"
                onClick={() => fileRef.current?.click()}
                aria-label={t('pickLogo')}
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="" width={72} height={72} />
                ) : (
                  <span className="muted">1:1</span>
                )}
              </button>
              <div className="stack" style={{ gap: 8, flex: 1 }}>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => void onLogoFile(e.target.files?.[0])}
                />
                <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
                  {t('pickLogo')}
                </button>
                {logoPreview && (
                  <button type="button" className="btn" onClick={() => setLogoPreview(null)}>
                    {t('removeLogo')}
                  </button>
                )}
              </div>
            </div>
          </div>

          {err && (
            <p className="badge bad" role="alert">
              {err}
            </p>
          )}

          <div className="bu-modal-actions">
            <button type="button" className="btn" onClick={onClose} disabled={creating}>
              {t('cancel')}
            </button>
            <button
              className="btn primary"
              type="submit"
              disabled={creating || !name.trim() || !slug.trim()}
            >
              {creating ? (
                <CircleNotch className="spin" size={16} weight="regular" aria-hidden />
              ) : (
                <Plus size={16} weight="bold" aria-hidden />
              )}
              {t('createBusiness')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
