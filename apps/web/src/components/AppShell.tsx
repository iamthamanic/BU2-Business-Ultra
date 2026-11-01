/**
 * AppShell — legacy-parity chrome: collapsible sidebar + header context chip bar.
 * Brand lives in sidebar; account/logout/lang in sidebar footer; topbar = context + user.
 * Location: apps/web/src/components/AppShell.tsx
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { List, X } from '@phosphor-icons/react'
import { IconRail, type RailItem } from './IconRail'
import { useI18n } from '../lib/i18n'
import type { AuthUser } from '../app/App'

type Props = {
  user: AuthUser
  railItems: RailItem[]
  subtitle?: ReactNode
  showAdmin?: boolean
  onLogout?: () => void
  children: ReactNode
}

export function AppShell({
  user,
  railItems,
  subtitle,
  showAdmin,
  onLogout,
  children,
}: Props) {
  const { t } = useI18n()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const contentId = useId()
  const toggleRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!drawerOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDrawerOpen(false)
        toggleRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  const admin =
    showAdmin ?? (user.isSuperadmin || user.isBreakglassOperator)

  return (
    <div className="shell-root">
      <header className="topbar">
        <div className="topbar-start">
          <button
            ref={toggleRef}
            type="button"
            className="btn icon-btn rail-toggle"
            onClick={() => setDrawerOpen(true)}
            aria-label={t('openMenu')}
            aria-expanded={drawerOpen}
            aria-controls="sb-nav"
          >
            {drawerOpen ? <X size={18} weight="regular" /> : <List size={18} weight="regular" />}
          </button>
          {subtitle ? (
            <div className="hdr-chip hdr-context" title={typeof subtitle === 'string' ? subtitle : undefined}>
              <span className="hdr-chip-kicker">{t('workspaceHome')}</span>
              <span className="hdr-chip-value">{subtitle}</span>
            </div>
          ) : null}
        </div>
        <div className="hdr-toolbar">
          <span className="hdr-chip" title={user.email}>
            <strong>{user.displayName || user.email}</strong>
            {(user.isSuperadmin || user.isBreakglassOperator) && (
              <span className="hdr-chip-sep">
                {user.isSuperadmin ? 'sa' : 'bg'}
              </span>
            )}
          </span>
        </div>
      </header>

      <div className="shell">
        <div
          className={`rail-backdrop ${drawerOpen ? 'open' : ''}`}
          onClick={() => setDrawerOpen(false)}
          aria-hidden={!drawerOpen}
        />
        <IconRail
          items={railItems}
          open={drawerOpen}
          onNavigate={() => setDrawerOpen(false)}
          onCloseMobile={() => setDrawerOpen(false)}
          label={t('navMain')}
          showAdmin={admin}
          onLogout={onLogout}
        />
        <div className="main">
          <div className="content enter-fade" id={contentId}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
