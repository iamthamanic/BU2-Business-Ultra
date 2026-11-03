/**
 * Localized task/project status & priority labels (never snake_case in UI).
 * Location: apps/web/src/features/projects/taskLabels.ts
 */
import type { MessageKey } from '../../i18n/messages'

export const TASK_STATUSES = ['open', 'in_progress', 'blocked', 'done'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const DEFAULT_BOARD_LANE_ORDER: TaskStatus[] = [
  'open',
  'in_progress',
  'blocked',
  'done',
]

export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

export const PROJECT_STATUSES = ['planned', 'active', 'done'] as const

const TASK_STATUS_KEYS: Record<TaskStatus, MessageKey> = {
  open: 'taskStatusOpen',
  in_progress: 'taskStatusInProgress',
  blocked: 'taskStatusBlocked',
  done: 'taskStatusDone',
}

const TASK_PRIORITY_KEYS: Record<TaskPriority, MessageKey> = {
  low: 'taskPriorityLow',
  medium: 'taskPriorityMedium',
  high: 'taskPriorityHigh',
}

const PROJECT_STATUS_KEYS: Record<string, MessageKey> = {
  planned: 'projectStatusPlanned',
  active: 'projectStatusActive',
  done: 'projectStatusDone',
}

type TFn = (k: MessageKey) => string

export function taskStatusLabel(status: string, t: TFn): string {
  const key = TASK_STATUS_KEYS[status as TaskStatus]
  return key ? t(key) : status
}

export function taskPriorityLabel(priority: string, t: TFn): string {
  const key = TASK_PRIORITY_KEYS[priority as TaskPriority]
  return key ? t(key) : priority
}

export function projectStatusLabel(status: string, t: TFn): string {
  const key = PROJECT_STATUS_KEYS[status]
  return key ? t(key) : status
}

export function normalizeLaneOrder(raw: string[] | null | undefined): TaskStatus[] {
  const seen = new Set<string>()
  const out: TaskStatus[] = []
  for (const s of raw || []) {
    if ((TASK_STATUSES as readonly string[]).includes(s) && !seen.has(s)) {
      seen.add(s)
      out.push(s as TaskStatus)
    }
  }
  for (const s of DEFAULT_BOARD_LANE_ORDER) {
    if (!seen.has(s)) out.push(s)
  }
  return out
}
