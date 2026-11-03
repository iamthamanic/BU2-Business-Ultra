/**
 * ProductShell — Product department: table/card list + create/edit modal.
 * Location: apps/web/src/features/product/ProductShell.tsx
 */
import { useEffect, useMemo, useState } from 'react'
import { useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import {
  MagnifyingGlass,
  Plus,
  SquaresFour,
  Table,
} from '@phosphor-icons/react'
import { ProductModal } from '../../components/product/ProductModal'
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
  const [view, setView] = useState<ViewMode>('cards')
  const [archive, setArchive] = useState<ArchiveMode>('active')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<BuProduct | null>(null)
  const [query, setQuery] = useState('')
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

  return (
    <div className="stack mkt-shell product-shell">
      <header className="product-page-head">
        <div className="product-page-title-row">
          <h1 className="section-title product-page-title">{t('productTitle')}</h1>
          <label className="product-search">
            <MagnifyingGlass size={14} weight="regular" aria-hidden />
            <span className="sr-only">{t('productSearch')}</span>
            <input
              className="input product-search-input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('productSearchPh')}
              autoComplete="off"
            />
          </label>
        </div>
        <div className="product-page-actions">
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
          <div className="product-archive-toggle" role="group" aria-label={t('productArchiveFilter')}>
            <button
              type="button"
              className={`archive-seg archive-seg--active${archive === 'active' ? ' is-on' : ''}`}
              aria-pressed={archive === 'active'}
              onClick={() => setArchive('active')}
            >
              {t('productFilterActive')}
            </button>
            <button
              type="button"
              className={`archive-seg archive-seg--archived${archive === 'archived' ? ' is-on' : ''}`}
              aria-pressed={archive === 'archived'}
              onClick={() => setArchive('archived')}
            >
              {t('productFilterArchived')}
            </button>
          </div>
          {canWrite ? (
            <button type="button" className="btn primary" onClick={openCreate}>
              <Plus size={14} weight="bold" aria-hidden />
              {t('productCreate')}
            </button>
          ) : null}
        </div>
      </header>

      {loading ? (
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
