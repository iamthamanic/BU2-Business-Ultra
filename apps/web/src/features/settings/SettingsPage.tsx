/**
 * SettingsPage — company settings with tabs: Übersicht | Verbindungen | Funnel | Team | Logo.
 * Hash deep-links (#connections etc.) from Marketing Hub. Location: apps/web/src/features/settings/SettingsPage.tsx
 */
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { SettingsConnectionsTab } from './SettingsConnectionsTab'
import { SettingsFunnelTab } from './SettingsFunnelTab'
import { SettingsHeader, type SettingsStatus } from './SettingsHeader'
import { SettingsLogoTab } from './SettingsLogoTab'
import { SettingsOverviewTab } from './SettingsOverviewTab'
import { SettingsTeamTab } from './SettingsTeamTab'
import { SETTINGS_TABS, hashForTab, tabFromHash, type SettingsTab } from './settingsTabs'

type SecretRow = { provider: string; valid: boolean; keyHint?: string | null }

export function SettingsPage() {
  const { slug } = useParams()
  const { t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()

  const [tab, setTab] = useState<SettingsTab>(() => tabFromHash(window.location.hash))
  const [secrets, setSecrets] = useState<SecretRow[]>([])
  const [status, setStatus] = useState<SettingsStatus | null>(null)
  const [companyMeta, setCompanyMeta] = useState<{
    name: string
    logoPath?: string | null
    status: string
  } | null>(null)
  const [memberCount, setMemberCount] = useState(0)
  const [dangerMsg, setDangerMsg] = useState('')

  function setTabAndHash(next: SettingsTab) {
    setTab(next)
    const hash = hashForTab(next)
    const path = `${location.pathname}${hash}`
    if (`${location.pathname}${location.hash}` !== path) {
      navigate(path, { replace: true })
    }
  }

  useEffect(() => {
    setTabAndHash(tabFromHash(location.hash))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from URL only
  }, [location.hash])

  async function refreshSecrets() {
    if (!slug) return
    const r = await api<{ secrets: SecretRow[] }>(`/api/b/${slug}/settings/secrets`)
    setSecrets(r.secrets)
  }

  async function refreshStatus() {
    if (!slug) return
    const r = await api<{ status: SettingsStatus }>(`/api/b/${slug}/settings/status`)
    setStatus(r.status)
  }

  async function refreshAll() {
    await Promise.all([refreshSecrets(), refreshStatus()])
  }

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    Promise.all([
      api<{ business: { name: string; logoPath?: string | null; status: string } }>(
        `/api/b/${slug}`,
      ),
      api<{ secrets: SecretRow[] }>(`/api/b/${slug}/settings/secrets`).catch(() => ({
        secrets: [] as SecretRow[],
      })),
      api<{ status: SettingsStatus }>(`/api/b/${slug}/settings/status`),
      api<{ members: unknown[] }>(`/api/b/${slug}/members`).catch(() => ({ members: [] })),
    ])
      .then(([biz, sec, st, mem]) => {
        if (cancelled) return
        setCompanyMeta({
          name: biz.business.name,
          logoPath: biz.business.logoPath,
          status: biz.business.status,
        })
        setSecrets(sec.secrets)
        setStatus(st.status)
        setMemberCount(mem.members.length)
      })
      .catch(console.error)
    return () => {
      cancelled = true
    }
  }, [slug])

  async function archive() {
    if (!slug || !confirm(t('archiveConfirm'))) return
    try {
      await api(`/api/b/${slug}/archive`, { method: 'POST', body: '{}' })
      setCompanyMeta((c) => (c ? { ...c, status: 'archived' } : c))
      setDangerMsg(t('archivedOk'))
    } catch (e) {
      setDangerMsg(String(e))
    }
  }

  async function reactivate() {
    if (!slug) return
    try {
      await api(`/api/b/${slug}/reactivate`, { method: 'POST', body: '{}' })
      setCompanyMeta((c) => (c ? { ...c, status: 'active' } : c))
      setDangerMsg(t('reactivatedOk'))
    } catch (e) {
      setDangerMsg(String(e))
    }
  }

  if (!slug) return null

  const tabLabels: Record<SettingsTab, string> = {
    overview: t('overview'),
    connections: t('connections'),
    funnel: t('funnelAssignment'),
    team: t('team'),
    logo: t('companyLogo'),
  }

  return (
    <div className="stack co-settings">
      <SettingsHeader
        name={companyMeta?.name ?? slug}
        slug={slug}
        logoPath={companyMeta?.logoPath}
        status={status}
        companyStatus={companyMeta?.status ?? 'active'}
        onJump={setTabAndHash}
      />

      <div className="co-settings-subnav" role="tablist" aria-label={t('settings')}>
        {SETTINGS_TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            className={`co-settings-subtab ${tab === id ? 'active' : ''}`}
            aria-selected={tab === id}
            onClick={() => setTabAndHash(id)}
          >
            {tabLabels[id]}
          </button>
        ))}
      </div>

      <div className="co-settings-pane" role="tabpanel">
        {tab === 'overview' ? (
          <SettingsOverviewTab
            slug={slug}
            name={companyMeta?.name ?? slug}
            logoPath={companyMeta?.logoPath}
            status={status}
            companyStatus={companyMeta?.status ?? 'active'}
            memberCount={memberCount}
            msg={dangerMsg}
            onJump={setTabAndHash}
            onArchive={archive}
            onReactivate={reactivate}
          />
        ) : null}
        {tab === 'connections' ? (
          <SettingsConnectionsTab
            slug={slug}
            secrets={secrets}
            onSecretsChanged={() => {
              refreshAll().catch(console.error)
            }}
          />
        ) : null}
        {tab === 'funnel' ? (
          <SettingsFunnelTab
            slug={slug}
            onSaved={() => {
              refreshStatus().catch(console.error)
            }}
          />
        ) : null}
        {tab === 'team' ? (
          <SettingsTeamTab slug={slug} onMembersChanged={setMemberCount} />
        ) : null}
        {tab === 'logo' ? (
          <SettingsLogoTab
            slug={slug}
            name={companyMeta?.name ?? slug}
            logoPath={companyMeta?.logoPath}
            onChanged={(logoPath) =>
              setCompanyMeta((c) => (c ? { ...c, logoPath } : c))
            }
          />
        ) : null}
      </div>
    </div>
  )
}
