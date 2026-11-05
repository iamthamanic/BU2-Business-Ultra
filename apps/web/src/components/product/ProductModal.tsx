/**
 * ProductModal — Create/edit product with tabs:
 * Beschreibung | Kalkulation | Buyer Persona | Customer Journey | Auftragsgestaltung.
 * Location: apps/web/src/components/product/ProductModal.tsx
 */
import { useEffect, useId, useState } from 'react'
import {
  Calculator,
  ImageSquare,
  Path,
  PencilRuler,
  UserFocus,
  X,
  type Icon,
} from '@phosphor-icons/react'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import {
  draftFromProduct,
  emptyDraft,
  type BuProduct,
  type ProductDraft,
} from '../../features/product/productTypes'
import { MktTab } from '../MktTabs'
import { ProductCalcTab } from './ProductCalcTab'
import { ProductDescTab } from './ProductDescTab'
import { ProductOrderDesignTab } from './ProductOrderDesignTab'
import { ProductPersonaTab } from './ProductPersonaTab'

type PersonaRow = { id: string; name: string; summary?: string | null }
type Tab = 'desc' | 'calc' | 'persona' | 'journey' | 'orderDesign'

type Props = {
  open: boolean
  mode: 'create' | 'edit'
  product: BuProduct | null
  slug: string
  canWrite: boolean
  personas: PersonaRow[]
  onClose: () => void
  onSaved: (p: BuProduct) => void
  onArchived?: (p: BuProduct) => void
  onPersonaCreated?: (p: PersonaRow) => void
}

export function ProductModal({
  open,
  mode,
  product,
  slug,
  canWrite,
  personas,
  onClose,
  onSaved,
  onArchived,
  onPersonaCreated,
}: Props) {
  const { t } = useI18n()
  const titleId = useId()
  const [tab, setTab] = useState<Tab>('desc')
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open) return
    setTab('desc')
    setErr('')
    setDraft(product ? draftFromProduct(product) : emptyDraft())
  }, [open, product])

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

  function patch(p: Partial<ProductDraft>) {
    setDraft((d) => ({ ...d, ...p }))
  }

  function validate(): string | null {
    if (!draft.name.trim()) return t('productErrName')
    if (!draft.description.trim()) return t('productErrDesc')
    if (!draft.market) return t('productErrMarket')
    return null
  }

  async function save() {
    const v = validate()
    if (v) {
      setErr(v)
      setTab('desc')
      return
    }
    if (!canWrite) return
    setBusy(true)
    setErr('')
    try {
      const payload = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        market: draft.market,
        coverPath: draft.coverPath,
        currency: draft.currency,
        sellingPriceCents: draft.sellingPriceCents,
        priceKind: draft.priceKind,
        taxRateBps: draft.taxRateBps,
        costPositions: draft.costPositions,
        personaIds: draft.personaIds,
        personaDraft: draft.personaDraft,
        journeyCanvas: draft.journeyCanvas,
      }
      let saved: BuProduct
      if (mode === 'create') {
        const r = await api<{ product: BuProduct }>(`/api/b/${slug}/products`, {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        saved = r.product
      } else {
        const r = await api<{ product: BuProduct }>(`/api/b/${slug}/products/${product!.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
        saved = r.product
      }
      if (draft.coverDataUrl) {
        const r = await api<{ product: BuProduct }>(`/api/b/${slug}/products/${saved.id}/cover`, {
          method: 'POST',
          body: JSON.stringify({ dataUrl: draft.coverDataUrl }),
        })
        saved = r.product
      }
      onSaved(saved)
      onClose()
    } catch (e) {
      setErr(String(e))
    } finally {
      setBusy(false)
    }
  }

  async function archive() {
    if (!product || !canWrite) return
    setBusy(true)
    try {
      const r = await api<{ product: BuProduct }>(`/api/b/${slug}/products/${product.id}/archive`, {
        method: 'POST',
        body: JSON.stringify({ archived: true }),
      })
      onArchived?.(r.product)
      onClose()
    } catch (e) {
      setErr(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="bu-modal-overlay product-modal-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="bu-modal panel product-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="product-modal-head">
          <div className="mkt-tabs mkt-tabs--surface product-modal-tabs" role="tablist">
            {(
              [
                ['desc', 'productTabDesc', ImageSquare, 'product-desc'],
                ['calc', 'productTabCalc', Calculator, 'product-calc'],
                ['persona', 'productTabBuyerPersona', UserFocus, 'product-persona'],
                ['journey', 'productTabJourney', Path, 'product-journey'],
                ['orderDesign', 'productTabOrderDesign', PencilRuler, 'product-order'],
              ] as const satisfies ReadonlyArray<readonly [Tab, string, Icon, string]>
            ).map(([id, key, icon, dataIc]) => (
              <MktTab
                key={id}
                active={tab === id}
                label={t(key)}
                icon={icon}
                dataIc={dataIc}
                onClick={() => setTab(id)}
              />
            ))}
          </div>
          <button type="button" className="btn icon-btn" onClick={onClose} aria-label={t('closeMenu')}>
            <X size={16} weight="bold" aria-hidden />
          </button>
        </header>

        <h2 id={titleId} className="sr-only">
          {mode === 'create' ? t('productCreate') : t('productEdit')}
        </h2>

        <div className="product-modal-body">
          {tab === 'desc' ? (
            <ProductDescTab draft={draft} onChange={patch} readOnly={!canWrite} />
          ) : null}
          {tab === 'calc' ? (
            <ProductCalcTab draft={draft} onChange={patch} readOnly={!canWrite} />
          ) : null}
          {tab === 'persona' || tab === 'journey' ? (
            <ProductPersonaTab
              draft={draft}
              personas={personas}
              onChange={patch}
              readOnly={!canWrite}
              section={tab === 'journey' ? 'journey' : 'persona'}
              slug={slug}
              onPersonaCreated={onPersonaCreated}
            />
          ) : null}
          {tab === 'orderDesign' ? (
            <ProductOrderDesignTab readOnly={!canWrite} />
          ) : null}
        </div>

        {err ? (
          <p className="product-modal-err" role="alert">
            {err}
          </p>
        ) : null}

        <footer className="product-modal-foot">
          <div className="product-modal-foot-left">
            {mode === 'edit' && canWrite && !product?.archivedAt ? (
              <button type="button" className="btn danger" disabled={busy} onClick={archive}>
                {t('productArchive')}
              </button>
            ) : null}
          </div>
          <div className="product-modal-foot-right">
            <button type="button" className="btn" onClick={onClose} disabled={busy}>
              {t('dateRangeCancel')}
            </button>
            {canWrite ? (
              <button type="button" className="btn primary" disabled={busy} onClick={save}>
                {mode === 'create' ? t('productCreate') : t('save')}
              </button>
            ) : null}
          </div>
        </footer>
      </div>
    </div>
  )
}
