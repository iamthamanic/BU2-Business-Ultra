/**
 * CustomerShell — CRM list aligned to Product Dark-Ops chrome (toolbar, empty, table).
 * Location: apps/web/src/features/customer/CustomerShell.tsx
 */
import { useEffect, useMemo, useState } from 'react'
import { Outlet, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import {
  ArrowRight,
  Handshake,
  MagnifyingGlass,
  Plus,
  SealCheck,
  UserPlus,
} from '@phosphor-icons/react'
import { canMutateContent } from '@bu2/shared'
import type { CompanyOutletContext } from '../../components/BusinessShell'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import type { MessageKey } from '../../i18n/messages'
import { companyRoutes } from '../../lib/companyPaths'
import { CrmEmptyPreview } from '../../components/CrmEmptyPreview'
import { CustomerCreateModal } from './CustomerCreateModal'
import type { BuCustomer } from './customerTypes'

export type CustomerOutletContext = CompanyOutletContext & {
  slug: string
  canWrite: boolean
  refreshList: () => Promise<void>
}

type SortKey = 'name' | 'status' | 'email' | 'phone' | 'tags'
type TFn = (k: MessageKey) => string

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

function sortValue(c: BuCustomer, key: SortKey): string {
  if (key === 'name') return c.displayName.toLowerCase()
  if (key === 'status') return c.relationStatus.toLowerCase()
  if (key === 'email') return (c.email || '').toLowerCase()
  if (key === 'phone') return (c.phone || '').toLowerCase()
  return (c.tags || []).join(', ').toLowerCase()
}

export function CustomerShell() {
  const { slug: paramSlug, id } = useParams()
  const ctx = useOutletContext<CompanyOutletContext | null>()
  const slug = paramSlug || ctx?.slug || ''
  const { t } = useI18n()
  const navigate = useNavigate()
  const role = ctx?.membership?.role
  const canWrite = role ? canMutateContent(role) : Boolean(ctx?.user?.isSuperadmin)
  const routes = companyRoutes(slug)

  const [customers, setCustomers] = useState<BuCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [archive, setArchive] = useState<'active' | 'archived'>('active')
  const [createOpen, setCreateOpen] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  async function refresh() {
    if (!slug) return
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      qs.set('archive', archive === 'archived' ? '1' : '0')
      if (status) qs.set('status', status)
      const r = await api<{ customers: BuCustomer[] }>(`/api/b/${slug}/customers?${qs}`)
      setCustomers(r.customers)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh().catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, archive, status])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return customers
    return customers.filter(
      (c) =>
        c.displayName.toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q) ||
        (c.tags || []).some((tag) => tag.toLowerCase().includes(q)),
    )
  }, [customers, query])

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = sortValue(a, sortKey)
      const bv = sortValue(b, sortKey)
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return a.displayName.localeCompare(b.displayName) * dir
    })
  }, [filtered, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir('asc')
  }

  const tableCols = useMemo(
    () =>
      [
        { key: 'name' as const, label: t('name') },
        { key: 'status' as const, label: t('customerStatus') },
        { key: 'email' as const, label: t('email') },
        { key: 'phone' as const, label: t('customerPhone') },
        { key: 'tags' as const, label: t('customerTags') },
      ] as const,
    [t],
  )

  if (id) {
    const outlet: CustomerOutletContext = {
      slug,
      user: ctx!.user,
      membership: ctx?.membership ?? null,
      canWrite,
      refreshList: refresh,
    }
    return <Outlet context={outlet} />
  }

  const showGhost = sorted.length === 0 && !loading

  function renderSortableHead() {
    return (
      <thead>
        <tr>
          {tableCols.map((col) => {
            const active = sortKey === col.key
            return (
              <th
                key={col.key}
                className={`funnel-th-sortable${active ? ' is-sorted' : ''}`}
                aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <button
                  type="button"
                  className="funnel-th-btn"
                  onClick={() => toggleSort(col.key)}
                >
                  <span>{col.label}</span>
                  <span className="funnel-th-dir" aria-hidden>
                    {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                  </span>
                </button>
              </th>
            )
          })}
          <th className="crm-col-open">
            <span className="sr-only">{t('open')}</span>
          </th>
        </tr>
      </thead>
    )
  }

  return (
    <div className="stack mkt-shell product-shell crm-shell">
      <header className="product-page-head">
        <div className="product-page-title-row">
          <h1 className="section-title product-page-title">{t('customer')}</h1>
          <label className="product-search">
            <MagnifyingGlass size={14} weight="regular" aria-hidden />
            <span className="sr-only">{t('customerSearch')}</span>
            <input
              className="input product-search-input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('customerSearch')}
              autoComplete="off"
            />
          </label>
        </div>
        <div className="product-page-actions">
          <label className="crm-filter-select">
            <span className="sr-only">{t('customerStatus')}</span>
            <select
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">{t('customerFilterAll')}</option>
              <option value="lead">{t('customerStatusLead')}</option>
              <option value="customer">{t('customerStatusCustomer')}</option>
            </select>
          </label>
          <div className="product-archive-toggle" role="group" aria-label={t('archived')}>
            <button
              type="button"
              className={`archive-seg${archive === 'active' ? ' is-on' : ''}`}
              aria-pressed={archive === 'active'}
              onClick={() => setArchive('active')}
            >
              {t('active')}
            </button>
            <button
              type="button"
              className={`archive-seg${archive === 'archived' ? ' is-on' : ''}`}
              aria-pressed={archive === 'archived'}
              onClick={() => setArchive('archived')}
            >
              {t('archived')}
            </button>
          </div>
          {canWrite ? (
            <button type="button" className="btn primary" onClick={() => setCreateOpen(true)}>
              <Plus size={14} weight="bold" aria-hidden />
              {t('customerCreate')}
            </button>
          ) : null}
        </div>
      </header>

      {showGhost ? (
        <CrmEmptyPreview
          canWrite={canWrite && archive === 'active' && customers.length === 0}
          ctaLabel={t('customerCreateFirst')}
          hint={customers.length === 0 ? t('customerEmptyHint') : t('customerSearchEmpty')}
          onCta={() => setCreateOpen(true)}
        >
          <table className="table funnel-grid-table product-table">
            {renderSortableHead()}
            <tbody>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="crm-empty-row" aria-hidden>
                  <td colSpan={6}>&nbsp;</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CrmEmptyPreview>
      ) : (
        <div className="panel funnel-table-wrap">
          <table className="table funnel-grid-table product-table">
            {renderSortableHead()}
            <tbody>
              {sorted.map((c) => (
                <tr
                  key={c.id}
                  className="product-table-row"
                  onClick={() => navigate(`${routes.customer}/${c.id}`)}
                >
                  <td>
                    <span className="product-table-name">
                      <span className="product-table-av" aria-hidden>
                        {initials(c.displayName)}
                      </span>
                      <span>
                        <strong>{c.displayName}</strong>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {c.kind === 'org' ? t('customerKindOrg') : t('customerKindPerson')}
                        </div>
                      </span>
                    </span>
                  </td>
                  <td>
                    <span className={`crm-status crm-status--${c.relationStatus}`}>
                      {statusIcon(c.relationStatus)}
                      {statusLabel(c.relationStatus, t)}
                    </span>
                  </td>
                  <td className="muted">{c.email || '—'}</td>
                  <td className="muted">{c.phone || '—'}</td>
                  <td>
                    {(c.tags || []).length ? (
                      <span className="crm-tag-row">
                        {c.tags.slice(0, 4).map((tag) => (
                          <span key={tag} className="crm-tag">
                            {tag}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="crm-col-open">
                    <span className="crm-row-open" aria-hidden>
                      <ArrowRight size={14} weight="bold" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CustomerCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={async (body) => {
          const r = await api<{ customer: BuCustomer }>(`/api/b/${slug}/customers`, {
            method: 'POST',
            body: JSON.stringify(body),
          })
          await refresh()
          navigate(`${routes.customer}/${r.customer.id}`)
        }}
      />
    </div>
  )
}

function statusLabel(s: string, t: TFn) {
  if (s === 'prospect') return t('customerStatusProspect')
  if (s === 'customer') return t('customerStatusCustomer')
  return t('customerStatusLead')
}

function statusIcon(s: string) {
  if (s === 'prospect') return <Handshake size={12} weight="regular" aria-hidden />
  if (s === 'customer') return <SealCheck size={12} weight="regular" aria-hidden />
  return <UserPlus size={12} weight="regular" aria-hidden />
}
