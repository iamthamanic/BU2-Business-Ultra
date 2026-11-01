/**
 * IconRail / Sidebar — legacy-parity collapsible left nav (slim icons ↔ expanded labels).
 * Supports grouped funnel sections (details) with session persistence; collapse toggle in head;
 * settings/admin/lang/logout in footer. Brand lives in topbar. Mobile: overlay drawer.
 * Location: apps/web/src/components/IconRail.tsx
 */
import { useEffect, useState } from 'react'
import type { Icon } from '@phosphor-icons/react'
import { CaretDown, SignOut, ShieldCheck } from '@phosphor-icons/react'
import { NavLink, useLocation } from 'react-router-dom'
import { useI18n } from '../lib/i18n'

export type RailItem = {
  key: string
  to: string
  end?: boolean
  label: string
  icon: Icon
  /** Legacy data-ic brand color key */
  dataIc?: string
}

export type RailGroup = {
  id: string
  label: string
  items: RailItem[]
}

const SB_SLIM_KEY = 'sb_slim'
const SB_GROUP_KEY = 'bu.sidebar.groups.v1'

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

function readGroupOpen(id: string, fallback: boolean): boolean {
  try {
    const m = JSON.parse(sessionStorage.getItem(SB_GROUP_KEY) || '{}') as Record<string, boolean>
    if (typeof m[id] === 'boolean') return m[id]!
  } catch {
    /* ignore */
  }
  return fallback
}

function writeGroupOpen(id: string, open: boolean) {
  try {
    const m = JSON.parse(sessionStorage.getItem(SB_GROUP_KEY) || '{}') as Record<string, boolean>
    m[id] = open
    sessionStorage.setItem(SB_GROUP_KEY, JSON.stringify(m))
  } catch {
    /* ignore */
  }
}

function pathMatches(pathname: string, to: string, end?: boolean) {
  if (end) return pathname === to
  return pathname === to || pathname.startsWith(`${to}/`)
}

type Props = {
  items?: RailItem[]
  groups?: RailGroup[]
  /** Settings link shown in footer (legacy Verwaltung position) */
  settingsItem?: RailItem | null
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

function RailLink({
  item,
  onNavigate,
}: {
  item: RailItem
  onNavigate?: () => void
}) {
  const Glyph = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={item.label}
      aria-label={item.label}
      data-ic={item.dataIc || item.key}
      className={({ isActive }) => `sb-item${isActive ? ' active' : ''}`}
      onClick={onNavigate}
    >
      <span className="sb-ic" aria-hidden>
        <Glyph size={ICON_SIZE} weight={ICON_WEIGHT} />
      </span>
      <span className="sb-label">{item.label}</span>
    </NavLink>
  )
}

function GroupBlock({
  group,
  onNavigate,
}: {
  group: RailGroup
  onNavigate?: () => void
}) {
  const location = useLocation()
  const childActive = group.items.some((it) => pathMatches(location.pathname, it.to, it.end))
  const [open, setOpen] = useState(() => readGroupOpen(group.id, childActive))

  useEffect(() => {
    if (childActive) setOpen(true)
  }, [childActive, location.pathname])

  return (
    <details
      className="sb-group"
      open={open}
      data-sb-group={group.id}
      onToggle={(e) => {
        const next = (e.currentTarget as HTMLDetailsElement).open
        setOpen(next)
        writeGroupOpen(group.id, next)
      }}
    >
      <summary className="sb-group-title">
        <span className="sb-toggle-arrow" aria-hidden>
          ▸
        </span>
        {group.label}
      </summary>
      {group.items.map((item) => (
        <RailLink key={item.key} item={item} onNavigate={onNavigate} />
      ))}
    </details>
  )
}

export function IconRail({
  items = [],
  groups = [],
  settingsItem,
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
        {items.map((item) => (
          <RailLink key={item.key} item={item} onNavigate={onNavigate} />
        ))}
        {groups.map((g) => (
          <GroupBlock key={g.id} group={g} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="sb-foot">
        {settingsItem ? <RailLink item={settingsItem} onNavigate={onNavigate} /> : null}
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
