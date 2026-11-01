/**
 * BrandMark — BU monogram + optional wordmark (topbar / login).
 * Location: apps/web/src/components/BrandMark.tsx
 */
import { Link } from 'react-router-dom'
import { useI18n } from '../lib/i18n'

type Props = {
  /** Set false on login so the mark is not a navigation link. */
  to?: string | false
  showName?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function BrandMark({ to = '/', showName = true, size = 'sm' }: Props) {
  const { t } = useI18n()
  const inner = (
    <>
      <img
        className={`brand-mark brand-mark--${size}`}
        src="/brand/bu-mark.png"
        alt=""
        width={size === 'lg' ? 80 : size === 'md' ? 40 : 28}
        height={size === 'lg' ? 50 : size === 'md' ? 28 : 20}
        decoding="async"
      />
      {showName && <span className="brand-name">{t('brand')}</span>}
    </>
  )

  if (to !== false) {
    return (
      <Link to={to} className="brand" aria-label={t('brand')}>
        {inner}
      </Link>
    )
  }

  return (
    <div className="brand" aria-label={t('brand')}>
      {inner}
    </div>
  )
}
