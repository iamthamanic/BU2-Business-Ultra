/**
 * ProjectsShell — hybrid index (KPIs, filters, area group headers) + outlet.
 * Location: apps/web/src/features/projects/ProjectsShell.tsx
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from 'react-router-dom'
import {
  ArrowsClockwise,
  CalendarBlank,
  CheckCircle,
  CirclesThree,
  DotsThree,
  FolderSimpleDashed,
  ListChecks,
  MagnifyingGlass,
  PlayCircle,
  Plus,
  SquaresFour,
  Table,
  WarningCircle,
} from '@phosphor-icons/react'
import { canMutateContent } from '@bu2/shared'
import type { CompanyOutletContext } from '../../components/BusinessShell'
import { CrmEmptyPreview } from '../../components/CrmEmptyPreview'
import { CrmIconSelect, type CrmIconSelectOption } from '../../components/CrmIconSelect'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import type { MessageKey } from '../../i18n/messages'
import { companyRoutes } from '../../lib/companyPaths'
import { ProjectCreateModal } from './ProjectCreateModal'
import { MemberAvatar, type MemberInfo } from './MemberAvatar'
import { ProjectStatusBadge } from './TaskBadges'
import type { BuProject } from './projectTypes'
import { ProjectGlyphAvatar } from './projectVisual'

export type ProjectsOutletContext = CompanyOutletContext & {
  slug: string
  canWrite: boolean
  projects: BuProject[]
  refreshProjects: () => Promise<void>
}

type TFn = (k: MessageKey) => string

type Group = {
  area: BuProject | null
  label: string
  items: BuProject[]
}

function progressPct(p: BuProject): number {
  const s = p.stats || { total: 0, done: 0 }
  if (!s.total) return 0
  return Math.round((s.done / s.total) * 100)
}

function progressLabel(p: BuProject, t: TFn) {
  const s = p.stats || { total: 0, done: 0, open: 0, overdue: 0 }
  if (!s.total) return t('projectNoTasks')
  return `${s.done}/${s.total}`
}

function formatShortDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
}

export function ProjectsShell() {
  const { slug: paramSlug } = useParams()
  const location = useLocation()
  const ctx = useOutletContext<CompanyOutletContext | null>()
  const slug = paramSlug || ctx?.slug || ''
  const { t } = useI18n()
  const navigate = useNavigate()
  const role = ctx?.membership?.role
  const canWrite = role ? canMutateContent(role) : Boolean(ctx?.user?.isSuperadmin)
  const routes = companyRoutes(slug)

  const [projects, setProjects] = useState<BuProject[]>([])
  const [members, setMembers] = useState<MemberInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [areaFilter, setAreaFilter] = useState('')
  const [view, setView] = useState<'list' | 'cards'>('list')
  const [createOpen, setCreateOpen] = useState(false)

  const path = location.pathname.replace(/\/+$/, '')
  const isIndex = path.endsWith('/projects')

  const memberById = useMemo(() => {
    const m: Record<string, MemberInfo> = {}
    for (const mem of members) m[mem.userId] = mem
    return m
  }, [members])

  async function refresh() {
    if (!slug) return
    setLoading(true)
    try {
      const [r, mem] = await Promise.all([
        api<{ projects: BuProject[] }>(`/api/b/${slug}/projects`),
        api<{ members: MemberInfo[] }>(`/api/b/${slug}/members`).catch(() => ({
          members: [] as MemberInfo[],
        })),
      ])
      setProjects(r.projects)
      setMembers(mem.members || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh().catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const outletCtx: ProjectsOutletContext = {
    slug,
    user: ctx!.user,
    membership: ctx?.membership ?? null,
    canWrite,
    projects,
    refreshProjects: refresh,
  }

  const areas = useMemo(() => projects.filter((p) => p.type === 'area'), [projects])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return projects.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false
      if (areaFilter === '__none__') {
        if (p.type === 'area') return false
        if (p.parentAreaProjectId) return false
      } else if (areaFilter) {
        if (p.id !== areaFilter && p.parentAreaProjectId !== areaFilter) return false
      }
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.area || '').toLowerCase().includes(q)
      )
    })
  }, [projects, query, statusFilter, areaFilter])

  const groups = useMemo(() => {
    const areaById = new Map(areas.map((a) => [a.id, a]))
    const customs = filtered.filter((p) => p.type === 'custom')
    const visibleAreas = filtered.filter((p) => p.type === 'area')
    const usedAreaIds = new Set<string>()
    const result: Group[] = []

    for (const area of visibleAreas) {
      usedAreaIds.add(area.id)
      const children = customs.filter((c) => c.parentAreaProjectId === area.id)
      result.push({
        area,
        label: area.name,
        items: children,
      })
    }

    // Customs whose parent area is not in filtered list — still group if parent exists in all areas
    const orphanCustoms: BuProject[] = []
    for (const c of customs) {
      if (!c.parentAreaProjectId) {
        orphanCustoms.push(c)
        continue
      }
      if (usedAreaIds.has(c.parentAreaProjectId)) continue
      const parent = areaById.get(c.parentAreaProjectId)
      if (parent && !usedAreaIds.has(parent.id)) {
        usedAreaIds.add(parent.id)
        result.push({
          area: parent,
          label: parent.name,
          items: [c],
        })
      } else if (parent && usedAreaIds.has(parent.id)) {
        const g = result.find((x) => x.area?.id === parent.id)
        if (g && !g.items.some((i) => i.id === c.id)) g.items.push(c)
      } else {
        orphanCustoms.push(c)
      }
    }

    if (orphanCustoms.length) {
      result.push({
        area: null,
        label: t('projectNoAreaGroup'),
        items: orphanCustoms,
      })
    }

    return result
  }, [filtered, areas, t])

  const openTotal = projects.reduce((s, p) => s + (p.stats?.open || 0), 0)
  const overdueTotal = projects.reduce((s, p) => s + (p.stats?.overdue || 0), 0)
  const doneTotal = projects.reduce((s, p) => s + (p.stats?.done || 0), 0)
  const activeProjects = projects.filter((p) => p.status === 'active').length

  const statusFilterOptions = useMemo<CrmIconSelectOption[]>(
    () => [
      {
        value: '',
        label: t('projectFilterAllStatus'),
        tone: 'all',
        icon: <CirclesThree size={14} weight="regular" aria-hidden />,
      },
      {
        value: 'planned',
        label: t('projectStatusPlanned'),
        tone: 'planned',
        icon: <CalendarBlank size={14} weight="regular" aria-hidden />,
      },
      {
        value: 'active',
        label: t('projectStatusActive'),
        tone: 'active',
        icon: <PlayCircle size={14} weight="regular" aria-hidden />,
      },
      {
        value: 'done',
        label: t('projectStatusDone'),
        tone: 'done',
        icon: <CheckCircle size={14} weight="bold" aria-hidden />,
      },
    ],
    [t],
  )

  const areaFilterOptions = useMemo<CrmIconSelectOption[]>(
    () => [
      {
        value: '',
        label: t('projectFilterAllAreas'),
        tone: 'all',
        icon: <SquaresFour size={14} weight="regular" aria-hidden />,
      },
      {
        value: '__none__',
        label: t('projectNoAreaGroup'),
        tone: 'none',
        icon: <FolderSimpleDashed size={14} weight="regular" aria-hidden />,
      },
      ...areas.map((a) => ({
        value: a.id,
        label: a.name,
        tone: 'area',
        icon: <ProjectGlyphAvatar project={a} size={14} className="crm-pick-av project-av" />,
      })),
    ],
    [areas, t],
  )

  if (!isIndex) {
    return <Outlet context={outletCtx} />
  }

  const emptyAll = projects.length === 0
  const emptySearch = !loading && projects.length > 0 && filtered.length === 0
  const showPreview = emptyAll || emptySearch
  const flatItems = groups.flatMap((g) => g.items)

  return (
    <div className="stack mkt-shell product-shell crm-shell">
      <header className="product-page-head">
        <div className="product-page-title-row">
          <h1 className="section-title product-page-title">{t('projects')}</h1>
          <label className="product-search">
            <MagnifyingGlass size={14} weight="regular" aria-hidden />
            <span className="sr-only">{t('projectSearch')}</span>
            <input
              className="input product-search-input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('projectSearch')}
              autoComplete="off"
            />
          </label>
        </div>
        <div className="product-page-actions">
          <div className="product-view-toggle" role="group" aria-label={t('projects')}>
            <button
              type="button"
              className={`btn icon-btn${view === 'cards' ? ' is-active' : ''}`}
              aria-pressed={view === 'cards'}
              onClick={() => setView('cards')}
              title={t('projectViewCards')}
            >
              <SquaresFour size={16} weight="regular" aria-hidden />
            </button>
            <button
              type="button"
              className={`btn icon-btn${view === 'list' ? ' is-active' : ''}`}
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
              title={t('projectViewList')}
            >
              <Table size={16} weight="regular" aria-hidden />
            </button>
          </div>
          {canWrite ? (
            <button type="button" className="btn primary" onClick={() => setCreateOpen(true)}>
              <Plus size={14} weight="bold" aria-hidden />
              {t('projectCreate')}
            </button>
          ) : null}
        </div>
      </header>

      <div className="crm-subnav project-index-toolbar" role="navigation" aria-label={t('projects')}>
        <div className="project-index-nav">
          <Link className="btn project-mine-cta" to={`${routes.projects}/mine`}>
            <ListChecks size={14} weight="bold" aria-hidden />
            {t('projectsMine')}
          </Link>
          <Link className="btn" to={`${routes.projects}/recurring`}>
            <ArrowsClockwise size={14} weight="bold" aria-hidden />
            {t('projectsRecurring')}
          </Link>
        </div>
        {!emptyAll ? (
          <div className="project-index-filters" role="search">
            <CrmIconSelect
              name="projectStatusFilter"
              value={statusFilter}
              options={statusFilterOptions}
              onChange={setStatusFilter}
              aria-label={t('projectStatus')}
            />
            <CrmIconSelect
              name="projectAreaFilter"
              value={areaFilter}
              options={areaFilterOptions}
              onChange={setAreaFilter}
              aria-label={t('projectAreas')}
            />
          </div>
        ) : null}
      </div>

      {!emptyAll ? (
        <div className="project-index-kpi" role="group" aria-label={t('projectProgress')}>
          <div className="project-kpi">
            <span className="project-kpi-label">{t('projectIndexActive')}</span>
            <strong className="project-kpi-value">{activeProjects}</strong>
          </div>
          <div className="project-kpi">
            <span className="project-kpi-label">{t('projectsStatOpen')}</span>
            <strong className="project-kpi-value">{openTotal}</strong>
          </div>
          <div className={`project-kpi${overdueTotal > 0 ? ' is-warn' : ''}`}>
            <span className="project-kpi-label">
              {overdueTotal > 0 ? <WarningCircle size={12} weight="bold" aria-hidden /> : null}
              {t('projectsStatOverdue')}
            </span>
            <strong className="project-kpi-value">{overdueTotal}</strong>
          </div>
          <div className="project-kpi is-done">
            <span className="project-kpi-label">{t('projectsStatDone')}</span>
            <strong className="project-kpi-value">{doneTotal}</strong>
          </div>
        </div>
      ) : null}

      {showPreview ? (
        <CrmEmptyPreview
          canWrite={canWrite && emptyAll}
          ctaLabel={t('projectCreateFirst')}
          hint={emptySearch ? t('projectSearchEmpty') : t('projectEmptyHint')}
          onCta={() => setCreateOpen(true)}
        />
      ) : view === 'list' ? (
        <GroupedProjectTable
          groups={groups}
          routes={routes}
          t={t}
          slug={slug}
          canWrite={canWrite}
          memberById={memberById}
          onArchived={refresh}
        />
      ) : (
        <div className="crm-sections stack">
          {groups.map((g) => (
            <section key={g.area?.id || 'none'} className="crm-section">
              <header className="crm-section-head">
                <h2 className="crm-section-title">{g.label}</h2>
                <span className="muted">{g.items.length}</span>
              </header>
              <ProjectCards
                items={g.area ? [g.area, ...g.items] : g.items}
                routes={routes}
                t={t}
                slug={slug}
                canWrite={canWrite}
                onArchived={refresh}
              />
            </section>
          ))}
          {flatItems.length === 0 ? (
            <p className="muted">{t('projectSearchEmpty')}</p>
          ) : null}
        </div>
      )}

      <ProjectCreateModal
        open={createOpen}
        areas={areas}
        members={members}
        currentUserId={ctx?.user?.id ?? null}
        onClose={() => setCreateOpen(false)}
        onSave={async (body) => {
          const r = await api<{ project: BuProject }>(`/api/b/${slug}/projects`, {
            method: 'POST',
            body: JSON.stringify(body),
          })
          await refresh()
          navigate(`${routes.projects}/${r.project.id}`)
        }}
      />
    </div>
  )
}

function ProjectActionsMenu({
  projectId,
  href,
  slug,
  canWrite,
  t,
  onArchived,
}: {
  projectId: string
  href: string
  slug: string
  canWrite: boolean
  t: TFn
  onArchived: () => Promise<void>
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div
      ref={rootRef}
      className="project-actions"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      <button
        type="button"
        className="btn icon-btn project-actions-btn"
        aria-label={t('openMenu')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <DotsThree size={18} weight="bold" aria-hidden />
      </button>
      {open ? (
        <div className="project-actions-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            className="project-actions-item"
            onClick={() => {
              setOpen(false)
              navigate(href)
            }}
          >
            {t('open')}
          </button>
          {canWrite ? (
            <button
              type="button"
              role="menuitem"
              className="project-actions-item"
              onClick={async () => {
                setOpen(false)
                await api(`/api/b/${slug}/projects/${projectId}/archive`, { method: 'POST' })
                await onArchived()
              }}
            >
              {t('archive')}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function TeamStack({
  project,
  memberById,
}: {
  project: BuProject
  memberById: Record<string, MemberInfo>
}) {
  const ids = [
    project.ownerUserId,
    ...(project.memberUserIds || []),
  ].filter(Boolean) as string[]
  const unique = [...new Set(ids)].slice(0, 4)
  if (!unique.length) return <span className="muted">—</span>
  return (
    <span className="project-team-row project-team-row--table">
      {unique.map((uid) => {
        const m = memberById[uid]
        return m ? <MemberAvatar key={uid} member={m} size={22} /> : null
      })}
    </span>
  )
}

function GroupedProjectTable({
  groups,
  routes,
  t,
  slug,
  canWrite,
  memberById,
  onArchived,
}: {
  groups: Group[]
  routes: ReturnType<typeof companyRoutes>
  t: TFn
  slug: string
  canWrite: boolean
  memberById: Record<string, MemberInfo>
  onArchived: () => Promise<void>
}) {
  const navigate = useNavigate()
  return (
    <div className="panel funnel-table-wrap">
      <table className="table funnel-grid-table product-table project-index-table">
        <thead>
          <tr>
            <th>{t('name')}</th>
            <th>{t('projectStatus')}</th>
            <th>{t('projectProgress')}</th>
            <th>{t('projectDueLabel')}</th>
            <th>{t('projectTeam')}</th>
            <th className="crm-col-open">
              <span className="sr-only">{t('openMenu')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <GroupRows
              key={g.area?.id || 'none'}
              group={g}
              routes={routes}
              t={t}
              slug={slug}
              canWrite={canWrite}
              memberById={memberById}
              onArchived={onArchived}
              navigate={navigate}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GroupRows({
  group,
  routes,
  t,
  slug,
  canWrite,
  memberById,
  onArchived,
  navigate,
}: {
  group: Group
  routes: ReturnType<typeof companyRoutes>
  t: TFn
  slug: string
  canWrite: boolean
  memberById: Record<string, MemberInfo>
  onArchived: () => Promise<void>
  navigate: ReturnType<typeof useNavigate>
}) {
  const rows = group.area ? [group.area, ...group.items] : group.items

  return (
    <>
      {rows.map((p) => {
        const href = `${routes.projects}/${p.id}`
        const pct = progressPct(p)
        return (
          <tr
            key={p.id}
            className="product-table-row"
            onClick={() => navigate(href)}
          >
            <td>
              <span className="product-table-name">
                <ProjectGlyphAvatar project={p} />
                <strong>{p.name}</strong>
              </span>
            </td>
            <td>
              <ProjectStatusBadge status={p.status} t={t} />
            </td>
            <td>
              <div className="project-index-progress">
                <div
                  className="project-progress-bar project-progress-bar--sm"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span style={{ width: `${pct}%` }} />
                </div>
                <span className="muted">{progressLabel(p, t)}</span>
              </div>
            </td>
            <td className="muted">{formatShortDate(p.dueAt)}</td>
            <td>
              <TeamStack project={p} memberById={memberById} />
            </td>
            <td className="crm-col-open">
              <ProjectActionsMenu
                projectId={p.id}
                href={href}
                slug={slug}
                canWrite={canWrite}
                t={t}
                onArchived={onArchived}
              />
            </td>
          </tr>
        )
      })}
    </>
  )
}

function ProjectCards({
  items,
  routes,
  t,
  slug,
  canWrite,
  onArchived,
}: {
  items: BuProject[]
  routes: ReturnType<typeof companyRoutes>
  t: TFn
  slug: string
  canWrite: boolean
  onArchived: () => Promise<void>
}) {
  return (
    <div className="product-card-grid">
      {items.map((p) => {
        const href = `${routes.projects}/${p.id}`
        const pct = progressPct(p)
        return (
          <div key={p.id} className="panel product-card project-card">
            <div className="product-card-top">
              <Link to={href} className="project-card-title">
                <ProjectGlyphAvatar project={p} />
                <strong className="product-card-name">{p.name}</strong>
              </Link>
              <ProjectActionsMenu
                projectId={p.id}
                href={href}
                slug={slug}
                canWrite={canWrite}
                t={t}
                onArchived={onArchived}
              />
            </div>
            <Link to={href} className="project-card-link">
              <p className="muted product-card-desc">
                {(p.description || '').trim() || t('projectNoDesc')}
              </p>
              <div className="project-index-progress" style={{ marginBottom: 8 }}>
                <div
                  className="project-progress-bar project-progress-bar--sm"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span style={{ width: `${pct}%` }} />
                </div>
                <span className="muted">{progressLabel(p, t)}</span>
              </div>
              <div className="product-card-foot">
                <span className="muted">
                  {p.dueAt ? formatShortDate(p.dueAt) : t('projectNoDue')}
                </span>
                <ProjectStatusBadge status={p.status} t={t} />
              </div>
            </Link>
          </div>
        )
      })}
    </div>
  )
}
