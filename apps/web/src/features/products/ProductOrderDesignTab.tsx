/**
 * ProductOrderDesignTab — Auftragsgestaltung: title + content blocks, save to API.
 * Location: apps/web/src/features/products/ProductOrderDesignTab.tsx
 */
import { useCallback, useEffect, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  CheckCircle,
  Plus,
  TextT,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react'
import { isOrderTemplateReady, type OrderTemplateBlock } from '@bu2/shared'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'

type Props = {
  slug: string
  productId: string | null
  readOnly?: boolean
}

function newBlock(type: OrderTemplateBlock['type']): OrderTemplateBlock {
  return { id: crypto.randomUUID(), type, body: '' }
}

export function ProductOrderDesignTab({ slug, productId, readOnly }: Props) {
  const { t } = useI18n()
  const [title, setTitle] = useState('')
  const [blocks, setBlocks] = useState<OrderTemplateBlock[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [savedReady, setSavedReady] = useState(false)

  const load = useCallback(async () => {
    if (!slug || !productId) return
    setLoading(true)
    setErr('')
    try {
      const r = await api<{
        template: {
          title: string
          blocks: OrderTemplateBlock[]
          ready: boolean
        }
      }>(`/api/b/${slug}/products/${productId}/order-template`)
      setTitle(r.template.title || '')
      setBlocks(Array.isArray(r.template.blocks) ? r.template.blocks : [])
      setSavedReady(Boolean(r.template.ready))
    } catch (e) {
      setErr((e as Error).message || t('errorGeneric'))
    } finally {
      setLoading(false)
    }
  }, [slug, productId, t])

  useEffect(() => {
    void load()
  }, [load])

  const draftReady = isOrderTemplateReady({ title, blocks })

  async function save() {
    if (!slug || !productId || readOnly) return
    setSaving(true)
    setErr('')
    try {
      const r = await api<{
        template: { title: string; blocks: OrderTemplateBlock[]; ready: boolean }
      }>(`/api/b/${slug}/products/${productId}/order-template`, {
        method: 'PUT',
        body: JSON.stringify({ title, blocks }),
      })
      setTitle(r.template.title || '')
      setBlocks(Array.isArray(r.template.blocks) ? r.template.blocks : [])
      setSavedReady(Boolean(r.template.ready))
    } catch (e) {
      setErr((e as Error).message || t('errorGeneric'))
    } finally {
      setSaving(false)
    }
  }

  function updateBlock(id: string, patch: Partial<OrderTemplateBlock>) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  }

  function moveBlock(id: string, dir: -1 | 1) {
    setBlocks((prev) => {
      const i = prev.findIndex((b) => b.id === id)
      if (i < 0) return prev
      const j = i + dir
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      const tmp = next[i]!
      next[i] = next[j]!
      next[j] = tmp
      return next
    })
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id))
  }

  if (!productId) {
    return (
      <div className="product-order-design-tab stack">
        <div className="customer-empty-block product-order-design-empty">
          <TextT size={28} weight="regular" aria-hidden />
          <p className="muted" style={{ margin: 0 }}>
            {t('productOrderDesignSaveProductFirst')}
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="product-order-design-tab stack">
        <p className="muted">{t('loading')}</p>
      </div>
    )
  }

  return (
    <div className="product-order-design-tab stack">
      <div
        className={`product-order-ready-banner${savedReady ? ' is-ready' : ''}`}
        role="status"
      >
        {savedReady ? (
          <>
            <CheckCircle size={16} weight="fill" aria-hidden />
            <span>{t('productOrderDesignReady')}</span>
          </>
        ) : (
          <>
            <WarningCircle size={16} weight="fill" aria-hidden />
            <span>{t('productOrderDesignNotReady')}</span>
          </>
        )}
      </div>

      <label className="field">
        <span className="label">{t('productOrderDesignTitle')}</span>
        <input
          className="input"
          value={title}
          disabled={readOnly}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('productOrderDesignTitlePh')}
          maxLength={200}
        />
      </label>

      <div className="product-order-blocks">
        <div className="product-order-blocks-head">
          <strong>{t('productOrderDesignBlocks')}</strong>
          {!readOnly ? (
            <div className="product-order-blocks-add">
              <button
                type="button"
                className="btn"
                onClick={() => setBlocks((p) => [...p, newBlock('heading')])}
              >
                <Plus size={14} weight="bold" aria-hidden />
                {t('productOrderBlockHeading')}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setBlocks((p) => [...p, newBlock('text')])}
              >
                <Plus size={14} weight="bold" aria-hidden />
                {t('productOrderBlockText')}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setBlocks((p) => [...p, newBlock('divider')])}
              >
                <Plus size={14} weight="bold" aria-hidden />
                {t('productOrderBlockDivider')}
              </button>
            </div>
          ) : null}
        </div>

        {blocks.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {t('productOrderDesignBlocksEmpty')}
          </p>
        ) : (
          <ul className="product-order-block-list">
            {blocks.map((b, idx) => (
              <li key={b.id} className="product-order-block panel">
                <div className="product-order-block-toolbar">
                  <span className="muted product-order-block-type">
                    {b.type === 'heading'
                      ? t('productOrderBlockHeading')
                      : b.type === 'divider'
                        ? t('productOrderBlockDivider')
                        : t('productOrderBlockText')}
                  </span>
                  {!readOnly ? (
                    <div className="product-order-block-actions">
                      <button
                        type="button"
                        className="btn icon-btn"
                        disabled={idx === 0}
                        aria-label={t('productOrderBlockMoveUp')}
                        onClick={() => moveBlock(b.id, -1)}
                      >
                        <ArrowUp size={14} weight="bold" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="btn icon-btn"
                        disabled={idx === blocks.length - 1}
                        aria-label={t('productOrderBlockMoveDown')}
                        onClick={() => moveBlock(b.id, 1)}
                      >
                        <ArrowDown size={14} weight="bold" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="btn icon-btn"
                        aria-label={t('productOrderBlockRemove')}
                        onClick={() => removeBlock(b.id)}
                      >
                        <Trash size={14} weight="bold" aria-hidden />
                      </button>
                    </div>
                  ) : null}
                </div>
                {b.type === 'divider' ? (
                  <hr className="product-order-divider-preview" />
                ) : (
                  <textarea
                    className="input product-order-block-body"
                    rows={b.type === 'heading' ? 2 : 4}
                    value={b.body}
                    disabled={readOnly}
                    onChange={(e) => updateBlock(b.id, { body: e.target.value })}
                    placeholder={
                      b.type === 'heading'
                        ? t('productOrderBlockHeadingPh')
                        : t('productOrderBlockTextPh')
                    }
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {err ? (
        <p className="product-modal-err" role="alert">
          {err}
        </p>
      ) : null}

      {!readOnly ? (
        <div className="product-order-design-actions">
          <button
            type="button"
            className="btn primary"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? t('saving') : t('productOrderDesignSave')}
            {draftReady ? null : (
              <span className="muted" style={{ marginLeft: 8, fontWeight: 400 }}>
                ({t('productOrderDesignSaveHint')})
              </span>
            )}
          </button>
        </div>
      ) : null}
    </div>
  )
}
