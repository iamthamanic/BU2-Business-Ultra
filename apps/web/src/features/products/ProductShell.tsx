/**
 * ProductShell — Product department: table/card list + create/edit modal.
 * Location: apps/web/src/features/products/ProductShell.tsx
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import {
  MagnifyingGlass,
  Package,
  Plus,
  Receipt,
  SquaresFour,
  Table,
} from '@phosphor-icons/react'
import { canMutateContent, type OrderStatus } from '@bu2/shared'
import { ArchiveSegmentToggle } from '../../components/ArchiveSegmentToggle'
import { FunnelExportMenu } from '../../components/FunnelExportMenu'
import { FunnelTip } from '../../components/FunnelTip'
import type { CompanyOutletContext } from '../../components/BusinessShell'
import type { MessageKey } from '../../i18n/messages'
import { api } from '../../lib/api'
import type { FunnelExportPayload } from '../../lib/funnelExport'
import { useI18n } from '../../lib/i18n'
import { usePersistedTableColumns, type TableColumnDef } from '../../lib/tableColumns'
import { OrderCreateModal } from './OrderCreateModal'
import type { BuProductOrder } from './orderTypes'
import { ProductModal } from './ProductModal'
import { fmtEur, initials, type BuProduct } from './productTypes'

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
  const m = ctx?.membership
  const canWrite = m ? canMutateContent({ isOwner: m.isOwner, permissions: m.permissions ?? [] }) : false

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
  const [orders, setOrders] = useState<BuProductOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [orderCreateOpen, setOrderCreateOpen] = useState(false)
  const [orderCreateProductId, setOrderCreateProductId] = useState<string | null>(null)
  const [modalInitialTab, setModalInitialTab] = useState<
    'desc' | 'calc' | 'persona' | 'journey' | 'orderDesign'
  >('desc')
  const [sortKey, setSortKey] = useState<SortKey>('updated')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const deepProductId = searchParams.get('product')
  const deepTab = searchParams.get('tab')

  const productCols: (TableColumnDef & { tip: MessageKey; sortable?: SortKey })[] = useMemo(
    () =>
      (
        [
          {
            key: 'name',
            label: t('name'),
            tip: 'tipProductName' as const,
            locked: true,
            sortable: 'name' as const,
          },
          {
            key: 'description',
            label: t('productDescription'),
            tip: 'tipProductDesc' as const,
            sortable: 'description' as const,
          },
          {
            key: 'market',
            label: t('productMarket'),
            tip: 'tipProductMarket' as const,
            sortable: 'market' as const,
          },
          {
            key: 'personas',
            label: t('productPersonasCol'),
            tip: 'tipProductPersonas' as const,
            sortable: 'personas' as const,
          },
          {
            key: 'net',
            label: t('productNetProceeds'),
            tip: 'tipProductNet' as const,
            sortable: 'net' as const,
          },
          {
            key: 'updated',
            label: t('productUpdated'),
            tip: 'tipProductUpdated' as const,
            sortable: 'updated' as const,
          },
        ] as const
      ).map((c) => ({ ...c, description: t(c.tip) })),
    [t],
  )

  const orderCols: (TableColumnDef & { tip: MessageKey })[] = useMemo(
    () =>
      (
        [
          {
            key: 'orderNumber',
            label: t('productOrderNumber'),
            tip: 'tipProductOrderNumber' as const,
            locked: true,
          },
          { key: 'title', label: t('name'), tip: 'tipProductOrderTitle' as const },
          { key: 'customer', label: t('customer'), tip: 'tipProductOrderCustomer' as const },
          { key: 'status', label: t('status'), tip: 'tipProductOrderStatus' as const },
        ] as const
      ).map((c) => ({ ...c, description: t(c.tip) })),
    [t],
  )

  const productPicker = usePersistedTableColumns({
    slug,
    tableId: 'products',
    columns: productCols,
  })
  const orderPicker = usePersistedTableColumns({
    slug,
    tableId: 'product-orders',
    columns: orderCols,
  })

  async function refreshOrders() {
    if (!slug) return
    setOrdersLoading(true)
    try {
      const q = orderQuery.trim()
      const qs = q ? `?q=${encodeURIComponent(q)}` : ''
      const r = await api<{ orders: BuProductOrder[] }>(`/api/b/${slug}/orders${qs}`)
      setOrders(r.orders || [])
    } catch (e) {
      console.error(e)
      setOrders([])
    } finally {
      setOrdersLoading(false)
    }
  }

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
        const tab =
          deepTab === 'orderDesign' ||
          deepTab === 'calc' ||
          deepTab === 'persona' ||
          deepTab === 'journey' ||
          deepTab === 'desc'
            ? deepTab
            : 'desc'
        const hit = (list || []).find((p) => p.id === deepProductId)
        if (hit) {
          setModalInitialTab(tab)
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
  }, [slug, archive, deepProductId, deepTab])

  useEffect(() => {
    if (!slug || surface !== 'orders') return
    void refreshOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, surface])

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
      const hay = [o.orderNumberLabel, o.title, o.customerName, o.productName, o.status]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [orders, orderQuery])

  function orderStatusLabel(status: OrderStatus): string {
    if (status === 'draft') return t('productOrderStatusDraft')
    if (status === 'done') return t('productOrderStatusDone')
    return t('productOrderStatusOpen')
  }

  async function patchOrderStatus(id: string, status: OrderStatus) {
    if (!slug || !canWrite) return
    try {
      const r = await api<{ order: BuProductOrder }>(`/api/b/${slug}/orders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      setOrders((prev) => prev.map((o) => (o.id === id ? r.order : o)))
    } catch (e) {
      console.error(e)
    }
  }

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

  function getExportPayload(): FunnelExportPayload {
    const today = new Date().toISOString().slice(0, 10)
    if (surface === 'orders') {
      return {
        kind: 'Custom',
        channel: 'orders',
        from: today,
        to: today,
        filters: [
          { label: t('productScopeOrders'), value: t('productScopeOrders') },
          ...(orderQuery.trim()
            ? [{ label: t('productOrdersSearch'), value: orderQuery.trim() }]
            : []),
        ],
        kpis: [{ label: t('productScopeOrders'), value: String(filteredOrders.length) }],
        columns: orderCols.map((c) => ({ key: c.key, label: c.label })),
        rows: filteredOrders.map((o) => ({
          orderNumber: o.orderNumberLabel,
          title: o.title,
          customer: o.customerName,
          status: orderStatusLabel(o.status),
        })),
      }
    }
    return {
      kind: 'Custom',
      channel: 'products',
      from: today,
      to: today,
      filters: [
        {
          label: t('productArchiveFilter'),
          value: archive === 'archived' ? t('productFilterArchived') : t('productFilterActive'),
        },
        ...(query.trim() ? [{ label: t('productSearch'), value: query.trim() }] : []),
      ],
      kpis: [{ label: t('productScopeProducts'), value: String(sorted.length) }],
      columns: productCols.map((c) => ({ key: c.key, label: c.label })),
      rows: sorted.map((p) => ({
        name: p.name,
        description: p.description || '',
        market: p.market === 'b2c' ? 'B2C' : 'B2B',
        personas: p.personaIds?.length || 0,
        net: fmtEur(p.netRevenueCents),
        updated: dateFmt.format(new Date(p.updatedAt)),
      })),
    }
  }

  function openCreate() {
    setModalInitialTab('desc')
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(p: BuProduct, tab: typeof modalInitialTab = 'desc') {
    setModalInitialTab(tab)
    setEditing(p)
    setModalOpen(true)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('product', p.id)
        if (tab === 'orderDesign') next.set('tab', 'orderDesign')
        else next.delete('tab')
        return next
      },
      { replace: true },
    )
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
    setModalInitialTab('desc')
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('product')
        next.delete('tab')
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
  const activePicker = onProducts ? productPicker : orderPicker
  const activeCols = onProducts ? productCols : orderCols

  function openCreateOrder(productId?: string | null) {
    setOrderCreateProductId(productId || null)
    setOrderCreateOpen(true)
  }

  function openOrderDesignFromGate(productId: string) {
    setOrderCreateOpen(false)
    const hit = products.find((p) => p.id === productId)
    if (hit) {
      setSurface('products')
      openEdit(hit, 'orderDesign')
      return
    }
    void api<{ products: BuProduct[] }>(`/api/b/${slug}/products?archive=0`)
      .then((r) => {
        const found = r.products.find((p) => p.id === productId)
        if (found) {
          setSurface('products')
          openEdit(found, 'orderDesign')
        }
      })
      .catch(console.error)
  }

  function renderProductCells(p: BuProduct): ReactNode {
    return productPicker.visibleColumns.map((col) => {
      if (col.key === 'name') {
        return (
          <td key={col.key}>
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
        )
      }
      if (col.key === 'description') {
        return (
          <td key={col.key} className="product-table-desc">
            {p.description}
          </td>
        )
      }
      if (col.key === 'market') {
        return <td key={col.key}>{p.market === 'b2c' ? 'B2C' : 'B2B'}</td>
      }
      if (col.key === 'personas') {
        return (
          <td key={col.key} className="num">
            {p.personaIds?.length || 0}
          </td>
        )
      }
      if (col.key === 'net') {
        return (
          <td key={col.key} className="num kpi">
            {fmtEur(p.netRevenueCents)}
          </td>
        )
      }
      if (col.key === 'updated') {
        return (
          <td key={col.key} className="num muted">
            {dateFmt.format(new Date(p.updatedAt))}
          </td>
        )
      }
      return <td key={col.key}>—</td>
    })
  }

  function renderOrderCells(o: BuProductOrder): ReactNode {
    return orderPicker.visibleColumns.map((col) => {
      if (col.key === 'orderNumber') {
        return (
          <td key={col.key} className="mono muted">
            {o.orderNumberLabel}
          </td>
        )
      }
      if (col.key === 'title') {
        return (
          <td key={col.key}>
            <strong>{o.title}</strong>
          </td>
        )
      }
      if (col.key === 'customer') {
        return (
          <td key={col.key} className="muted">
            {o.customerName || '—'}
          </td>
        )
      }
      if (col.key === 'status') {
        return (
          <td key={col.key} onClick={(e) => e.stopPropagation()}>
            {canWrite ? (
              <select
                className={`input crm-status-select crm-status--${o.status === 'done' ? 'active' : o.status === 'draft' ? 'lead' : 'open'}`}
                value={o.status}
                aria-label={t('status')}
                onChange={(e) => void patchOrderStatus(o.id, e.target.value as OrderStatus)}
              >
                <option value="draft">{t('productOrderStatusDraft')}</option>
                <option value="open">{t('productOrderStatusOpen')}</option>
                <option value="done">{t('productOrderStatusDone')}</option>
              </select>
            ) : (
              <span
                className={`crm-status crm-status--${o.status === 'done' ? 'active' : o.status === 'draft' ? 'lead' : 'open'}`}
              >
                {orderStatusLabel(o.status)}
              </span>
            )}
          </td>
        )
      }
      return <td key={col.key}>—</td>
    })
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
            <button type="button" className="btn primary" onClick={() => openCreateOrder()}>
              <Plus size={14} weight="bold" aria-hidden />
              {t('productOrderCreate')}
            </button>
          ) : null}
        </div>
      </header>

      <div className="product-dept-tabs-row">
        <div className="product-dept-tabs" role="tablist" aria-label={t('product')}>
          <button
            type="button"
            role="tab"
            aria-selected={onProducts}
            className={`product-dept-tab${onProducts ? ' is-on' : ''}`}
            onClick={() => setSurface('products')}
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
        <FunnelExportMenu
          getPayload={getExportPayload}
          columnPicker={{
            columns: activeCols,
            visibleKeys: activePicker.visibleKeys,
            onChange: activePicker.setVisibleKeys,
            onReset: activePicker.reset,
          }}
        />
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
                  {productPicker.visibleColumns.map((c) => {
                    const meta = productCols.find((x) => x.key === c.key)
                    const sortable = meta?.sortable
                    const tip = meta?.tip
                    const active = sortable != null && sortKey === sortable
                    return (
                      <th
                        key={c.key}
                        className={sortable ? `funnel-th-sortable${active ? ' is-sorted' : ''}` : undefined}
                        aria-sort={
                          sortable
                            ? active
                              ? sortDir === 'asc'
                                ? 'ascending'
                                : 'descending'
                              : 'none'
                            : undefined
                        }
                      >
                        {sortable ? (
                          <button
                            type="button"
                            className="funnel-th-btn"
                            onClick={() => toggleSort(sortable)}
                          >
                            <span>{c.label}</span>
                            <span className="funnel-th-dir" aria-hidden>
                              {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                            </span>
                          </button>
                        ) : (
                          <span>{c.label}</span>
                        )}
                        {tip ? (
                          <FunnelTip tip={t(tip)} iconOnly>
                            {c.label}
                          </FunnelTip>
                        ) : null}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => (
                  <tr key={p.id} className="product-table-row" onClick={() => openEdit(p)}>
                    {renderProductCells(p)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : ordersLoading ? (
        <p className="muted">{t('loading')}</p>
      ) : orders.length === 0 ? (
        <div className="panel product-empty product-orders-empty">
          <Receipt size={28} weight="regular" aria-hidden />
          <p className="muted" style={{ margin: 0 }}>
            {t('productOrdersEmpty')}
          </p>
          {canWrite ? (
            <button type="button" className="btn primary" onClick={() => openCreateOrder()}>
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
                {orderPicker.visibleColumns.map((c) => {
                  const tip = orderCols.find((x) => x.key === c.key)?.tip
                  return (
                    <th key={c.key}>
                      <span>{c.label}</span>
                      {tip ? (
                        <FunnelTip tip={t(tip)} iconOnly>
                          {c.label}
                        </FunnelTip>
                      ) : null}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => (
                <tr key={o.id} className="product-table-row">
                  {renderOrderCells(o)}
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
        initialTab={modalInitialTab}
        onClose={closeModal}
        onSaved={onSaved}
        onArchived={onArchived}
        onPersonaCreated={(p) =>
          setPersonas((prev) => (prev.some((x) => x.id === p.id) ? prev : [p, ...prev]))
        }
      />

      <OrderCreateModal
        open={orderCreateOpen}
        slug={slug}
        defaultProductId={orderCreateProductId}
        onClose={() => {
          setOrderCreateOpen(false)
          setOrderCreateProductId(null)
        }}
        onCreated={(order) => {
          setOrders((prev) => [order, ...prev.filter((o) => o.id !== order.id)])
          setSurface('orders')
        }}
        onOpenOrderDesign={openOrderDesignFromGate}
      />
    </div>
  )
}
