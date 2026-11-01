/**
 * SettingsHeader — company logo, name, status strip (Metricool / SEO / Email / Funnel).
 * Location: apps/web/src/features/settings/SettingsHeader.tsx
 */
import { BizLogo } from '../../components/BizLogo'
import { useI18n } from '../../lib/i18n'
import type { SettingsTab } from './settingsTabs'

export type SettingsStatus = {
  metricool: { ok: boolean; brands: number }
  seo: { ok: boolean }
  email: { ok: boolean }
  funnel: { ok: boolean; surfaces: number }
}

type Props = {
  name: string
  slug: string
  logoPath?: string | null
  status: SettingsStatus | null
  companyStatus: string
  onJump: (tab: SettingsTab) => void
}

export function SettingsHeader({ name, slug, logoPath, status, companyStatus, onJump }: Props) {
  const { t } = useI18n()
  const active = companyStatus === 'active'

  return (
    <header className="co-settings-hero">
      <BizLogo name={name} logoPath={logoPath} className="co-settings-logo" />
      <div className="co-settings-hero-text">
        <div className="co-settings-hero-topline">
          <h1 className="page-title" style={{ margin: 0 }}>
            {name}
          </h1>
          <span className={`badge ${active ? 'ok' : 'warn'}`}>
            {active ? t('statusActive') : t('statusArchived')}
          </span>
        </div>
        <p className="muted kpi" style={{ margin: '2px 0 0' }}>
          {slug}
        </p>
      </div>

      <div className="co-settings-status-strip" role="list" aria-label={t('connectionStatus')}>
        <StatusChip
          label="Metricool"
          ok={!!status?.metricool.ok}
          meta={
            status
              ? `${status.metricool.brands} ${status.metricool.brands === 1 ? t('brandSingular') : t('brandPlural')}`
              : '…'
          }
          onClick={() => onJump('connections')}
        />
        <StatusChip
          label="OpenSEO"
          ok={!!status?.seo.ok}
          meta={status?.seo.ok ? t('statusConnected') : t('statusOpen')}
          onClick={() => onJump('connections')}
        />
        <StatusChip
          label={t('emailShort')}
          ok={!!status?.email.ok}
          meta={status?.email.ok ? t('statusConnected') : t('statusOpen')}
          onClick={() => onJump('connections')}
        />
        <StatusChip
          label="Funnel"
          ok={!!status?.funnel.ok}
          meta={status ? `${status.funnel.surfaces} Surfaces` : '…'}
          onClick={() => onJump('funnel')}
        />
      </div>
    </header>
  )
}

function StatusChip({
  label,
  ok,
  meta,
  onClick,
}: {
  label: string
  ok: boolean
  meta: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`co-status-chip ${ok ? 'ok' : ''}`}
      role="listitem"
      onClick={onClick}
    >
      <span className="co-status-dot" aria-hidden="true" />
      <span className="co-status-chip-text">
        <span className="co-status-chip-label">{label}</span>
        <span className="co-status-chip-meta">{meta}</span>
      </span>
    </button>
  )
}
