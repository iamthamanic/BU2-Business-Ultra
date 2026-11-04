/**
 * MyTasksPage — assignee + project-less tasks with stats and enriched table.
 * Location: apps/web/src/features/projects/MyTasksPage.tsx
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { Plus } from '@phosphor-icons/react'
import { CrmEmptyPreview } from '../../components/CrmEmptyPreview'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { companyRoutes } from '../../lib/companyPaths'
import type { MemberInfo } from './MemberAvatar'
import type { ProjectsOutletContext } from './ProjectsShell'
import { EmptyTaskTable, TaskTable } from './TaskTable'
import { TaskCreateModal } from './TaskCreateModal'
import { TaskDetailModal } from './TaskDetailModal'
import type { BuTask } from './projectTypes'

export function MyTasksPage() {
  const ctx = useOutletContext<ProjectsOutletContext>()
  const slug = ctx?.slug || ''
  const canWrite = ctx?.canWrite ?? false
  const { t } = useI18n()
  const routes = companyRoutes(slug)
  const [tasks, setTasks] = useState<BuTask[]>([])
  const [members, setMembers] = useState<MemberInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const memberById = useMemo(() => {
    const m: Record<string, MemberInfo> = {}
    for (const mem of members) m[mem.userId] = mem
    return m
  }, [members])

  const projectNameById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const p of ctx.projects || []) m[p.id] = p.name
    return m
  }, [ctx.projects])

  const stats = useMemo(() => {
    let open = 0
    let inProgress = 0
    let done = 0
    for (const task of tasks) {
      if (task.status === 'done') done++
      else if (task.status === 'in_progress') inProgress++
      else open++
    }
    return { open, inProgress, done }
  }, [tasks])

  async function refresh() {
    if (!slug) return
    setLoading(true)
    try {
      const r = await api<{ tasks: BuTask[] }>(`/api/b/${slug}/tasks/mine`)
      setTasks(r.tasks)
    } finally {
      setLoading(false)
    }
  }

  async function toggleTaskDone(task: BuTask, done: boolean) {
    await api(`/api/b/${slug}/tasks/${task.id}/status`, {
      method: 'POST',
      body: JSON.stringify({
        status: done ? 'done' : 'open',
        version: task.version,
      }),
    })
    await refresh()
  }

  useEffect(() => {
    refresh().catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  useEffect(() => {
    if (!slug) return
    api<{ members: MemberInfo[] }>(`/api/b/${slug}/members`)
      .then((r) => setMembers(r.members || []))
      .catch(() => setMembers([]))
  }, [slug])

  const empty = !loading && tasks.length === 0

  return (
    <div className="stack mkt-shell product-shell crm-shell">
      <header className="product-page-head">
        <div>
          <Link to={routes.projects} className="muted" style={{ fontSize: 13 }}>
            ← {t('projects')}
          </Link>
          <h1 className="section-title product-page-title" style={{ marginTop: 4 }}>
            {t('projectsMine')}
          </h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            {t('projectsMineLede')}
          </p>
        </div>
        {canWrite ? (
          <div className="product-page-actions">
            <button type="button" className="btn primary" onClick={() => setCreateOpen(true)}>
              <Plus size={14} weight="bold" aria-hidden />
              {t('taskCreate')}
            </button>
          </div>
        ) : null}
      </header>

      {!empty ? (
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <span className="crm-stat">
            <span className="muted">{t('taskStatOpen')}</span>
            <strong>{stats.open}</strong>
          </span>
          <span className="crm-stat">
            <span className="muted">{t('taskStatInProgress')}</span>
            <strong>{stats.inProgress}</strong>
          </span>
          <span className="crm-stat">
            <span className="muted">{t('taskStatDone')}</span>
            <strong>{stats.done}</strong>
          </span>
        </div>
      ) : null}

      {empty ? (
        <CrmEmptyPreview
          canWrite={canWrite}
          ctaLabel={t('taskCreate')}
          hint={t('projectsMineLede')}
          onCta={() => setCreateOpen(true)}
        >
          <EmptyTaskTable t={t} />
        </CrmEmptyPreview>
      ) : (
        <TaskTable
          tasks={tasks}
          onOpen={setSelectedTaskId}
          t={t}
          memberById={memberById}
          showFilters
          showProject
          projectNameById={projectNameById}
          canWrite={canWrite}
          onToggleDone={toggleTaskDone}
        />
      )}

      <TaskCreateModal
        open={createOpen}
        slug={slug}
        projects={ctx.projects || []}
        onClose={() => setCreateOpen(false)}
        onSave={async (body) => {
          await api(`/api/b/${slug}/tasks`, {
            method: 'POST',
            body: JSON.stringify(body),
          })
          await refresh()
        }}
      />
      <TaskDetailModal
        slug={slug}
        taskId={selectedTaskId}
        canWrite={canWrite}
        memberById={memberById}
        members={members}
        onClose={() => setSelectedTaskId(null)}
        onChanged={() => {
          refresh().catch(console.error)
        }}
      />
    </div>
  )
}
