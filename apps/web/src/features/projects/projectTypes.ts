/**
 * Projects/tasks client types. Location: apps/web/src/features/projects/projectTypes.ts
 */
export type BuProjectStats = {
  total: number
  done: number
  open: number
  overdue: number
}

export type BuProject = {
  id: string
  type: 'area' | 'custom' | string
  name: string
  description: string
  area: string | null
  ownerUserId: string | null
  memberUserIds?: string[]
  status: string
  startAt: string | null
  dueAt: string | null
  parentAreaProjectId: string | null
  boardLaneOrder: string[] | null
  archivedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  stats?: BuProjectStats
}

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
  taskId: string
  filename: string
  mimeType: string
  sizeBytes: number
  url: string
  createdByUserId: string | null
  createdAt: string
}

export type BuTask = {
  id: string
  projectId: string | null
  customerId: string | null
  title: string
  description: string
  status: string
  priority: string
  assigneeUserId: string | null
  dueAt: string | null
  sortOrder: number
  version: number
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

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
  nextAt: string
}
