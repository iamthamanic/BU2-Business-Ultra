/**
 * TaskTable — enriched task list with filters (status toggle/prio/assignee/mode/search).
 * Location: apps/web/src/features/projects/TaskTable.tsx
 */
import { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowsClockwise,
  CheckCircle,
  Circle,
  CircleNotch,
  MagnifyingGlass,
  Minus,
  PencilSimple,
  SquaresFour,
} from '@phosphor-icons/react'
import { CrmIconSelect, type CrmIconSelectOption } from '../../components/CrmIconSelect'
import type { MessageKey } from '../../i18n/messages'
import { MemberAvatar, memberDisplayName, type MemberInfo } from './MemberAvatar'
import { TaskPriorityBadge, TaskStatusBadge } from './TaskBadges'
import type { BuTask, BuTaskMode } from './projectTypes'
import {
  TASK_PRIORITIES,
  formatReopenCountdown,
  taskRhythmLabel,
  taskStatusLabel,
} from './taskLabels'

type TFn = (k: MessageKey) => string

export type MemberById = Record<string, MemberInfo>

/** Filter order: Alle → Offen → In Arbeit → Erledigt → Revision */
const STATUS_FILTER_ORDER = ['open', 'in_progress', 'done', 'blocked'] as const

type Props = {
  tasks: BuTask[]
  onOpen: (task: BuTask) => void
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

function taskMode(task: BuTask): BuTaskMode {
  return task.mode === 'recurring' ? 'recurring' : 'once'
}

function statusFilterIcon(status: string) {
  if (status === 'open') return <Circle size={14} weight="regular" aria-hidden />
  if (status === 'in_progress') return <CircleNotch size={14} weight="bold" aria-hidden />
  if (status === 'blocked') return <PencilSimple size={14} weight="bold" aria-hidden />
  return <CheckCircle size={14} weight="bold" aria-hidden />
}

export function EmptyTaskTable({ t, cols = 8 }: { t: TFn; cols?: number }) {
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
          <th>{t('taskRecurrenceFreq')}</th>
          <th>{t('taskMode')}</th>
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
  const [mode, setMode] = useState('')

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return tasks.filter((task) => {
      if (status && task.status !== status) return false
      if (priority && task.priority !== priority) return false
      if (mode && taskMode(task) !== mode) return false
      if (assignee === '__none__' && task.assigneeUserId) return false
      if (assignee && assignee !== '__none__' && task.assigneeUserId !== assignee) return false
      if (!term) return true
      return (
        task.title.toLowerCase().includes(term) ||
        (task.description || '').toLowerCase().includes(term)
      )
    })
  }, [tasks, q, status, priority, assignee, mode])

  const assigneeOptions = useMemo(() => {
    const ids = new Set<string>()
    for (const task of tasks) {
      if (task.assigneeUserId) ids.add(task.assigneeUserId)
    }
    return [...ids]
      .map((id) => memberById[id])
      .filter(Boolean) as MemberInfo[]
  }, [tasks, memberById])

  const priorityFilterOptions = useMemo<CrmIconSelectOption[]>(
    () => [
      {
        value: '',
        label: t('taskFilterAllPriority'),
        tone: 'all',
        icon: <SquaresFour size={14} weight="regular" aria-hidden />,
      },
      {
        value: 'low',
        label: t('taskPriorityLow'),
        tone: 'low',
        icon: <ArrowDown size={14} weight="bold" aria-hidden />,
      },
      {
        value: 'medium',
        label: t('taskPriorityMedium'),
        tone: 'medium',
        icon: <Minus size={14} weight="bold" aria-hidden />,
      },
      {
        value: 'high',
        label: t('taskPriorityHigh'),
        tone: 'high',
        icon: <ArrowUp size={14} weight="bold" aria-hidden />,
      },
    ],
    [t],
  )

  const modeFilterOptions = useMemo<CrmIconSelectOption[]>(
    () => [
      {
        value: '',
        label: t('taskFilterAllMode'),
        tone: 'all',
        icon: <SquaresFour size={14} weight="regular" aria-hidden />,
      },
      {
        value: 'once',
        label: t('taskModeOnce'),
        icon: <Circle size={14} weight="regular" aria-hidden />,
      },
      {
        value: 'recurring',
        label: t('taskModeRecurring'),
        tone: 'in_progress',
        icon: <ArrowsClockwise size={14} weight="bold" aria-hidden />,
      },
    ],
    [t],
  )

  const statusToggleItems = useMemo(
    () => [
      { id: '', label: t('filterAll'), icon: <SquaresFour size={14} weight="regular" aria-hidden /> },
      ...STATUS_FILTER_ORDER.map((s) => ({
        id: s,
        label: taskStatusLabel(s, t),
        icon: statusFilterIcon(s),
      })),
    ],
    [t],
  )

  const colSpan = showProject ? 9 : 8

  return (
    <div className={`stack task-table-wrap${compact ? ' is-compact' : ''}`}>
      {showFilters ? (
        <>
          <div
            className="product-archive-toggle task-status-toggle"
            role="tablist"
            aria-label={t('taskStatus')}
          >
            {statusToggleItems.map((item) => {
              const on = status === item.id
              return (
                <button
                  key={item.id || 'all'}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  data-status={item.id || 'all'}
                  className={`archive-seg project-scope-seg${on ? ' is-on' : ''}`}
                  onClick={() => setStatus(item.id)}
                >
                  {item.icon}
                  {item.label}
                </button>
              )
            })}
          </div>
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
              <div className="field task-filter-field">
                <CrmIconSelect
                  name="priority"
                  value={priority}
                  options={priorityFilterOptions}
                  onChange={setPriority}
                  aria-label={t('taskPriority')}
                />
              </div>
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
              <div className="field task-filter-field">
                <CrmIconSelect
                  name="mode"
                  value={mode}
                  options={modeFilterOptions}
                  onChange={setMode}
                  aria-label={t('taskMode')}
                />
              </div>
            </div>
          </div>
        </>
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
              <th>{t('taskRecurrenceFreq')}</th>
              <th>{t('taskMode')}</th>
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
              const isRule = task.source === 'rule'
              const reopenLabel =
                isRule && isDone && task.reopensAt
                  ? formatReopenCountdown(task.reopensAt, t)
                  : ''
              const toggleDisabled =
                !canWrite || !onToggleDone || task.status === 'blocked' || isRule
              const modeLabel =
                taskMode(task) === 'recurring' ? t('taskModeRecurring') : t('taskModeOnce')
              const rhythm = taskRhythmLabel(task, t)
              return (
                <tr
                  key={`${task.source || 'task'}-${task.id}`}
                  className={`product-table-row task-table-row${isOverdue ? ' is-overdue' : ''}${isDone ? ' is-done' : ''}${reopenLabel ? ' is-period-done' : ''}`}
                  onClick={() => onOpen(task)}
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
                    <span className="task-status-with-reopen">
                      <TaskStatusBadge status={task.status} t={t} />
                      {reopenLabel ? (
                        <span className="task-reopen-chip" title={reopenLabel}>
                          <ArrowsClockwise size={11} weight="bold" aria-hidden />
                          {reopenLabel}
                        </span>
                      ) : null}
                    </span>
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
                  <td className="muted">{rhythm}</td>
                  <td>
                    <span
                      className={`task-mode-chip${taskMode(task) === 'recurring' ? ' is-recurring' : ''}`}
                    >
                      {taskMode(task) === 'recurring' ? (
                        <ArrowsClockwise size={12} weight="bold" aria-hidden />
                      ) : (
                        <Circle size={12} weight="regular" aria-hidden />
                      )}
                      {modeLabel}
                    </span>
                  </td>
                </tr>
              )
            })}
            {emptyRows > 0 && filtered.length === 0
              ? Array.from({ length: emptyRows }).map((_, i) => (
                  <tr key={`e-${i}`} className="crm-empty-row" aria-hidden>
                    <td colSpan={colSpan}>&nbsp;</td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
