/**
 * RecurringRulesPage — company-wide recurring tasks (board-aligned table).
 * Location: apps/web/src/features/projects/RecurringRulesPage.tsx
 */
import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Plus } from '@phosphor-icons/react'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { MemberAvatar, memberDisplayName, type MemberInfo } from './MemberAvatar'
import type { ProjectsOutletContext } from './ProjectsShell'
import { ProjectsScopeToggle } from './ProjectsScopeToggle'
import type { BuRecurrenceRule } from './projectTypes'
import { TaskCreateModal } from './TaskCreateModal'
import { TaskDetailModal } from './TaskDetailModal'
import { TaskPriorityBadge, TaskStatusBadge } from './TaskBadges'
import { taskRhythmLabel } from './taskLabels'

function formatDue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

export function RecurringRulesPage() {
  const ctx = useOutletContext<ProjectsOutletContext>()
  const slug = ctx?.slug || ''
  const canWrite = ctx?.canWrite ?? false
  const { t } = useI18n()
  const [rules, setRules] = useState<BuRecurrenceRule[]>([])
  const [members, setMembers] = useState<MemberInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null)

  const projectNameById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const p of ctx?.projects || []) map[p.id] = p.name
    return map
  }, [ctx?.projects])

  const memberById = useMemo(() => {
    const map: Record<string, MemberInfo> = {}
    for (const m of members) map[m.userId] = m
    return map
  }, [members])

  async function refresh() {
    if (!slug) return
    setLoading(true)
    try {
      const [rulesRes, membersRes] = await Promise.all([
        api<{ rules: BuRecurrenceRule[] }>(`/api/b/${slug}/recurrence`),
        api<{ members: MemberInfo[] }>(`/api/b/${slug}/members`).catch(() => ({
          members: [] as MemberInfo[],
        })),
      ])
      setRules(rulesRes.rules)
      setMembers(membersRes.members || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh().catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  return (
    <div className="stack mkt-shell product-shell crm-shell">
      <header className="product-page-head">
        <div>
          <h1 className="section-title product-page-title">{t('projectsRecurring')}</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            {t('projectsRecurringLede')}
          </p>
        </div>
        <div className="product-page-actions">
          {canWrite ? (
            <button type="button" className="btn primary" onClick={() => setCreateOpen(true)}>
              <Plus size={14} weight="bold" aria-hidden />
              {t('taskCreate')}
            </button>
          ) : null}
        </div>
      </header>

      <div className="crm-subnav project-index-toolbar" role="navigation" aria-label={t('projects')}>
        <ProjectsScopeToggle slug={slug} active="recurring" />
      </div>

      <div className="funnel-table-wrap task-table-panel panel" aria-busy={loading}>
        <table className="table funnel-grid-table product-table task-table">
          <thead>
            <tr>
              <th>{t('projectCol')}</th>
              <th>{t('taskTitle')}</th>
              <th>{t('taskStatus')}</th>
              <th>{t('taskPriority')}</th>
              <th>{t('taskAssignee')}</th>
              <th>{t('taskDue')}</th>
              <th>{t('taskRecurrenceFreq')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && rules.length === 0 ? (
              <tr className="product-table-row">
                <td colSpan={7} className="muted">
                  {t('loading')}
                </td>
              </tr>
            ) : null}
            {!loading && rules.length === 0 ? (
              <tr className="product-table-row">
                <td colSpan={7} className="muted">
                  {t('recurrenceEmpty')}
                </td>
              </tr>
            ) : null}
            {rules.map((rule) => {
              const projectName = rule.projectId
                ? projectNameById[rule.projectId] || '—'
                : t('taskInbox')
              const status = rule.pausedAt ? 'blocked' : 'open'
              const member = rule.assigneeUserId ? memberById[rule.assigneeUserId] : null
              const isOverdue =
                !rule.pausedAt && new Date(rule.nextAt).getTime() < Date.now()
              return (
                <tr
                  key={rule.id}
                  className={`product-table-row task-table-row${isOverdue ? ' is-overdue' : ''}`}
                  onClick={() => setSelectedRuleId(rule.id)}
                >
                  <td className="muted">{projectName}</td>
                  <td>
                    <span className={`task-table-title-cell task-prio-rail--${rule.priority}`}>
                      <strong className="task-table-title">{rule.title}</strong>
                    </span>
                  </td>
                  <td>
                    <TaskStatusBadge status={status} t={t} />
                  </td>
                  <td>
                    <TaskPriorityBadge priority={rule.priority} t={t} />
                  </td>
                  <td>
                    {member ? (
                      <span className="task-table-assignee">
                        <MemberAvatar member={member} size={22} />
                        <span className="task-table-assignee-name">{memberDisplayName(member)}</span>
                      </span>
                    ) : (
                      <span className="muted">{t('taskAssigneeNone')}</span>
                    )}
                  </td>
                  <td className={isOverdue ? 'task-due--overdue' : 'muted'}>
                    {formatDue(rule.nextAt)}
                    {isOverdue ? ` · ${t('taskOverdue')}` : ''}
                  </td>
                  <td className="muted">{taskRhythmLabel(rule, t)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <TaskCreateModal
        open={createOpen}
        slug={slug}
        projects={ctx?.projects || []}
        defaultMode="recurring"
        onClose={() => setCreateOpen(false)}
        onSave={async (body) => {
          await api(`/api/b/${slug}/tasks`, {
            method: 'POST',
            body: JSON.stringify(body),
          })
        }}
        onCreated={() => {
          refresh().catch(console.error)
        }}
      />
      <TaskDetailModal
        slug={slug}
        taskId={selectedRuleId}
        source="rule"
        canWrite={canWrite}
        memberById={memberById}
        members={members}
        onClose={() => setSelectedRuleId(null)}
        onChanged={() => {
          refresh().catch(console.error)
        }}
      />
    </div>
  )
}
