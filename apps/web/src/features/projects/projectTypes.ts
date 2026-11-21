/**
 * Projects/tasks client types — derived from @bu2/shared DTOs — plus small shared task/date helpers.
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

export function taskMode(task: BuTask): BuTaskMode {
  return task.mode === 'recurring' ? 'recurring' : 'once'
}

/** `<input type="date">` value → ISO at 09:00 local (project start/due). */
export function dateToIso(v: string): string | null {
  if (!v.trim()) return null
  const d = new Date(`${v.trim()}T09:00:00`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** `<input type="date">` value → ISO at 17:00 local (task due). */
export function dueAtFromDateInput(v: string): string | null {
  if (!v.trim()) return null
  const d = new Date(`${v.trim()}T17:00:00`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
