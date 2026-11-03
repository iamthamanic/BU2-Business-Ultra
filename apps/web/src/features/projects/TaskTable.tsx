/**
 * TaskTable — enriched task list with filters (status/prio/assignee/search).
 * Location: apps/web/src/features/projects/TaskTable.tsx
 */
import { useMemo, useState } from 'react'
import { MagnifyingGlass } from '@phosphor-icons/react'
import type { MessageKey } from '../../i18n/messages'
import { MemberAvatar, memberDisplayName, type MemberInfo } from './MemberAvatar'
import { TaskPriorityBadge, TaskStatusBadge } from './TaskBadges'
import type { BuTask } from './projectTypes'
import { TASK_PRIORITIES, TASK_STATUSES } from './taskLabels'

type TFn = (k: MessageKey) => string

export type MemberById = Record<string, MemberInfo>

type Props = {
  tasks: BuTask[]
  onOpen: (id: string) => void
  t: TFn
  memberById?: MemberById
  showFilters?: boolean
  showProject?: boolean
  projectNameById?: Record<string, string>
  emptyRows?: number
  /** Dense list for overview panels — no outer panel chrome */
  compact?: boolean
  canWrite?: boolean
  /** Checkbox: toggle open ↔ done (blocked unchanged). */
  onToggleDone?: (task: BuTask, done: boolean) => void | Promise<void>
}

function formatDue(iso: string | null, t: TFn): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const overdue = d.getTime() < Date.now()
  const label = d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
  return overdue ? `${label} · ${t('taskOverdue')}` : label
}

export function EmptyTaskTable({ t, cols = 6 }: { t: TFn; cols?: number }) {
  return (
    <table className="table funnel-grid-table product-table task-table">
      <thead>
        <tr>
          <th className="task-table-check-col" aria-hidden />
          <th>{t('taskTitle')}</th>
          <th>{t('taskStatus')}</th>
          <th>{t('taskPriority')}</th>
          <th>{t('taskAssignee')}</th>
          <th>{t('taskDue')}</th>
        </tr>
      </thead>
      <tbody>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <tr key={i} className="crm-empty-row" aria-hidden>
            <td colSpan={cols}>&nbsp;</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function TaskTable({
  tasks,
  onOpen,
  t,
  memberById = {},
  showFilters = false,
  showProject = false,
  projectNameById = {},
  emptyRows = 0,
  compact = false,
  canWrite = false,
  onToggleDone,
}: Props) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [assignee, setAssignee] = useState('')

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return tasks.filter((task) => {
      if (status && task.status !== status) return false
      if (priority && task.priority !== priority) return false
      if (assignee === '__none__' && task.assigneeUserId) return false
      if (assignee && assignee !== '__none__' && task.assigneeUserId !== assignee) return false
      if (!term) return true
      return (
        task.title.toLowerCase().includes(term) ||
        (task.description || '').toLowerCase().includes(term)
      )
    })
  }, [tasks, q, status, priority, assignee])

  const assigneeOptions = useMemo(() => {
    const ids = new Set<string>()
    for (const task of tasks) {
      if (task.assigneeUserId) ids.add(task.assigneeUserId)
    }
    return [...ids]
      .map((id) => memberById[id])
      .filter(Boolean) as MemberInfo[]
  }, [tasks, memberById])

  return (
    <div className={`stack task-table-wrap${compact ? ' is-compact' : ''}`}>
      {showFilters ? (
        <div className="task-filter-bar" role="search">
          <label className="task-filter-search">
            <MagnifyingGlass size={14} weight="regular" aria-hidden />
            <input
              className="input task-filter-search-input"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('taskFilterSearch')}
              aria-label={t('taskFilterSearch')}
            />
          </label>
          <div className="task-filter-selects">
            <select
              className="input crm-filter-select task-filter-select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label={t('taskStatus')}
            >
              <option value="">{t('taskFilterAllStatus')}</option>
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(
                    s === 'open'
                      ? 'taskStatusOpen'
                      : s === 'in_progress'
                        ? 'taskStatusInProgress'
                        : s === 'blocked'
                          ? 'taskStatusBlocked'
                          : 'taskStatusDone',
                  )}
                </option>
              ))}
            </select>
            <select
              className="input crm-filter-select task-filter-select"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              aria-label={t('taskPriority')}
            >
              <option value="">{t('taskFilterAllPriority')}</option>
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {t(
                    p === 'low'
                      ? 'taskPriorityLow'
                      : p === 'medium'
                        ? 'taskPriorityMedium'
                        : 'taskPriorityHigh',
                  )}
                </option>
              ))}
            </select>
            <select
              className="input crm-filter-select task-filter-select"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              aria-label={t('taskAssignee')}
            >
              <option value="">{t('taskFilterAllAssignee')}</option>
              <option value="__none__">{t('taskAssigneeNone')}</option>
              {assigneeOptions.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {memberDisplayName(m)}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      <div className={`funnel-table-wrap task-table-panel${compact ? '' : ' panel'}`}>
        <table className="table funnel-grid-table product-table task-table">
          <thead>
            <tr>
              <th className="task-table-check-col">
                <span className="sr-only">{t('taskStatusDone')}</span>
              </th>
              <th>{t('taskTitle')}</th>
              <th>{t('taskStatus')}</th>
              <th>{t('taskPriority')}</th>
              <th>{t('taskAssignee')}</th>
              <th>{t('taskDue')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((task) => {
              const member = task.assigneeUserId ? memberById[task.assigneeUserId] : null
              const due = formatDue(task.dueAt, t)
              const isOverdue =
                Boolean(task.dueAt) &&
                new Date(task.dueAt!).getTime() < Date.now() &&
                task.status !== 'done'
              const isDone = task.status === 'done'
              const toggleDisabled = !canWrite || !onToggleDone || task.status === 'blocked'
              return (
                <tr
                  key={task.id}
                  className={`product-table-row task-table-row${isOverdue ? ' is-overdue' : ''}${isDone ? ' is-done' : ''}`}
                  onClick={() => onOpen(task.id)}
                >
                  <td className="task-table-check-col" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="task-table-check"
                      checked={isDone}
                      disabled={toggleDisabled}
                      aria-label={isDone ? t('taskStatusOpen') : t('taskStatusDone')}
                      onChange={() => {
                        if (toggleDisabled) return
                        void onToggleDone?.(task, !isDone)
                      }}
                    />
                  </td>
                  <td>
                    <span className={`task-table-title-cell task-prio-rail--${task.priority}`}>
                      <strong className="task-table-title">{task.title}</strong>
                      {showProject ? (
                        <span className="muted task-table-sub">
                          {task.projectId
                            ? projectNameById[task.projectId] || t('projects')
                            : t('taskInbox')}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td>
                    <TaskStatusBadge status={task.status} t={t} />
                  </td>
                  <td>
                    <TaskPriorityBadge priority={task.priority} t={t} />
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
                  <td className={isOverdue ? 'task-due--overdue' : 'muted'}>{due}</td>
                </tr>
              )
            })}
            {emptyRows > 0 && filtered.length === 0
              ? Array.from({ length: emptyRows }).map((_, i) => (
                  <tr key={`e-${i}`} className="crm-empty-row" aria-hidden>
                    <td colSpan={6}>&nbsp;</td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
