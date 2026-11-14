/**
 * MyTasksPage — tasks assigned to current user across all projects (incl. recurring).
 * Location: apps/web/src/features/projects/MyTasksPage.tsx
 */
import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Plus } from '@phosphor-icons/react'
import { CrmEmptyPreview } from '../../components/CrmEmptyPreview'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import type { MemberInfo } from './MemberAvatar'
import type { ProjectsOutletContext } from './ProjectsShell'
import { ProjectsScopeToggle } from './ProjectsScopeToggle'
import { EmptyTaskTable, TaskTable } from './TaskTable'
import { TaskCreateModal } from './TaskCreateModal'
import { TaskDetailModal } from './TaskDetailModal'
import type { BuTask } from './projectTypes'

export function MyTasksPage() {
  const ctx = useOutletContext<ProjectsOutletContext>()
  const slug = ctx?.slug || ''
  const canWrite = ctx?.canWrite ?? false
  const { t } = useI18n()
  const [tasks, setTasks] = useState<BuTask[]>([])
  const [members, setMembers] = useState<MemberInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [selected, setSelected] = useState<{ id: string; source: 'task' | 'rule' } | null>(null)

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

  function openTask(task: BuTask) {
    setSelected({ id: task.id, source: task.source === 'rule' ? 'rule' : 'task' })
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
          <h1 className="section-title product-page-title">{t('projectsMine')}</h1>
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

      <div className="crm-subnav project-index-toolbar" role="navigation" aria-label={t('projects')}>
        <ProjectsScopeToggle slug={slug} active="mine" />
      </div>

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
          onOpen={openTask}
          t={t}
          slug={slug}
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
