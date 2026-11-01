/**
 * BizLogo — company logo thumbnail or initials fallback for list/switcher rows.
 * Location: apps/web/src/components/BizLogo.tsx
 */
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
}

export function BizLogo({
  name,
  logoPath,
  className = 'biz-logo',
}: {
  name: string
  logoPath?: string | null
  className?: string
}) {
  if (logoPath) {
    return (
      <span className={`${className} has-img`}>
        <img src={logoPath} alt="" />
      </span>
    )
  }
  return <span className={className}>{initials(name)}</span>
}
