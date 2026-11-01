/**
 * AppShell — legacy-parity chrome: collapsible sidebar + header context chip bar.
 * Logo-only BrandMark left in the topbar; wordmark lives in sidebar sb-head;
 * company shown as context text (switcher lives in Settings); account chip right.
 * Location: apps/web/src/components/AppShell.tsx
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { List, X } from '@phosphor-icons/react'
import { BrandMark } from './BrandMark'
import { IconRail, type RailGroup, type RailItem } from './IconRail'
import { useI18n } from '../lib/i18n'
import type { AuthUser } from '../app/App'

type CompanyCtx = {
  slug: string
  name: string
  logoPath?: string | null
  status?: string
}

type Props = {
  user: AuthUser
  railItems: RailItem[]
  railGroups?: RailGroup[]
  settingsItem?: RailItem | null
  /** Static subtitle chip (home/admin). Company pages use `company` instead. */
  subtitle?: ReactNode
  company?: CompanyCtx | null
  showAdmin?: boolean
  onLogout?: () => void
  children: ReactNode
}

export function AppShell({
  user,
  railItems,
  railGroups,
  settingsItem,
  subtitle,
  company,
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

  const contextLabel = company?.name || company?.slug
  const contextTitle =
    company?.name && company?.slug
      ? `${company.name} (${company.slug})`
      : typeof subtitle === 'string'
        ? subtitle
        : undefined

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
          <BrandMark to="/" showName={false} size="sm" />
          {contextLabel ? (
            <div className="hdr-chip hdr-context" title={contextTitle}>
              <span className="hdr-chip-kicker">{t('company')}</span>
              <span className="hdr-chip-value">{contextLabel}</span>
            </div>
          ) : subtitle ? (
            <div className="hdr-chip hdr-context" title={typeof subtitle === 'string' ? subtitle : undefined}>
              <span className="hdr-chip-kicker">{t('workspaceHome')}</span>
              <span className="hdr-chip-value">{subtitle}</span>
            </div>
          ) : null}
          {company?.status === 'archived' ? <span className="badge warn">archived</span> : null}
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
          groups={railGroups}
          settingsItem={settingsItem}
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
