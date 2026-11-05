/**
 * Projects/tasks client types — derived from @bu2/shared DTOs.
 * Location: apps/web/src/features/projects/projectTypes.ts
 */
import type {
  ProjectDto,
  ProjectStatsDto,
  TaskDto,
  TaskReminder,
} from '@bu2/shared'

export type BuProjectStats = ProjectStatsDto
export type BuProject = ProjectDto

export type BuProjectEvent = {
  id: string
  projectId: string
  type: string
  summary: string
  actorUserId: string | null
  actorDisplayName: string | null
  meta: Record<string, unknown>
  createdAt: string
}

export type BuTaskAttachment = {
  id: string
  taskId?: string | null
  ruleId?: string | null
  filename: string
  mimeType: string
  sizeBytes: number
  url: string
  createdByUserId: string | null
  createdAt: string
}

export type BuTaskReminder = TaskReminder
export type BuTaskMode = NonNullable<TaskDto['mode']>
export type BuTask = TaskDto

export type BuRecurrenceRule = {
  id: string
  projectId: string | null
  customerId: string | null
  title: string
  description: string
  priority: string
  assigneeUserId: string | null
  freq: string
  weekday: number | null
  monthDay: number | null
  timezone: string
  startsAt: string
  endsAt: string | null
  pausedAt: string | null
  lastCompletedAt?: string | null
  nextAt: string
  reminders?: BuTaskReminder[]
}
