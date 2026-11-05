/**
 * ProjectBoard — Dark-Ops kanban with status DnD, lane reorder, mode filter.
 * Location: apps/web/src/features/projects/ProjectBoard.tsx
 */
import { useMemo, useState } from 'react'
import { ArrowsClockwise, Circle, DotsSixVertical, Plus } from '@phosphor-icons/react'
import { CrmEmptyPreview } from '../../components/CrmEmptyPreview'
import { api } from '../../lib/api'
import type { MessageKey } from '../../i18n/messages'
import { MemberAvatar, type MemberInfo } from './MemberAvatar'
import { TaskPriorityBadge } from './TaskBadges'
import type { BuTask, BuTaskMode } from './projectTypes'
import {
  formatReopenCountdown,
  normalizeLaneOrder,
  taskStatusLabel,
  type TaskStatus,
} from './taskLabels'

type TFn = (k: MessageKey) => string
type MemberById = Record<string, MemberInfo>

type Props = {
  slug: string
  tasks: BuTask[]
  canWrite: boolean
  laneOrder: string[] | null | undefined
  memberById: MemberById
  t: TFn
  onOpenTask: (task: BuTask) => void
  onCreate: (status?: TaskStatus) => void
  onChanged: () => Promise<void>
  onLaneOrderChange: (order: TaskStatus[]) => Promise<void>
}

function taskMode(task: BuTask): BuTaskMode {
  return task.mode === 'recurring' ? 'recurring' : 'once'
}

function formatDue(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
}

export function ProjectBoard({
  slug,
  tasks,
  canWrite,
  laneOrder,
  memberById,
  t,
  onOpenTask,
  onCreate,
  onChanged,
  onLaneOrderChange,
}: Props) {
  const columns = useMemo(() => normalizeLaneOrder(laneOrder), [laneOrder])
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)
  const [draggingLane, setDraggingLane] = useState<string | null>(null)
  const [dropLane, setDropLane] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [modeFilter, setModeFilter] = useState('')

  const visibleTasks = useMemo(() => {
    if (!modeFilter) return tasks
    return tasks.filter((task) => taskMode(task) === modeFilter)
  }, [tasks, modeFilter])

  const byStatus = useMemo(() => {
    const m: Record<string, BuTask[]> = {}
    for (const col of columns) m[col] = []
    for (const task of visibleTasks) {
      const key = m[task.status] ? task.status : columns[0]!
      if (!m[key]) m[key] = []
      m[key]!.push(task)
    }
    for (const col of columns) {
      m[col] = [...(m[col] || [])].sort((a, b) => a.sortOrder - b.sortOrder)
    }
    return m
  }, [visibleTasks, columns])

  async function moveTask(taskId: string, status: TaskStatus, insertIndex: number) {
    if (!canWrite || busy) return
    const task = visibleTasks.find((x) => x.id === taskId)
    if (!task || task.source === 'rule') return
    const laneTasks = (byStatus[status] || []).filter((x) => x.id !== taskId)
    const nextSort = insertIndex <= 0 ? 0 : insertIndex >= laneTasks.length ? laneTasks.length : insertIndex
    // Reindex lane: place task at nextSort
    const reordered = [...laneTasks]
    reordered.splice(nextSort, 0, { ...task, status, sortOrder: nextSort })
    setBusy(true)
    try {
      await api(`/api/b/${slug}/tasks/${taskId}/status`, {
        method: 'POST',
        body: JSON.stringify({
          status,
          version: task.version,
          sortOrder: nextSort * 10,
        }),
      })
      // Soft-reindex siblings so order sticks across reloads
      await Promise.all(
        reordered.map((item, i) => {
          if (item.id === taskId) return Promise.resolve()
          return api(`/api/b/${slug}/tasks/${item.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ sortOrder: i * 10, version: item.version }),
          }).catch(() => undefined)
        }),
      )
      await onChanged()
    } finally {
      setBusy(false)
      setDraggingTaskId(null)
      setDropLane(null)
    }
  }

  async function reorderLanes(from: string, to: string) {
    if (!canWrite || from === to || busy) return
    const next = [...columns]
    const fromIdx = next.indexOf(from as TaskStatus)
    const toIdx = next.indexOf(to as TaskStatus)
    if (fromIdx < 0 || toIdx < 0) return
    next.splice(fromIdx, 1)
    next.splice(toIdx, 0, from as TaskStatus)
    setBusy(true)
    try {
      await onLaneOrderChange(next)
    } finally {
      setBusy(false)
      setDraggingLane(null)
    }
  }

  const empty = visibleTasks.length === 0

  const board = (
    <div className="stack">
      <div
        className="product-archive-toggle project-board-mode-bar"
        role="tablist"
        aria-label={t('taskMode')}
      >
        {(
          [
            { id: '', label: t('taskFilterAllMode') },
            { id: 'once', label: t('taskModeOnce') },
            { id: 'recurring', label: t('taskModeRecurring') },
          ] as const
        ).map((opt) => {
          const on = modeFilter === opt.id
          return (
            <button
              key={opt.id || 'all'}
              type="button"
              role="tab"
              aria-selected={on}
              className={`archive-seg project-scope-seg${on ? ' is-on' : ''}`}
              onClick={() => setModeFilter(opt.id)}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    <div className={`project-board${empty ? ' project-board-empty' : ''}`}>
      {columns.map((col) => {
        const laneTasks = byStatus[col] || []
        return (
          <div
            key={col}
            className={`project-board-col${dropLane === col ? ' is-drop' : ''}${draggingLane === col ? ' is-lane-drag' : ''}`}
            data-lane={col}
            onDragOver={(e) => {
              e.preventDefault()
              if (draggingTaskId) setDropLane(col)
            }}
            onDrop={async (e) => {
              e.preventDefault()
              const laneFrom = e.dataTransfer.getData('text/lane')
              if (laneFrom) {
                await reorderLanes(laneFrom, col)
                return
              }
              const tid = e.dataTransfer.getData('text/task')
              if (tid) await moveTask(tid, col, laneTasks.length)
            }}
          >
            <div
              className="project-board-col-head"
              draggable={canWrite}
              title={t('boardReorderLane')}
              onDragStart={(e) => {
                if (!canWrite) return
                setDraggingLane(col)
                e.dataTransfer.setData('text/lane', col)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragEnd={() => setDraggingLane(null)}
            >
              {canWrite ? (
                <DotsSixVertical size={14} weight="bold" className="project-board-grip" aria-hidden />
              ) : null}
              <strong>{taskStatusLabel(col, t)}</strong>
              <span className="project-board-count">{laneTasks.length}</span>
            </div>

            {empty ? (
              <>
                <div className="project-board-slot" />
                <div className="project-board-slot" />
              </>
            ) : (
              laneTasks.map((task, idx) => {
                const member = task.assigneeUserId ? memberById[task.assigneeUserId] : null
                const due = formatDue(task.dueAt)
                const overdue =
                  Boolean(task.dueAt) &&
                  new Date(task.dueAt!).getTime() < Date.now() &&
                  task.status !== 'done'
                const isRule = task.source === 'rule'
                const reopenLabel =
                  isRule && task.status === 'done' && task.reopensAt
                    ? formatReopenCountdown(task.reopensAt, t)
                    : ''
                const modeLabel =
                  taskMode(task) === 'recurring' ? t('taskModeRecurring') : t('taskModeOnce')
                return (
                  <button
                    key={`${task.source || 'task'}-${task.id}`}
                    type="button"
                    className={`project-board-card${draggingTaskId === task.id ? ' is-dragging' : ''}${overdue ? ' is-overdue' : ''}${reopenLabel ? ' is-period-done' : ''}`}
                    data-prio={task.priority}
                    data-mode={taskMode(task)}
                    draggable={canWrite && !isRule}
                    onDragStart={(e) => {
                      if (isRule) return
                      setDraggingTaskId(task.id)
                      e.dataTransfer.setData('text/task', task.id)
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    onDragEnd={() => {
                      setDraggingTaskId(null)
                      setDropLane(null)
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setDropLane(col)
                    }}
                    onDrop={async (e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      const tid = e.dataTransfer.getData('text/task')
                      if (tid) await moveTask(tid, col, idx)
                    }}
                    onClick={() => onOpenTask(task)}
                  >
                    <span className="project-board-card-title">{task.title}</span>
                    <span className="project-board-card-meta">
                      <TaskPriorityBadge priority={task.priority} t={t} />
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
                      {reopenLabel ? (
                        <span className="task-reopen-chip" title={reopenLabel}>
                          <ArrowsClockwise size={11} weight="bold" aria-hidden />
                          {reopenLabel}
                        </span>
                      ) : due ? (
                        <span className={`project-board-due${overdue ? ' is-overdue' : ''}`}>
                          {due}
                        </span>
                      ) : null}
                      <span className="project-board-card-spacer" aria-hidden />
                      {member ? <MemberAvatar member={member} size={20} /> : null}
                    </span>
                  </button>
                )
              })
            )}

            {canWrite ? (
              <>
                <button
                  type="button"
                  className="btn project-board-add"
                  onClick={() => onCreate(col)}
                >
                  <Plus size={12} weight="bold" aria-hidden />
                  {t('taskCreate')}
                </button>
                {!empty ? (
                  <div
                    className="project-board-drop"
                    aria-label={t('boardDropHint')}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDropLane(col)
                    }}
                    onDrop={async (e) => {
                      e.preventDefault()
                      const tid = e.dataTransfer.getData('text/task')
                      if (tid) await moveTask(tid, col, laneTasks.length)
                    }}
                  />
                ) : null}
              </>
            ) : null}
          </div>
        )
      })}
    </div>
    </div>
  )

  if (tasks.length === 0) {
    return (
      <CrmEmptyPreview
        canWrite={canWrite}
        ctaLabel={t('taskCreateFirst')}
        hint={t('taskEmptyHint')}
        onCta={() => onCreate('open')}
      >
        {board}
      </CrmEmptyPreview>
    )
  }

  return board
}
