/**
 * SettingsOverviewTab — connection summary cards + archive / delete danger zone.
 * Location: apps/web/src/features/settings/SettingsOverviewTab.tsx
 */
import { useState } from 'react'
import { useI18n } from '../../lib/i18n'
import type { SettingsStatus } from './SettingsHeader'
import type { SettingsTab } from './settingsTabs'

type Props = {
  slug: string
  name: string
  status: SettingsStatus | null
  companyStatus: string
  memberCount: number
  msg: string
  onJump: (tab: SettingsTab) => void
  onArchive: () => void
  onReactivate: () => void
  onDelete: (confirmSlug: string) => void | Promise<void>
}

export function SettingsOverviewTab({
  slug,
  name,
  status,
  companyStatus,
  memberCount,
  msg,
  onJump,
  onArchive,
  onReactivate,
  onDelete,
}: Props) {
  const { t } = useI18n()
  const archived = companyStatus === 'archived'
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmSlug, setConfirmSlug] = useState('')
  const [deleting, setDeleting] = useState(false)
  const canDelete = confirmSlug.trim() === slug

  async function confirmDelete() {
    if (!canDelete || deleting) return
    setDeleting(true)
    try {
      await onDelete(confirmSlug.trim())
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="stack">
      <div className="co-overview-grid">
        <OverviewCard
          title="Metricool"
          ok={!!status?.metricool.ok}
          status={status?.metricool.ok ? t('statusConnected') : t('statusNotConnected')}
          hint={t('overviewMetricoolHint')}
          onClick={() => onJump('connections')}
          cta={t('openTab')}
        />
        <OverviewCard
          title="OpenSEO"
          ok={!!status?.seo.ok}
          status={status?.seo.ok ? t('statusConnected') : t('statusNotConnected')}
          hint={t('overviewSeoHint')}
          onClick={() => onJump('connections')}
          cta={t('openTab')}
        />
        <OverviewCard
          title={t('emailMarketing')}
          ok={!!status?.email.ok}
          status={status?.email.ok ? t('statusConnected') : t('statusNotConnected')}
          hint={t('overviewEmailHint')}
          onClick={() => onJump('connections')}
          cta={t('openTab')}
        />
        <OverviewCard
          title={t('funnelAssignment')}
          ok={!!status?.funnel.ok}
          status={status?.funnel.ok ? t('statusConfigured') : t('statusCheck')}
          hint={t('overviewFunnelHint')}
          onClick={() => onJump('funnel')}
          cta={t('openTab')}
        />
        <OverviewCard
          title={t('team')}
          ok={memberCount > 0}
          status={`${memberCount} ${t('members')}`}
          hint={t('overviewTeamHint')}
          onClick={() => onJump('team')}
          cta={t('openTab')}
        />
      </div>

      <section className="panel stack co-danger-zone">
        <h3 className="co-card-title">{t('dangerZone')}</h3>
        <p className="muted" style={{ margin: 0 }}>
          {t('dangerZoneHint')}
        </p>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {archived ? (
            <button className="btn" type="button" onClick={onReactivate}>
              {t('reactivate')}
            </button>
          ) : (
            <button className="btn danger" type="button" onClick={onArchive}>
              {t('archive')}
            </button>
          )}
          <button
            className="btn danger"
            type="button"
            onClick={() => {
              setDeleteOpen((v) => !v)
              setConfirmSlug('')
            }}
          >
            {t('deleteCompany')}
          </button>
        </div>

        {deleteOpen ? (
          <div className="stack co-delete-confirm">
            <p className="co-delete-warn" role="alert">
              {t('deleteCompanyWarn')}
            </p>
            <p className="muted" style={{ margin: 0 }}>
              {t('deleteCompanyTypeSlug').replace('{slug}', slug).replace('{name}', name)}
            </p>
            <label className="stack" style={{ gap: 4 }}>
              <span className="filter-lbl muted">{t('deleteCompanyConfirmLabel')}</span>
              <input
                className="input"
                value={confirmSlug}
                onChange={(e) => setConfirmSlug(e.target.value)}
                placeholder={slug}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <div className="row" style={{ gap: 8 }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setDeleteOpen(false)
                  setConfirmSlug('')
                }}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className="btn danger"
                disabled={!canDelete || deleting}
                onClick={() => void confirmDelete()}
              >
                {deleting ? t('deletingCompany') : t('deleteCompanyForever')}
              </button>
            </div>
          </div>
        ) : null}

        {msg ? <p className="muted">{msg}</p> : null}
      </section>
    </div>
  )
}

function OverviewCard({
  title,
  status,
  ok,
  hint,
  onClick,
  cta,
}: {
  title: string
  status: string
  ok: boolean
  hint: string
  onClick: () => void
  cta: string
}) {
  return (
    <button type="button" className="co-overview-card" onClick={onClick}>
      <span className="co-overview-card-top">
        <span className="co-overview-card-title">{title}</span>
        <span className={`badge ${ok ? 'ok' : 'warn'}`}>{status}</span>
      </span>
      <span className="co-overview-card-hint">{hint}</span>
      <span className="co-overview-card-cta">{cta} →</span>
    </button>
  )
}
