/**
 * BizLogo — company logo thumbnail or initials fallback for list/switcher rows.
 * Always constrains <img> to the box (custom classNames must set width/height).
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
  fit = 'contain',
}: {
  name: string
  logoPath?: string | null
  className?: string
  /** How the image fills the box — contain for brand marks, cover for avatars. */
  fit?: 'contain' | 'cover'
}) {
  if (logoPath) {
    return (
      <span className={`${className} has-img`}>
        <img
          src={logoPath}
          alt=""
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: fit, display: 'block' }}
        />
      </span>
    )
  }
  return <span className={className}>{initials(name)}</span>
}
