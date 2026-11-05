/**
 * ProductDescTab — Modal tab: cover, name, description, market.
 * Cover uses a real <label htmlFor> (more reliable than button→hidden input)
 * and compresses large images so the 2MB API limit is not a silent fail.
 * Location: apps/web/src/features/products/ProductDescTab.tsx
 */
import { ImageSquare } from '@phosphor-icons/react'
import { useId, useRef, useState, type MouseEvent } from 'react'
import { useI18n } from '../../lib/i18n'
import { initials, type ProductDraft } from './productTypes'

type Props = {
  draft: ProductDraft
  onChange: (patch: Partial<ProductDraft>) => void
  readOnly?: boolean
}

const MAX_BYTES = 2_000_000
const MAX_EDGE = 1600

/** Read file → data URL; compress via canvas when over size or very large. */
async function fileToCoverDataUrl(file: File): Promise<string> {
  const rawUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('read_failed'))
    reader.readAsDataURL(file)
  })
  if (!rawUrl.startsWith('data:image/')) throw new Error('not_image')

  // Small enough already — keep original (png/webp/jpeg as picked).
  if (file.size <= MAX_BYTES && file.type !== 'image/heic' && file.type !== 'image/heif') {
    return rawUrl
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('decode_failed'))
    el.src = rawUrl
  })

  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height, 1))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  ctx.drawImage(img, 0, 0, w, h)

  let quality = 0.88
  let out = canvas.toDataURL('image/jpeg', quality)
  while (out.length * 0.75 > MAX_BYTES && quality > 0.45) {
    quality -= 0.1
    out = canvas.toDataURL('image/jpeg', quality)
  }
  if (out.length * 0.75 > MAX_BYTES) throw new Error('too_large')
  return out
}

export function ProductDescTab({ draft, onChange, readOnly }: Props) {
  const { t } = useI18n()
  const inputId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [coverErr, setCoverErr] = useState('')
  const [busy, setBusy] = useState(false)
  const cover = draft.coverDataUrl || draft.coverPath

  async function onFile(file: File | undefined) {
    if (!file || readOnly) return
    setCoverErr('')
    setBusy(true)
    try {
      if (!file.type.startsWith('image/') && !/\.(png|jpe?g|webp|gif|heic|heif)$/i.test(file.name)) {
        setCoverErr(t('productCoverBadType'))
        return
      }
      const dataUrl = await fileToCoverDataUrl(file)
      onChange({ coverDataUrl: dataUrl })
    } catch (e) {
      const code = e instanceof Error ? e.message : 'fail'
      if (code === 'too_large') setCoverErr(t('productCoverTooLarge'))
      else if (code === 'not_image' || code === 'decode_failed') setCoverErr(t('productCoverBadType'))
      else setCoverErr(t('productCoverFail'))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function clearCover(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (readOnly) return
    setCoverErr('')
    onChange({ coverDataUrl: null, coverPath: null })
  }

  return (
    <div className="product-tab-desc">
      <div className="product-cover-wrap">
        <input
          id={inputId}
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/*"
          className="sr-only"
          disabled={readOnly || busy}
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <label
          htmlFor={readOnly ? undefined : inputId}
          className={`product-cover${busy ? ' is-busy' : ''}${readOnly ? ' is-readonly' : ''}`}
          aria-label={t('productCoverPick')}
        >
          {cover ? (
            <img src={cover} alt="" />
          ) : (
            <span className="product-cover-fallback">
              <span className="product-cover-init">{initials(draft.name || 'P')}</span>
              <span className="muted">
                <ImageSquare size={16} weight="regular" aria-hidden />{' '}
                {busy ? t('productCoverLoading') : t('productCoverPick')}
              </span>
            </span>
          )}
        </label>
        {cover && !readOnly ? (
          <button type="button" className="btn product-cover-clear" onClick={clearCover}>
            {t('productCoverClear')}
          </button>
        ) : null}
        {coverErr ? (
          <p className="product-cover-err" role="alert">
            {coverErr}
          </p>
        ) : null}
      </div>

      <div className="product-desc-fields">
        <label className="product-field">
          <span className="label">{t('name')}</span>
          <input
            className="input"
            value={draft.name}
            disabled={readOnly}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder={t('productNamePh')}
          />
        </label>

        <label className="product-field product-field-grow">
          <span className="label">{t('productDescription')}</span>
          <textarea
            className="textarea"
            rows={5}
            value={draft.description}
            disabled={readOnly}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder={t('productDescPh')}
          />
        </label>

        <label className="product-field">
          <span className="label">{t('productMarket')}</span>
          <select
            className="input"
            value={draft.market}
            disabled={readOnly}
            onChange={(e) => onChange({ market: e.target.value === 'b2c' ? 'b2c' : 'b2b' })}
          >
            <option value="b2b">{t('productMarketB2b')}</option>
            <option value="b2c">{t('productMarketB2c')}</option>
          </select>
        </label>
      </div>
    </div>
  )
}
