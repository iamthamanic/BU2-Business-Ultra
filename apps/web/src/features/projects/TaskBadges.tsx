/**
 * TaskStatusBadge / TaskPriorityBadge — Dark-Ops semantic tones.
 * Location: apps/web/src/features/projects/TaskBadges.tsx
 */
import type { MessageKey } from '../../i18n/messages'
import { projectStatusLabel, taskPriorityLabel, taskStatusLabel } from './taskLabels'

type TFn = (k: MessageKey) => string

export function TaskStatusBadge({ status, t }: { status: string; t: TFn }) {
  return (
    <span className={`crm-status crm-status--${status}`}>{taskStatusLabel(status, t)}</span>
  )
}

export function TaskPriorityBadge({ priority, t }: { priority: string; t: TFn }) {
  return (
    <span className={`task-prio task-prio--${priority}`}>{taskPriorityLabel(priority, t)}</span>
  )
}

export function ProjectStatusBadge({ status, t }: { status: string; t: TFn }) {
  return (
    <span className={`crm-status crm-status--${status}`}>{projectStatusLabel(status, t)}</span>
  )
}
