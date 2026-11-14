/**
 * CustomerShell — Kontakte list (Kunden / Partner tabs), Dark-Ops chrome.
 * Location: apps/web/src/features/customers/CustomerShell.tsx
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import {
  ArrowRight,
  Handshake,
  MagnifyingGlass,
  Plus,
  SealCheck,
  UserPlus,
  UsersThree,
} from '@phosphor-icons/react'
import { canMutateContent } from '@bu2/shared'
import type { CompanyOutletContext } from '../../components/BusinessShell'
import { FunnelExportMenu } from '../../components/FunnelExportMenu'
import { FunnelTip } from '../../components/FunnelTip'
import { MktTab, MktTabs } from '../../components/MktTabs'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import type { MessageKey } from '../../i18n/messages'
import { companyRoutes } from '../../lib/companyPaths'
import type { FunnelExportPayload } from '../../lib/funnelExport'
import { usePersistedTableColumns, type TableColumnDef } from '../../lib/tableColumns'
import { ArchiveSegmentToggle } from '../../components/ArchiveSegmentToggle'
import { CrmEmptyPreview } from '../../components/CrmEmptyPreview'
import { CrmMultiCheckFilter } from '../../components/CrmMultiCheckFilter'
import { CustomerCreateModal } from './CustomerCreateModal'
import type { BuCustomer } from './customerTypes'

export type CustomerOutletContext = CompanyOutletContext & {
  slug: string
  canWrite: boolean
  refreshList: () => Promise<void>
}

type ContactTab = 'customer' | 'partner'
type SortKey = 'name' | 'status' | 'email' | 'phone' | 'tags'
type TFn = (k: MessageKey) => string

function tabFromPath(pathname: string): ContactTab {
  return /\/partner(?:\/|$)/.test(pathname) ? 'partner' : 'customer'
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

function sortValue(c: BuCustomer, key: SortKey, tab: ContactTab): string {
  if (key === 'name') return c.displayName.toLowerCase()
  if (key === 'status') {
    return tab === 'partner'
      ? (c.partnerStatus || 'active').toLowerCase()
      : c.relationStatus.toLowerCase()
  }
  if (key === 'email') return (c.email || '').toLowerCase()
  if (key === 'phone') return (c.phone || '').toLowerCase()
  return (c.tags || []).join(', ').toLowerCase()
}

function contactStatusText(c: BuCustomer, tab: ContactTab, t: TFn): string {
  if (tab === 'partner') {
    return c.partnerStatus === 'inactive' ? t('partnerStatusInactive') : t('partnerStatusActive')
  }
  return statusLabel(c.relationStatus, t)
}

export function CustomerShell() {
  const { slug: paramSlug, id } = useParams()
  const ctx = useOutletContext<CompanyOutletContext | null>()
  const slug = paramSlug || ctx?.slug || ''
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const m = ctx?.membership
  const canWrite = m ? canMutateContent({ isOwner: m.isOwner, permissions: m.permissions ?? [] }) : false
  const routes = companyRoutes(slug)
  const tab = tabFromPath(location.pathname)
  const listBase = tab === 'partner' ? routes.partner : routes.customer

  const [customers, setCustomers] = useState<BuCustomer[]>([])
  const [labelColors, setLabelColors] = useState<Record<string, string | null>>({})
  const [labelCatalog, setLabelCatalog] = useState<{ name: string; color: string | null }[]>([])
  const [selectedLabels, setSelectedLabels] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [archive, setArchive] = useState<'active' | 'archived'>('active')
  const [createOpen, setCreateOpen] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function selectTab(next: ContactTab) {
    navigate(next === 'partner' ? routes.partner : routes.customer)
  }

  async function refresh() {
    if (!slug) return
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      qs.set('archive', archive === 'archived' ? '1' : '0')
      qs.set('role', tab === 'partner' ? 'partner' : 'customer')
      const [r, labelRes] = await Promise.all([
        api<{ customers: BuCustomer[] }>(`/api/b/${slug}/customers?${qs}`),
        api<{
          labels?: { name: string; color: string | null }[]
          tags?: { name: string; color: string | null }[]
        }>(`/api/b/${slug}/labels?scope=customer`).catch(() => ({
          labels: [] as { name: string; color: string | null }[],
          tags: [] as { name: string; color: string | null }[],
        })),
      ])
      setCustomers(r.customers)
      const catalog = labelRes.labels || labelRes.tags || []
      setLabelCatalog(catalog)
      const map: Record<string, string | null> = {}
      for (const lab of catalog) map[lab.name] = lab.color
      setLabelColors(map)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh().catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, archive, tab])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return customers.filter((c) => {
      if (selectedLabels.length > 0) {
        const tags = c.tags || []
        const hit = selectedLabels.some((lab) => tags.includes(lab))
        if (!hit) return false
      }
      if (!q) return true
      return (
        c.displayName.toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q) ||
        (c.tags || []).some((tag) => tag.toLowerCase().includes(q))
      )
    })
  }, [customers, query, selectedLabels])

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = sortValue(a, sortKey, tab)
      const bv = sortValue(b, sortKey, tab)
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return a.displayName.localeCompare(b.displayName) * dir
    })
  }, [filtered, sortKey, sortDir, tab])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir('asc')
  }

  const cols: (TableColumnDef & { tip: MessageKey; sortable: SortKey })[] = useMemo(
    () =>
      (
        [
          { key: 'name', label: t('name'), tip: 'tipContactName' as const, locked: true, sortable: 'name' as const },
          {
            key: 'status',
            label: t('customerStatus'),
            tip: 'tipContactStatus' as const,
            sortable: 'status' as const,
          },
          { key: 'email', label: t('email'), tip: 'tipContactEmail' as const, sortable: 'email' as const },
          {
            key: 'phone',
            label: t('customerPhone'),
            tip: 'tipContactPhone' as const,
            sortable: 'phone' as const,
          },
          {
            key: 'tags',
            label: t('customerTags'),
            tip: 'tipContactTags' as const,
            sortable: 'tags' as const,
          },
        ] as const
      ).map((c) => ({ ...c, description: t(c.tip) })),
    [t],
  )

  const { visibleKeys, visibleColumns, setVisibleKeys, reset } = usePersistedTableColumns({
    slug,
    tableId: 'contacts',
    columns: cols,
  })

  function getExportPayload(): FunnelExportPayload {
    const today = new Date().toISOString().slice(0, 10)
    return {
      kind: 'Custom',
      channel: tab === 'partner' ? 'partners' : 'customers',
      from: today,
      to: today,
      filters: [
        {
          label: t('contacts'),
          value: tab === 'partner' ? t('contactTabPartners') : t('contactTabCustomers'),
        },
        {
          label: t('archived'),
          value: archive === 'archived' ? t('archived') : t('active'),
        },
        ...(selectedLabels.length
          ? [{ label: t('customerFilterLabels'), value: selectedLabels.join(', ') }]
          : []),
        ...(query.trim() ? [{ label: t('contactSearch'), value: query.trim() }] : []),
      ],
      kpis: [{ label: t('contacts'), value: String(sorted.length) }],
      columns: cols.map((c) => ({ key: c.key, label: c.label })),
      rows: sorted.map((c) => ({
        name: c.displayName,
        status: contactStatusText(c, tab, t),
        email: c.email || '',
        phone: c.phone || '',
        tags: (c.tags || []).join(', '),
      })),
    }
  }

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
  const colSpan = Math.max(visibleColumns.length, 1) + 1

  function renderSortableHead() {
    return (
      <thead>
        <tr>
          {visibleColumns.map((col) => {
            const meta = cols.find((c) => c.key === col.key)
            const sortable = meta?.sortable
            const tip = meta?.tip
            const active = sortable != null && sortKey === sortable
            return (
              <th
                key={col.key}
                className={`funnel-th-sortable${active ? ' is-sorted' : ''}`}
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
                    <span>{col.label}</span>
                    <span className="funnel-th-dir" aria-hidden>
                      {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                    </span>
                  </button>
                ) : (
                  <span>{col.label}</span>
                )}
                {tip ? (
                  <FunnelTip tip={t(tip)} iconOnly>
                    {col.label}
                  </FunnelTip>
                ) : null}
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

  function renderCells(c: BuCustomer): ReactNode {
    return visibleColumns.map((col) => {
      if (col.key === 'name') {
        return (
          <td key={col.key}>
            <span className="product-table-name">
              <span className="product-table-av" aria-hidden>
                {initials(c.displayName)}
              </span>
              <span>
                <strong>{c.displayName}</strong>
                <div className="muted" style={{ fontSize: 12 }}>
                  {c.kind === 'org' ? t('customerKindOrg') : t('customerKindPerson')}
                  {tab === 'partner' && c.partnerCategory ? ` · ${c.partnerCategory}` : ''}
                  {tab === 'customer' && c.customerNumberLabel
                    ? ` · ${c.customerNumberLabel}`
                    : ''}
                  {tab === 'partner' && c.partnerNumberLabel ? ` · ${c.partnerNumberLabel}` : ''}
                </div>
              </span>
            </span>
          </td>
        )
      }
      if (col.key === 'status') {
        return (
          <td key={col.key}>
            {tab === 'partner' ? (
              <span
                className={`crm-status crm-status--${c.partnerStatus === 'inactive' ? 'archived' : 'active'}`}
              >
                {c.partnerStatus === 'inactive'
                  ? t('partnerStatusInactive')
                  : t('partnerStatusActive')}
              </span>
            ) : (
              <span className={`crm-status crm-status--${c.relationStatus}`}>
                {statusIcon(c.relationStatus)}
                {statusLabel(c.relationStatus, t)}
              </span>
            )}
          </td>
        )
      }
      if (col.key === 'email') {
        return (
          <td key={col.key} className="muted">
            {c.email || '—'}
          </td>
        )
      }
      if (col.key === 'phone') {
        return (
          <td key={col.key} className="muted">
            {c.phone || '—'}
          </td>
        )
      }
      if (col.key === 'tags') {
        return (
          <td key={col.key}>
            {(c.tags || []).length ? (
              <span className="crm-tag-row">
                {c.tags.slice(0, 4).map((tag) => {
                  const color = labelColors[tag] || null
                  return (
                    <span
                      key={tag}
                      className="crm-tag"
                      style={
                        color
                          ? {
                              borderColor: `color-mix(in srgb, ${color} 45%, var(--border))`,
                              background: `color-mix(in srgb, ${color} 16%, var(--panel2))`,
                              color,
                            }
                          : undefined
                      }
                    >
                      {tag}
                    </span>
                  )
                })}
              </span>
            ) : (
              <span className="muted">—</span>
            )}
          </td>
        )
      }
      return <td key={col.key}>—</td>
    })
  }

  return (
    <div className="stack mkt-shell product-shell crm-shell">
      <header className="product-page-head">
        <div className="product-page-title-row">
          <h1 className="section-title product-page-title">{t('contacts')}</h1>
          <label className="product-search">
            <MagnifyingGlass size={14} weight="regular" aria-hidden />
            <span className="sr-only">{t('contactSearch')}</span>
            <input
              className="input product-search-input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('contactSearch')}
              autoComplete="off"
            />
          </label>
        </div>
        <div className="product-page-actions">
          <CrmMultiCheckFilter
            options={labelCatalog.map((l) => ({
              value: l.name,
              label: l.name,
              color: l.color,
            }))}
            value={selectedLabels}
            onChange={setSelectedLabels}
            placeholder={t('customerFilterLabels')}
            searchPlaceholder={t('customerFilterLabelsSearch')}
            emptyLabel={t('customerFilterLabelsEmpty')}
            clearLabel={t('customerFilterLabelsClear')}
            aria-label={t('customerFilterLabels')}
          />
          <ArchiveSegmentToggle
            label={t('archived')}
            value={archive}
            onChange={setArchive}
            options={[
              { value: 'active', label: t('active'), tone: 'active' },
              { value: 'archived', label: t('archived'), tone: 'archived' },
            ]}
          />
          {canWrite ? (
            <button type="button" className="btn primary" onClick={() => setCreateOpen(true)}>
              <Plus size={14} weight="bold" aria-hidden />
              {tab === 'partner' ? t('partnerCreate') : t('customerCreate')}
            </button>
          ) : null}
        </div>
      </header>

      <div className="contacts-role-tabs-row">
        <MktTabs level="l2" label={t('contacts')} className="contacts-role-tabs">
          <MktTab
            active={tab === 'customer'}
            label={t('contactTabCustomers')}
            icon={UsersThree}
            onClick={() => selectTab('customer')}
          />
          <MktTab
            active={tab === 'partner'}
            label={t('contactTabPartners')}
            icon={Handshake}
            onClick={() => selectTab('partner')}
          />
        </MktTabs>
        <FunnelExportMenu
          getPayload={getExportPayload}
          columnPicker={{
            columns: cols,
            visibleKeys,
            onChange: setVisibleKeys,
            onReset: reset,
          }}
        />
      </div>

      {showGhost ? (
        <CrmEmptyPreview
          canWrite={canWrite && archive === 'active' && customers.length === 0}
          ctaLabel={tab === 'partner' ? t('partnerCreateFirst') : t('customerCreateFirst')}
          hint={
            customers.length === 0
              ? tab === 'partner'
                ? t('partnerEmptyHint')
                : t('customerEmptyHint')
              : t('customerSearchEmpty')
          }
          onCta={() => setCreateOpen(true)}
        >
          <table className="table funnel-grid-table product-table">
            {renderSortableHead()}
            <tbody>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="crm-empty-row" aria-hidden>
                  <td colSpan={colSpan}>&nbsp;</td>
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
                  onClick={() => navigate(`${listBase}/${c.id}`)}
                >
                  {renderCells(c)}
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
        key={tab}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultIsCustomer={tab === 'customer'}
        defaultIsPartner={tab === 'partner'}
        onSave={async (body) => {
          const r = await api<{ customer: BuCustomer }>(`/api/b/${slug}/customers`, {
            method: 'POST',
            body: JSON.stringify(body),
          })
          await refresh()
          navigate(`${listBase}/${r.customer.id}`)
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
