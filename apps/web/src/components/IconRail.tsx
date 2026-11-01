/**
 * IconRail / Sidebar — legacy-parity collapsible left nav (slim icons ↔ expanded labels).
 * Logo + brand at top; admin/lang/logout in footer. Mobile: overlay drawer.
 * Location: apps/web/src/components/IconRail.tsx
 */
import { useEffect, useState } from 'react'
import type { Icon } from '@phosphor-icons/react'
import { CaretDown, SignOut, ShieldCheck } from '@phosphor-icons/react'
import { NavLink } from 'react-router-dom'
import { BrandMark } from './BrandMark'
import { useI18n } from '../lib/i18n'

export type RailItem = {
  key: string
  to: string
  end?: boolean
  label: string
  icon: Icon
}

const SB_SLIM_KEY = 'sb_slim'

function readSlim(): boolean {
  try {
    const v = localStorage.getItem(SB_SLIM_KEY)
    // Legacy default: slim unless explicitly "0"
    if (v === null) return true
    return v !== '0'
  } catch {
    return true
  }
}

type Props = {
  items: RailItem[]
  /** Mobile overlay open */
  open: boolean
  onNavigate?: () => void
  onCloseMobile?: () => void
  label: string
  showAdmin?: boolean
  onLogout?: () => void
}

const ICON_WEIGHT = 'regular' as const
const ICON_SIZE = 18

export function IconRail({
  items,
  open,
  onNavigate,
  onCloseMobile,
  label,
  showAdmin,
  onLogout,
}: Props) {
  const { t, locale, setLocale } = useI18n()
  const [slim, setSlim] = useState(readSlim)

  useEffect(() => {
    try {
      localStorage.setItem(SB_SLIM_KEY, slim ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [slim])

  function toggleSlim() {
    setSlim((s) => !s)
  }

  const expanded = !slim || open

  return (
    <aside
      className={`sidebar${slim ? ' slim' : ''}${open ? ' open' : ''}`}
      aria-label={label}
      data-expanded={expanded ? 'true' : 'false'}
    >
      <div className="sb-head">
        <BrandMark to="/" showName={!slim || open} size="sm" />
        <button
          type="button"
          className="sb-toggle"
          onClick={toggleSlim}
          aria-expanded={!slim}
          aria-controls="sb-nav"
          title={slim ? t('expandSidebar') : t('collapseSidebar')}
        >
          <CaretDown className="sb-toggle-chevron" size={14} weight="bold" aria-hidden />
        </button>
        {onCloseMobile && (
          <button type="button" className="sb-drawer-close btn" onClick={onCloseMobile}>
            {t('closeMenu')}
          </button>
        )}
      </div>

      <nav className="sb-nav" id="sb-nav">
        {items.map((item) => {
          const Glyph = item.icon
          return (
            <NavLink
              key={item.key}
              to={item.to}
              end={item.end}
              title={item.label}
              aria-label={item.label}
              className={({ isActive }) => `sb-item${isActive ? ' active' : ''}`}
              onClick={onNavigate}
            >
              <span className="sb-ic" aria-hidden>
                <Glyph size={ICON_SIZE} weight={ICON_WEIGHT} />
              </span>
              <span className="sb-label">{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      <div className="sb-foot">
        {showAdmin && (
          <NavLink
            to="/admin"
            title={t('admin')}
            aria-label={t('admin')}
            className={({ isActive }) => `sb-item${isActive ? ' active' : ''}`}
            data-ic="admin"
            onClick={onNavigate}
          >
            <span className="sb-ic" aria-hidden>
              <ShieldCheck size={ICON_SIZE} weight={ICON_WEIGHT} />
            </span>
            <span className="sb-label">{t('admin')}</span>
          </NavLink>
        )}

        <div className="sb-item sb-lang" title={t('language')}>
          <span className="sb-ic sb-lang-ic" aria-hidden>
            {locale.toUpperCase()}
          </span>
          <label className="sb-label sb-lang-label">
            <span className="sr-only">{t('language')}</span>
            <select
              className="sb-lang-select"
              value={locale}
              onChange={(e) => setLocale(e.target.value as 'de' | 'en')}
              aria-label={t('language')}
            >
              <option value="de">Deutsch</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>

        {onLogout && (
          <button
            type="button"
            className="sb-item"
            data-ic="logout"
            onClick={() => {
              onNavigate?.()
              onLogout()
            }}
            title={t('logout')}
          >
            <span className="sb-ic" aria-hidden>
              <SignOut size={ICON_SIZE} weight={ICON_WEIGHT} />
            </span>
            <span className="sb-label">{t('logout')}</span>
          </button>
        )}
      </div>
    </aside>
  )
}
