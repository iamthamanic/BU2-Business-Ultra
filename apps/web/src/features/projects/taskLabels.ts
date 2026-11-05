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

const FREQ_KEYS: Record<string, MessageKey> = {
  hourly: 'freqHourly',
  daily: 'freqDaily',
  weekly: 'freqWeekly',
  monthly: 'freqMonthly',
  yearly: 'freqYearly',
}

const WEEKDAY_KEYS: MessageKey[] = [
  'weekdaySun',
  'weekdayMon',
  'weekdayTue',
  'weekdayWed',
  'weekdayThu',
  'weekdayFri',
  'weekdaySat',
]

/** Human rhythm label for recurrence rule rows (e.g. "Wöchentlich · Montag"). */
export function taskRhythmLabel(
  task: { freq?: string | null; weekday?: number | null; monthDay?: number | null },
  t: TFn,
): string {
  const freq = task.freq
  if (!freq) return '—'
  const baseKey = FREQ_KEYS[freq]
  const base = baseKey ? t(baseKey) : freq
  if (freq === 'weekly' && task.weekday != null && task.weekday >= 0 && task.weekday <= 6) {
    return `${base} · ${t(WEEKDAY_KEYS[task.weekday]!)}`
  }
  if ((freq === 'monthly' || freq === 'yearly') && task.monthDay != null) {
    return `${base} · ${task.monthDay}.`
  }
  return base
}

/** Countdown until a completed recurring period becomes open again. */
export function formatReopenCountdown(iso: string | null | undefined, t: TFn): string {
  if (!iso) return ''
  const ms = new Date(iso).getTime() - Date.now()
  if (Number.isNaN(ms)) return ''
  if (ms <= 0) return t('taskReopensSoon')
  const mins = Math.max(1, Math.ceil(ms / 60_000))
  if (mins < 60) return t('taskReopensInMinutes').replace('{n}', String(mins))
  const hours = Math.floor(mins / 60)
  const remMins = mins % 60
  if (hours < 48) {
    if (remMins === 0 || hours >= 24) {
      return t('taskReopensInHours').replace('{n}', String(hours))
    }
    return t('taskReopensInHoursMins')
      .replace('{h}', String(hours))
      .replace('{m}', String(remMins))
  }
  const days = Math.ceil(ms / 86_400_000)
  return t('taskReopensInDays').replace('{n}', String(days))
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
