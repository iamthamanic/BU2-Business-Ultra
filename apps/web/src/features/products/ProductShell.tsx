/**
 * ProductShell — Product department: table/card list + create/edit modal.
 * Location: apps/web/src/features/products/ProductShell.tsx
 */
import { useEffect, useMemo, useState } from 'react'
import { useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import {
  MagnifyingGlass,
  Package,
  Plus,
  Receipt,
  SquaresFour,
  Table,
} from '@phosphor-icons/react'
import { ArchiveSegmentToggle } from '../../components/ArchiveSegmentToggle'
import { ProductModal } from './ProductModal'
import type { CompanyOutletContext } from '../../components/BusinessShell'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { canMutateContent } from '@bu2/shared'
import {
  fmtEur,
  initials,
  type BuProduct,
} from './productTypes'

type ViewMode = 'cards' | 'table'
type ArchiveMode = 'active' | 'archived'
type SurfaceTab = 'products' | 'orders'
type SortKey = 'name' | 'description' | 'market' | 'personas' | 'net' | 'updated'

function sortValue(p: BuProduct, key: SortKey): string | number {
  switch (key) {
    case 'name':
      return p.name.toLowerCase()
    case 'description':
      return (p.description || '').toLowerCase()
    case 'market':
      return p.market === 'b2c' ? 'b2c' : 'b2b'
    case 'personas':
      return p.personaIds?.length || 0
    case 'net':
      return p.netRevenueCents || 0
    case 'updated':
      return new Date(p.updatedAt).getTime() || 0
  }
}

export function ProductShell() {
  const { slug: paramSlug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const ctx = useOutletContext<CompanyOutletContext | null>()
  const slug = paramSlug || ctx?.slug || ''
  const { t, locale } = useI18n()
  const role = ctx?.membership?.role
  const canWrite = role ? canMutateContent(role) : Boolean(ctx?.user?.isSuperadmin)

  const [products, setProducts] = useState<BuProduct[]>([])
  const [personas, setPersonas] = useState<{ id: string; name: string; summary?: string | null }[]>(
    [],
  )
  const [loading, setLoading] = useState(true)
  const [surface, setSurface] = useState<SurfaceTab>('products')
  const [view, setView] = useState<ViewMode>('cards')
  const [archive, setArchive] = useState<ArchiveMode>('active')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<BuProduct | null>(null)
  const [query, setQuery] = useState('')
  const [orderQuery, setOrderQuery] = useState('')
  const [orderNotice, setOrderNotice] = useState('')
  /** Placeholder until orders API exists — keeps search UX honest. */
  const [orders] = useState<Array<{ id: string; title: string; customerName: string }>>([])
  const [sortKey, setSortKey] = useState<SortKey>('updated')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const deepProductId = searchParams.get('product')

  async function refresh() {
    if (!slug) return
    setLoading(true)
    try {
      const [p, pe] = await Promise.all([
        api<{ products: BuProduct[] }>(
          `/api/b/${slug}/products?archive=${archive === 'archived' ? '1' : '0'}`,
        ),
        api<{ personas: { id: string; name: string; summary?: string | null }[] }>(
          `/api/b/${slug}/personas`,
        ).catch(() => ({ personas: [] })),
      ])
      setProducts(p.products)
      setPersonas(pe.personas)
      return p.products
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    refresh()
      .then(async (list) => {
        if (cancelled || !deepProductId || !slug) return
        const hit = (list || []).find((p) => p.id === deepProductId)
        if (hit) {
          setEditing(hit)
          setModalOpen(true)
          return
        }
        // Deep link may point at an archived product while filter is "active"
        const wantArchived = archive !== 'archived'
        const other = await api<{ products: BuProduct[] }>(
          `/api/b/${slug}/products?archive=${wantArchived ? '1' : '0'}`,
        ).catch(() => ({ products: [] as BuProduct[] }))
        if (cancelled) return
        const found = other.products.find((p) => p.id === deepProductId)
        if (found) setArchive(wantArchived ? 'archived' : 'active')
      })
      .catch(console.error)
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, archive, deepProductId])

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'de-DE', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [locale],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) => {
      const hay = [
        p.name,
        p.description,
        p.market,
        p.market === 'b2c' ? 'b2c' : 'b2b',
        String(p.personaIds?.length || 0),
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [products, query])

  const filteredOrders = useMemo(() => {
    const q = orderQuery.trim().toLowerCase()
    if (!q) return orders
    return orders.filter((o) => {
      const hay = [o.title, o.customerName].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [orders, orderQuery])

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = sortValue(a, sortKey)
      const bv = sortValue(b, sortKey)
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return a.name.localeCompare(b.name) * dir
    })
  }, [filtered, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir(key === 'name' || key === 'description' || key === 'market' ? 'asc' : 'desc')
  }

  const tableCols = useMemo(
    () =>
      [
        { key: 'name' as const, label: t('name') },
        { key: 'description' as const, label: t('productDescription') },
        { key: 'market' as const, label: t('productMarket') },
        { key: 'personas' as const, label: t('productPersonasCol') },
        { key: 'net' as const, label: t('productNetProceeds') },
        { key: 'updated' as const, label: t('productUpdated') },
      ] as const,
    [t],
  )

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(p: BuProduct) {
    setEditing(p)
    setModalOpen(true)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('product', p.id)
        return next
      },
      { replace: true },
    )
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('product')
        return next
      },
      { replace: true },
    )
  }

  function onSaved(p: BuProduct) {
    setProducts((prev) => {
      const i = prev.findIndex((x) => x.id === p.id)
      if (i < 0) return archive === 'active' ? [p, ...prev] : prev
      const next = [...prev]
      next[i] = p
      return next
    })
  }

  function onArchived(p: BuProduct) {
    setProducts((prev) => prev.filter((x) => x.id !== p.id))
  }

  const onProducts = surface === 'products'

  function openCreateOrder() {
    setOrderNotice(t('productOrderCreateSoon'))
  }

  return (
    <div className="stack mkt-shell product-shell">
      <header className="product-page-head">
        <div className="product-page-title-row">
          <h1 className="section-title product-page-title">
            {onProducts ? t('productTitle') : t('productScopeOrders')}
          </h1>
          <label className="product-search">
            <MagnifyingGlass size={14} weight="regular" aria-hidden />
            <span className="sr-only">
              {onProducts ? t('productSearch') : t('productOrdersSearch')}
            </span>
            <input
              className="input product-search-input"
              type="search"
              value={onProducts ? query : orderQuery}
              onChange={(e) =>
                onProducts ? setQuery(e.target.value) : setOrderQuery(e.target.value)
              }
              placeholder={onProducts ? t('productSearchPh') : t('productOrdersSearchPh')}
              autoComplete="off"
            />
          </label>
        </div>
        <div className="product-page-actions">
          {onProducts ? (
            <>
              <div className="product-view-toggle" role="group" aria-label={t('productViewMode')}>
                <button
                  type="button"
                  className={`btn icon-btn${view === 'cards' ? ' is-active' : ''}`}
                  aria-pressed={view === 'cards'}
                  onClick={() => setView('cards')}
                  title={t('productViewCards')}
                >
                  <SquaresFour size={16} weight="regular" aria-hidden />
                </button>
                <button
                  type="button"
                  className={`btn icon-btn${view === 'table' ? ' is-active' : ''}`}
                  aria-pressed={view === 'table'}
                  onClick={() => setView('table')}
                  title={t('productViewTable')}
                >
                  <Table size={16} weight="regular" aria-hidden />
                </button>
              </div>
              <ArchiveSegmentToggle
                label={t('productArchiveFilter')}
                value={archive}
                onChange={setArchive}
                options={[
                  { value: 'active', label: t('productFilterActive'), tone: 'active' },
                  { value: 'archived', label: t('productFilterArchived'), tone: 'archived' },
                ]}
              />
              {canWrite ? (
                <button type="button" className="btn primary" onClick={openCreate}>
                  <Plus size={14} weight="bold" aria-hidden />
                  {t('productCreate')}
                </button>
              ) : null}
            </>
          ) : canWrite ? (
            <button type="button" className="btn primary" onClick={openCreateOrder}>
              <Plus size={14} weight="bold" aria-hidden />
              {t('productOrderCreate')}
            </button>
          ) : null}
        </div>
      </header>

      <div className="product-dept-tabs" role="tablist" aria-label={t('product')}>
        <button
          type="button"
          role="tab"
          aria-selected={onProducts}
          className={`product-dept-tab${onProducts ? ' is-on' : ''}`}
          onClick={() => {
            setSurface('products')
            setOrderNotice('')
          }}
        >
          <Package size={16} weight={onProducts ? 'bold' : 'regular'} aria-hidden />
          <span>{t('productScopeProducts')}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!onProducts}
          className={`product-dept-tab${!onProducts ? ' is-on' : ''}`}
          onClick={() => setSurface('orders')}
        >
          <Receipt size={16} weight={!onProducts ? 'bold' : 'regular'} aria-hidden />
          <span>{t('productScopeOrders')}</span>
        </button>
      </div>

      {onProducts ? (
        loading ? (
          <p className="muted">{t('loading')}</p>
        ) : products.length === 0 ? (
          <div className="panel product-empty">
            <p className="muted">{t('productEmpty')}</p>
            {canWrite && archive === 'active' ? (
              <button type="button" className="btn primary" onClick={openCreate}>
                <Plus size={14} weight="bold" aria-hidden />
                {t('productCreate')}
              </button>
            ) : null}
          </div>
        ) : filtered.length === 0 ? (
          <div className="panel product-empty">
            <p className="muted">{t('productSearchEmpty')}</p>
          </div>
        ) : view === 'cards' ? (
          <div className="product-card-grid">
            {sorted.map((p) => (
              <button
                key={p.id}
                type="button"
                className="panel product-card"
                onClick={() => openEdit(p)}
              >
                <div className="product-card-top">
                  {p.coverPath ? (
                    <img className="product-card-thumb" src={p.coverPath} alt="" />
                  ) : (
                    <span className="product-card-av" aria-hidden>
                      {initials(p.name)}
                    </span>
                  )}
                  <span className="muted product-card-meta">
                    {initials(p.name)} · {p.market === 'b2c' ? 'B2C' : 'B2B'}
                  </span>
                </div>
                <strong className="product-card-name">{p.name}</strong>
                <p className="muted product-card-desc">{p.description}</p>
                <div className="product-card-foot">
                  <span className="product-card-net kpi">{fmtEur(p.netRevenueCents)}</span>
                  <span className="muted">
                    {t('productPersonaCount').replace('{n}', String(p.personaIds?.length || 0))}
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="panel funnel-table-wrap">
            <table className="table funnel-grid-table product-table">
              <thead>
                <tr>
                  {tableCols.map((c) => {
                    const active = sortKey === c.key
                    return (
                      <th
                        key={c.key}
                        className={`funnel-th-sortable${active ? ' is-sorted' : ''}`}
                        aria-sort={
                          active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
                        }
                      >
                        <button
                          type="button"
                          className="funnel-th-btn"
                          onClick={() => toggleSort(c.key)}
                        >
                          <span>{c.label}</span>
                          <span className="funnel-th-dir" aria-hidden>
                            {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                          </span>
                        </button>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => (
                  <tr key={p.id} className="product-table-row" onClick={() => openEdit(p)}>
                    <td>
                      <span className="product-table-name">
                        {p.coverPath ? (
                          <img className="product-table-thumb" src={p.coverPath} alt="" />
                        ) : (
                          <span className="product-table-av" aria-hidden>
                            {initials(p.name)}
                          </span>
                        )}
                        <strong>{p.name}</strong>
                      </span>
                    </td>
                    <td className="product-table-desc">{p.description}</td>
                    <td>{p.market === 'b2c' ? 'B2C' : 'B2B'}</td>
                    <td className="num">{p.personaIds?.length || 0}</td>
                    <td className="num kpi">{fmtEur(p.netRevenueCents)}</td>
                    <td className="num muted">{dateFmt.format(new Date(p.updatedAt))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : orders.length === 0 ? (
        <div className="panel product-empty product-orders-empty">
          <Receipt size={28} weight="regular" aria-hidden />
          <p className="muted" style={{ margin: 0 }}>
            {orderNotice || t('productOrdersEmpty')}
          </p>
          {canWrite ? (
            <button type="button" className="btn primary" onClick={openCreateOrder}>
              <Plus size={14} weight="bold" aria-hidden />
              {t('productOrderCreate')}
            </button>
          ) : null}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="panel product-empty product-orders-empty">
          <p className="muted" style={{ margin: 0 }}>
            {t('productOrdersSearchEmpty')}
          </p>
        </div>
      ) : (
        <div className="panel funnel-table-wrap">
          <table className="table funnel-grid-table product-table">
            <thead>
              <tr>
                <th>{t('name')}</th>
                <th>{t('customer')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => (
                <tr key={o.id} className="product-table-row">
                  <td>
                    <strong>{o.title}</strong>
                  </td>
                  <td className="muted">{o.customerName || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProductModal
        open={modalOpen}
        mode={editing ? 'edit' : 'create'}
        product={editing}
        slug={slug}
        canWrite={canWrite}
        personas={personas}
        onClose={closeModal}
        onSaved={onSaved}
        onArchived={onArchived}
        onPersonaCreated={(p) =>
          setPersonas((prev) => (prev.some((x) => x.id === p.id) ? prev : [p, ...prev]))
        }
      />
    </div>
  )
}
