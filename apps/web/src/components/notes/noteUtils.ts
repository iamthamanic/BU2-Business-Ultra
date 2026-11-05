/**
 * Shared helpers for note / comment cards (Kunden + Tasks).
 * Location: apps/web/src/components/notes/noteUtils.ts
 */

export function noteInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
}

export function formatNoteWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export type ThreadNote = {
  id: string
  body: string
  createdAt: string
  updatedAt?: string | null
  authorDisplayName?: string | null
  authorUserId?: string | null
}
