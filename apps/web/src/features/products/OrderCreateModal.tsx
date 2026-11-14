/**
 * OrderCreateModal — create a product order (customer + amount) with template gate.
 * Location: apps/web/src/features/products/OrderCreateModal.tsx
 */
import { useEffect, useId, useState } from 'react'
import { X } from '@phosphor-icons/react'
import { ApiError, api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { fmtEur, type BuProduct } from './productTypes'
import type { BuProductOrder } from './orderTypes'

type CustomerOpt = { id: string; displayName: string }

type Props = {
  open: boolean
  slug: string
  /** Prefill when opened from a specific product context. */
  defaultProductId?: string | null
  onClose: () => void
  onCreated: (order: BuProductOrder) => void
  /** Open product → Auftragsgestaltung when template gate blocks create. */
  onOpenOrderDesign: (productId: string) => void
}

export function OrderCreateModal({
  open,
  slug,
  defaultProductId,
  onClose,
  onCreated,
  onOpenOrderDesign,
}: Props) {
  const { t } = useI18n()
  const titleId = useId()
  const [productId, setProductId] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [amountEur, setAmountEur] = useState('0.00')
  const [notes, setNotes] = useState('')
  const [products, setProducts] = useState<BuProduct[]>([])
  const [customers, setCustomers] = useState<CustomerOpt[]>([])
  const [templateReady, setTemplateReady] = useState(false)
  const [checkingTemplate, setCheckingTemplate] = useState(false)
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open || !slug) return
    let cancelled = false
    setLoadingMeta(true)
    setCustomerId('')
    setNotes('')
    setErr('')
    setSaving(false)
    Promise.all([
      api<{ products: BuProduct[] }>(`/api/b/${slug}/products?archive=0`),
      api<{ customers: CustomerOpt[] }>(`/api/b/${slug}/customers?role=customer&archive=0`).catch(
        () => ({ customers: [] as CustomerOpt[] }),
      ),
    ])
      .then(([p, c]) => {
        if (cancelled) return
        const list = (p.products || []).filter((x) => !x.archivedAt)
        setProducts(list)
        setCustomers(c.customers || [])
        const pre =
          defaultProductId && list.some((x) => x.id === defaultProductId)
            ? defaultProductId
            : list[0]?.id || ''
        setProductId(pre)
        const hit = list.find((x) => x.id === pre)
        setAmountEur(((hit?.netRevenueCents || 0) / 100).toFixed(2))
      })
      .catch(() => {
        if (cancelled) return
        setProducts([])
        setCustomers([])
        setProductId('')
      })
      .finally(() => {
        if (!cancelled) setLoadingMeta(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, slug, defaultProductId])

  useEffect(() => {
    if (!open || !slug || !productId) {
      setTemplateReady(false)
      return
    }
    let cancelled = false
    setCheckingTemplate(true)
    api<{ template: { ready: boolean } }>(`/api/b/${slug}/products/${productId}/order-template`)
      .then((r) => {
        if (!cancelled) setTemplateReady(Boolean(r.template.ready))
      })
      .catch(() => {
        if (!cancelled) setTemplateReady(false)
      })
      .finally(() => {
        if (!cancelled) setCheckingTemplate(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, slug, productId])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  function onProductChange(id: string) {
    setProductId(id)
    const p = products.find((x) => x.id === id)
    setAmountEur(((p?.netRevenueCents || 0) / 100).toFixed(2))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!productId) {
      setErr(t('productOrderErrProduct'))
      return
    }
    if (!customerId) {
      setErr(t('productOrderErrCustomer'))
      return
    }
    if (!templateReady) {
      setErr(t('productOrderErrTemplate'))
      return
    }
    const amountCents = Math.max(0, Math.round(parseFloat(amountEur || '0') * 100) || 0)
    setSaving(true)
    setErr('')
    try {
      const r = await api<{ order: BuProductOrder }>(`/api/b/${slug}/orders`, {
        method: 'POST',
        body: JSON.stringify({
          productId,
          customerId,
          amountCents,
          notes: notes.trim() || null,
        }),
      })
      onCreated(r.order)
      onClose()
    } catch (ex) {
      if (ex instanceof ApiError && ex.message === 'template_not_ready') {
        setErr(t('productOrderErrTemplate'))
        setTemplateReady(false)
      } else {
        setErr(ex instanceof Error ? ex.message : t('errorGeneric'))
      }
    } finally {
      setSaving(false)
    }
  }

  const canSubmit =
    Boolean(productId && customerId && templateReady) && !saving && !checkingTemplate

  return (
    <div className="bu-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="bu-modal panel crm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="bu-modal-head">
          <h2 id={titleId}>{t('productOrderCreateTitle')}</h2>
          <button type="button" className="btn icon-btn" onClick={onClose} aria-label={t('closeMenu')}>
            <X size={16} weight="bold" aria-hidden />
          </button>
        </header>

        <form className="stack" onSubmit={(e) => void submit(e)}>
          {loadingMeta ? (
            <p className="muted">{t('loading')}</p>
          ) : (
            <>
              {products.length === 0 ? (
                <p className="muted">{t('productOrderCreateNoProducts')}</p>
              ) : (
                <label className="field">
                  <span className="label">{t('productOrderCreateProduct')}</span>
                  <select
                    className="input"
                    value={productId}
                    onChange={(e) => onProductChange(e.target.value)}
                  >
                    <option value="">{t('productOrderCreateProductPh')}</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {fmtEur(p.netRevenueCents)}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {customers.length === 0 ? (
                <p className="muted">{t('productOrderCreateNoCustomers')}</p>
              ) : (
                <label className="field">
                  <span className="label">{t('productOrderCreateCustomer')}</span>
                  <select
                    className="input"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                  >
                    <option value="">{t('productOrderCreateCustomerPh')}</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.displayName}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          )}

          <label className="field">
            <span className="label">{t('productOrderCreateAmount')}</span>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={amountEur}
              onChange={(e) => setAmountEur(e.target.value)}
            />
          </label>

          <label className="field">
            <span className="label">{t('productOrderCreateNotes')}</span>
            <textarea
              className="input"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={4000}
            />
          </label>

          {productId && !checkingTemplate && !templateReady ? (
            <div className="product-order-ready-banner" role="status">
              <span>{t('productOrderCreateNeedTemplate')}</span>
              <button
                type="button"
                className="btn"
                onClick={() => onOpenOrderDesign(productId)}
              >
                {t('productOrderCreateOpenDesign')}
              </button>
            </div>
          ) : null}

          {err ? (
            <p className="product-modal-err" role="alert">
              {err}
            </p>
          ) : null}

          <div className="bu-modal-actions">
            <button type="button" className="btn" disabled={saving} onClick={onClose}>
              {t('cancel')}
            </button>
            <button type="submit" className="btn primary" disabled={!canSubmit}>
              {saving ? t('saving') : t('productOrderCreateSubmit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
