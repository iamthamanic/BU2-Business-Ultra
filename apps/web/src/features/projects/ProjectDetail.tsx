/**
 * ProjectDetail — Übersicht | Aufgaben | Board | Aktivität | Einstellungen.
 * Location: apps/web/src/features/projects/ProjectDetail.tsx
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import {
  ArrowRight,
  GearSix,
  Kanban,
  ListChecks,
  Plus,
  SquaresFour,
  ClockCounterClockwise,
  WarningCircle,
} from '@phosphor-icons/react'
import { CrmEmptyPreview } from '../../components/CrmEmptyPreview'
import { MktTab, MktTabs } from '../../components/MktTabs'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import type { MessageKey } from '../../i18n/messages'
import { companyRoutes } from '../../lib/companyPaths'
import { MemberAvatar, memberDisplayName, type MemberInfo } from './MemberAvatar'
import { ProjectBoard } from './ProjectBoard'
import { ProjectStatusBadge } from './TaskBadges'
import { EmptyTaskTable, TaskTable } from './TaskTable'
import { TaskCreateModal } from './TaskCreateModal'
import { TaskDetailModal } from './TaskDetailModal'
import type { BuProject, BuProjectEvent, BuTask } from './projectTypes'
import type { ProjectsOutletContext } from './ProjectsShell'
import { normalizeLaneOrder, taskStatusLabel, type TaskStatus } from './taskLabels'

type Tab = 'overview' | 'tasks' | 'board' | 'activity' | 'settings'
type TFn = (k: MessageKey) => string
type MemberById = Record<string, MemberInfo>

function dateInputValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function dateToIso(v: string): string | null {
  if (!v.trim()) return null
  const d = new Date(`${v.trim()}T09:00:00`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function formatMetaDate(iso: string | null | undefined, empty: string): string {
  if (!iso) return empty
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return empty
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

export function ProjectDetail() {
  const { id } = useParams()
  const ctx = useOutletContext<ProjectsOutletContext>()
  const slug = ctx?.slug || ''
  const canWrite = ctx?.canWrite ?? false
  const { t } = useI18n()
  const navigate = useNavigate()
  const routes = companyRoutes(slug)

  const [tab, setTab] = useState<Tab>('overview')
  const [project, setProject] = useState<BuProject | null>(null)
  const [tasks, setTasks] = useState<BuTask[]>([])
  const [events, setEvents] = useState<BuProjectEvent[]>([])
  const [members, setMembers] = useState<MemberInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [createStatus, setCreateStatus] = useState<TaskStatus>('open')
  const [selected, setSelected] = useState<{ id: string; source: 'task' | 'rule' } | null>(null)
  const [memberDraft, setMemberDraft] = useState<string[]>([])
  const [startDraft, setStartDraft] = useState('')
  const [dueDraft, setDueDraft] = useState('')

  const memberById = useMemo(() => {
    const m: MemberById = {}
    for (const mem of members) m[mem.userId] = mem
    return m
  }, [members])

  async function refresh() {
    if (!slug || !id) return
    setLoading(true)
    try {
      const [r, act] = await Promise.all([
        api<{ project: BuProject; tasks: BuTask[] }>(`/api/b/${slug}/projects/${id}`),
        api<{ events: BuProjectEvent[] }>(`/api/b/${slug}/projects/${id}/activity?limit=40`).catch(
          () => ({ events: [] as BuProjectEvent[] }),
        ),
      ])
      setProject(r.project)
      setTasks(r.tasks)
      setEvents(act.events || [])
      setMemberDraft(r.project.memberUserIds || [])
      setStartDraft(dateInputValue(r.project.startAt))
      setDueDraft(dateInputValue(r.project.dueAt))
    } finally {
      setLoading(false)
    }
  }

  async function toggleTaskDone(task: BuTask, done: boolean) {
    if (task.source === 'rule') return
    await api(`/api/b/${slug}/tasks/${task.id}/status`, {
      method: 'POST',
      body: JSON.stringify({
        status: done ? 'done' : 'open',
        version: task.version,
      }),
    })
    await refresh()
  }

  function openTask(task: BuTask | string) {
    if (typeof task === 'string') {
      setSelected({ id: task, source: 'task' })
      return
    }
    setSelected({ id: task.id, source: task.source === 'rule' ? 'rule' : 'task' })
  }

  function openCreate(status: TaskStatus = 'open') {
    setCreateStatus(status)
    setCreateOpen(true)
  }

  useEffect(() => {
    refresh().catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, id])

  useEffect(() => {
    if (!slug) return
    api<{ members: MemberInfo[] }>(`/api/b/${slug}/members`)
      .then((r) => setMembers(r.members || []))
      .catch(() => setMembers([]))
  }, [slug])

  const team = useMemo(() => {
    const ids = new Set<string>()
    if (project?.ownerUserId) ids.add(project.ownerUserId)
    for (const uid of project?.memberUserIds || []) ids.add(uid)
    for (const task of tasks) {
      if (task.assigneeUserId) ids.add(task.assigneeUserId)
    }
    return [...ids].map((uid) => memberById[uid]).filter(Boolean) as MemberInfo[]
  }, [project, tasks, memberById])

  if (loading && !project) return <p className="muted">…</p>
  if (!project) return <p className="error">{t('notFound')}</p>

  const stats = project.stats || { total: 0, done: 0, open: 0, overdue: 0 }
  const progressPct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0

  return (
    <div className="stack mkt-shell product-shell crm-shell">
      <header className="product-page-head">
        <div>
          <Link to={routes.projects} className="muted" style={{ fontSize: 13 }}>
            ← {t('projects')}
          </Link>
          <h1 className="section-title product-page-title" style={{ marginTop: 4 }}>
            {project.name}
          </h1>
          <p className="product-page-meta" style={{ margin: '6px 0 0' }}>
            <ProjectStatusBadge status={project.status} t={t} />
          </p>
        </div>
        {canWrite ? (
          <div className="product-page-actions">
            <button type="button" className="btn primary" onClick={() => openCreate('open')}>
              <Plus size={14} weight="bold" aria-hidden />
              {t('taskCreate')}
            </button>
          </div>
        ) : null}
      </header>

      <MktTabs level="surface" label={t('projects')} className="crm-detail-tabs">
        {(
          [
            ['overview', t('projectTabOverview'), SquaresFour],
            ['tasks', t('projectTabTasks'), ListChecks],
            ['board', t('projectTabBoard'), Kanban],
            ['activity', t('projectTabActivity'), ClockCounterClockwise],
            ['settings', t('projectTabSettings'), GearSix],
          ] as const
        ).map(([k, label, Icon]) => (
          <MktTab
            key={k}
            active={tab === k}
            label={label}
            icon={Icon}
            onClick={() => setTab(k)}
          />
        ))}
      </MktTabs>

      {tab === 'overview' ? (
        <div className="crm-tab-panel">
          <div className="project-overview-grid">
            <section className="panel project-overview-main">
              <header className="project-overview-brief-head">
                <h2 className="crm-section-title" style={{ margin: 0 }}>
                  {t('projectBrief')}
                </h2>
                <ProjectStatusBadge status={project.status} t={t} />
              </header>
              <p className="project-overview-desc">
                {project.description || t('projectNoDesc')}
              </p>

              <div className="project-kpi-strip" role="group" aria-label={t('projectProgress')}>
                <div className="project-kpi">
                  <span className="project-kpi-label">{t('projectsStatOpen')}</span>
                  <strong className="project-kpi-value">{stats.open}</strong>
                </div>
                <div className={`project-kpi${stats.overdue > 0 ? ' is-warn' : ''}`}>
                  <span className="project-kpi-label">
                    {stats.overdue > 0 ? (
                      <WarningCircle size={12} weight="bold" aria-hidden />
                    ) : null}
                    {t('projectsStatOverdue')}
                  </span>
                  <strong className="project-kpi-value">{stats.overdue}</strong>
                </div>
                <div className="project-kpi is-done">
                  <span className="project-kpi-label">{t('projectsStatDone')}</span>
                  <strong className="project-kpi-value">{stats.done}</strong>
                </div>
              </div>

              <div className="project-progress-block">
                <div className="project-progress-meta">
                  <span className="muted">{t('projectProgress')}</span>
                  <strong>
                    {stats.done}/{stats.total} · {progressPct}%
                  </strong>
                </div>
                <div
                  className="project-progress-bar"
                  role="progressbar"
                  aria-valuenow={progressPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span style={{ width: `${progressPct}%` }} />
                </div>
              </div>

              <div className="project-overview-meta">
                <div className="project-overview-meta-item">
                  <span className="muted">{t('projectStartLabel')}</span>
                  <strong>{formatMetaDate(project.startAt, t('projectNoStart'))}</strong>
                </div>
                <div className="project-overview-meta-item">
                  <span className="muted">{t('projectDueLabel')}</span>
                  <strong>{formatMetaDate(project.dueAt, t('projectNoDue'))}</strong>
                </div>
                <div className="project-overview-meta-item">
                  <span className="muted">{t('projectVisibility')}</span>
                  <strong>{t('projectVisibilityTeamOnly')}</strong>
                </div>
              </div>

              <div className="project-overview-team">
                <span className="project-overview-team-label">{t('projectTeam')}</span>
                {team.length === 0 ? (
                  <span className="muted">—</span>
                ) : (
                  <span className="project-team-row">
                    {team.map((m) => (
                      <MemberAvatar key={m.userId} member={m} size={28} />
                    ))}
                  </span>
                )}
              </div>

              <button
                type="button"
                className="btn project-overview-cta"
                onClick={() => setTab('board')}
              >
                {t('projectGoBoard')}
                <ArrowRight size={14} weight="bold" aria-hidden />
              </button>
            </section>

            <aside className="project-overview-side">
              <section className="panel project-overview-panel project-overview-activity">
                <header className="project-overview-panel-head">
                  <h2 className="crm-section-title" style={{ margin: 0 }}>
                    {t('projectRecentActivity')}
                  </h2>
                  {events.length > 0 ? (
                    <span className="project-overview-count">{events.length}</span>
                  ) : null}
                </header>
                <ActivityList events={events} t={t} compact />
              </section>
            </aside>
          </div>
        </div>
      ) : null}

      {tab === 'tasks' ? (
        tasks.length === 0 ? (
          <CrmEmptyPreview
            canWrite={canWrite}
            ctaLabel={t('taskCreateFirst')}
            hint={t('taskEmptyHint')}
            onCta={() => openCreate('open')}
          >
            <EmptyTaskTable t={t} />
          </CrmEmptyPreview>
        ) : (
          <div className="crm-tab-panel">
            <TaskTable
              tasks={tasks}
              onOpen={openTask}
              t={t}
              slug={slug}
              memberById={memberById}
              showFilters
              canWrite={canWrite}
              onToggleDone={toggleTaskDone}
            />
          </div>
        )
      ) : null}

      {tab === 'board' ? (
        <div className="crm-tab-panel">
          <ProjectBoard
            slug={slug}
            tasks={tasks}
            canWrite={canWrite}
            laneOrder={project.boardLaneOrder}
            memberById={memberById}
            t={t}
            onOpenTask={openTask}
            onCreate={(status) => openCreate(status || 'open')}
            onChanged={refresh}
            onLaneOrderChange={async (order: TaskStatus[]) => {
              const r = await api<{ project: BuProject }>(`/api/b/${slug}/projects/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ boardLaneOrder: order }),
              })
              setProject(r.project)
            }}
          />
        </div>
      ) : null}

      {tab === 'activity' ? (
        <div className="crm-tab-panel">
          {events.length === 0 ? (
            <CrmEmptyPreview canWrite={false} ctaLabel="" hint={t('projectActivityEmptyHint')}>
              <div className="panel project-activity-empty">
                <p className="muted" style={{ margin: 0 }}>
                  {t('projectActivityEmpty')}
                </p>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="project-activity-ghost" aria-hidden />
                ))}
              </div>
            </CrmEmptyPreview>
          ) : (
            <ActivityList events={events} t={t} />
          )}
        </div>
      ) : null}

      {tab === 'settings' ? (
        <div className="crm-tab-panel">
          <div className="project-settings-grid">
            <form
              className="panel project-settings-form"
              onSubmit={async (e) => {
                e.preventDefault()
                if (!canWrite || !project) return
                await api(`/api/b/${slug}/projects/${id}`, {
                  method: 'PATCH',
                  body: JSON.stringify({
                    name: project.name,
                    description: project.description,
                    status: project.status,
                    ownerUserId: project.ownerUserId,
                    memberUserIds: memberDraft.filter((uid) => uid !== project.ownerUserId),
                    startAt: dateToIso(startDraft),
                    dueAt: dateToIso(dueDraft),
                  }),
                })
                await refresh()
                await ctx.refreshProjects?.()
              }}
            >
              <header className="project-settings-head">
                <h2 className="crm-section-title" style={{ margin: 0 }}>
                  {t('projectTabSettings')}
                </h2>
                <ProjectStatusBadge status={project.status} t={t} />
              </header>

              <label className="field">
                <span className="label">{t('name')}</span>
                <input
                  className="input"
                  disabled={!canWrite}
                  value={project.name}
                  onChange={(e) => setProject({ ...project, name: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="label">{t('description')}</span>
                <textarea
                  className="input textarea"
                  disabled={!canWrite}
                  rows={4}
                  value={project.description}
                  onChange={(e) => setProject({ ...project, description: e.target.value })}
                />
              </label>
              <div className="project-settings-row">
                <label className="field">
                  <span className="label">{t('projectStatus')}</span>
                  <select
                    className="input"
                    disabled={!canWrite}
                    value={project.status}
                    onChange={(e) => setProject({ ...project, status: e.target.value })}
                  >
                    <option value="planned">{t('projectStatusPlanned')}</option>
                    <option value="active">{t('projectStatusActive')}</option>
                    <option value="done">{t('projectStatusDone')}</option>
                  </select>
                </label>
                <label className="field">
                  <span className="label">{t('projectOwner')}</span>
                  <select
                    className="input"
                    disabled={!canWrite}
                    value={project.ownerUserId || ''}
                    onChange={(e) =>
                      setProject({ ...project, ownerUserId: e.target.value || null })
                    }
                  >
                    <option value="">{t('taskAssigneeNone')}</option>
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {memberDisplayName(m)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="project-settings-row">
                <label className="field">
                  <span className="label">{t('projectStartLabel')}</span>
                  <input
                    className="input"
                    type="date"
                    disabled={!canWrite}
                    value={startDraft}
                    onChange={(e) => setStartDraft(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span className="label">{t('projectDueLabel')}</span>
                  <input
                    className="input"
                    type="date"
                    disabled={!canWrite}
                    value={dueDraft}
                    onChange={(e) => setDueDraft(e.target.value)}
                  />
                </label>
              </div>
              <div className="field">
                <span className="label">{t('projectTeamAssign')}</span>
                <p className="muted project-settings-note" style={{ marginTop: 0 }}>
                  {t('projectVisibilityTeamOnly')}
                </p>
                <ul className="project-settings-members">
                  {members.map((m) => {
                    const isOwner = m.userId === project.ownerUserId
                    const on = isOwner || memberDraft.includes(m.userId)
                    return (
                      <li key={m.userId}>
                        <label className={`project-settings-member${on ? ' is-on' : ''}`}>
                          <input
                            type="checkbox"
                            disabled={!canWrite || isOwner}
                            checked={on}
                            onChange={() => {
                              if (isOwner) return
                              setMemberDraft((prev) =>
                                prev.includes(m.userId)
                                  ? prev.filter((id) => id !== m.userId)
                                  : [...prev, m.userId],
                              )
                            }}
                          />
                          <MemberAvatar member={m} size={22} />
                          <span>{memberDisplayName(m)}</span>
                          {isOwner ? (
                            <span className="muted">{t('projectOwner')}</span>
                          ) : null}
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </div>
              {canWrite ? (
                <div className="project-settings-actions">
                  <button type="submit" className="btn primary">
                    {t('save')}
                  </button>
                </div>
              ) : null}
            </form>

            <aside className="panel project-settings-rail">
              <h2 className="crm-section-title" style={{ margin: 0 }}>
                {t('projectSettingsActions')}
              </h2>
              <p className="muted project-settings-note">{t('projectAccessNote')}</p>

              <div className="project-settings-block">
                <span className="label">{t('projectTabBoard')}</span>
                <div className="project-lane-flow" aria-label={t('projectTabBoard')}>
                  {normalizeLaneOrder(project.boardLaneOrder).map((lane, i, arr) => (
                    <span key={lane} className="row" style={{ gap: 6, alignItems: 'center' }}>
                      <span className="project-lane-chip" data-lane={lane}>
                        {taskStatusLabel(lane, t)}
                      </span>
                      {i < arr.length - 1 ? (
                        <span className="project-lane-sep" aria-hidden>
                          →
                        </span>
                      ) : null}
                    </span>
                  ))}
                </div>
              </div>

              {canWrite ? (
                <div className="project-settings-rail-actions">
                  {project.type === 'custom' && project.status !== 'done' ? (
                    <button
                      type="button"
                      className="btn"
                      onClick={async () => {
                        await api(`/api/b/${slug}/projects/${id}/complete`, { method: 'POST' })
                        await refresh()
                      }}
                    >
                      {t('projectComplete')}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={async () => {
                      await api(`/api/b/${slug}/projects/${id}/archive`, { method: 'POST' })
                      await ctx.refreshProjects?.()
                      navigate(routes.projects)
                    }}
                  >
                    {t('archive')}
                  </button>
                </div>
              ) : null}
            </aside>
          </div>
        </div>
      ) : null}

      <TaskCreateModal
        open={createOpen}
        slug={slug}
        projects={ctx.projects?.length ? ctx.projects : project ? [project] : []}
        defaultProjectId={id}
        defaultStatus={createStatus}
        onClose={() => setCreateOpen(false)}
        onSave={async (body) => {
          await api(`/api/b/${slug}/tasks`, {
            method: 'POST',
            body: JSON.stringify({ ...body, projectId: id }),
          })
          await refresh()
        }}
      />
      <TaskDetailModal
        slug={slug}
        taskId={selected?.id ?? null}
        source={selected?.source ?? 'task'}
        canWrite={canWrite}
        memberById={memberById}
        members={members}
        onClose={() => setSelected(null)}
        onChanged={() => {
          refresh().catch(console.error)
        }}
      />
    </div>
  )
}

function ActivityList({
  events,
  t,
  compact = false,
}: {
  events: BuProjectEvent[]
  t: TFn
  compact?: boolean
}) {
  if (events.length === 0) {
    return <p className="muted project-overview-empty">{t('projectActivityEmpty')}</p>
  }
  return (
    <ul className={`project-activity-list${compact ? ' is-compact' : ''}`}>
      {events.map((ev) => {
        const when = new Date(ev.createdAt)
        const label = Number.isNaN(when.getTime())
          ? ''
          : when.toLocaleString(undefined, {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })
        const actor = ev.actorDisplayName?.trim()
        return (
          <li key={ev.id} className="project-activity-item">
            <div className="project-activity-dot" aria-hidden />
            <div className="project-activity-body">
              <p className="project-activity-summary">{ev.summary}</p>
              <p className="muted project-activity-meta">
                {[actor, label].filter(Boolean).join(' · ')}
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
