/**
 * MemberAvatar — initials from displayName|email (no photo field on members).
 * Location: apps/web/src/features/projects/MemberAvatar.tsx
 */
export type MemberInfo = {
  userId: string
  email: string
  displayName: string | null
}

export function memberDisplayName(m: MemberInfo | undefined | null, fallback = '—'): string {
  if (!m) return fallback
  return m.displayName?.trim() || m.email || fallback
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
}

type Props = {
  member?: MemberInfo | null
  label?: string
  size?: number
  className?: string
  title?: string
}

export function MemberAvatar({ member, label, size = 24, className = '', title }: Props) {
  const text = label || memberDisplayName(member, '?')
  const initials = initialsFrom(text === '—' || text === '?' ? '?' : text)
  return (
    <span
      className={`member-av ${className}`.trim()}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.38)) }}
      title={title || text}
      aria-hidden={title ? undefined : true}
    >
      {initials}
    </span>
  )
}
