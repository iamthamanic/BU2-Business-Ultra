/**
 * SettingsPage — company settings with MktTabs surface strip:
 * Details | Verbindungen | Funnel | Team | Labels.
 * Hash deep-links (#connections etc.) from Marketing Hub.
 * Location: apps/web/src/features/settings/SettingsPage.tsx
 */
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Funnel,
  IdentificationCard,
  LinkSimple,
  Tag,
  UsersThree,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { canManageCredentials, canManageMembers, type Role } from '@bu2/shared'
import { MktTab, MktTabs } from '../../components/MktTabs'
import { api } from '../../lib/api'
import { writeLastCompany } from '../../lib/lastCompany'
import { useI18n } from '../../lib/i18n'
import { SettingsCompanyTab } from './SettingsCompanyTab'
import { SettingsConnectionsTab } from './SettingsConnectionsTab'
import { SettingsFunnelTab } from './SettingsFunnelTab'
import { SettingsHeader, type SettingsStatus } from './SettingsHeader'
import { SettingsLabelsTab } from './SettingsLabelsTab'
import { SettingsTeamTab } from './SettingsTeamTab'
import { SETTINGS_TABS, hashForTab, tabFromHash, type SettingsTab } from './settingsTabs'

const TAB_ICONS: Record<SettingsTab, Icon> = {
  details: IdentificationCard,
  connections: LinkSimple,
  funnel: Funnel,
  team: UsersThree,
  labels: Tag,
}

type SecretRow = { provider: string; valid: boolean; keyHint?: string | null }

type CompanyMeta = {
  name: string
  logoPath?: string | null
  status: string
  createdAt?: string | null
  role?: string | null
}

export function SettingsPage() {
  const { slug } = useParams()
  const { t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()

  const [tab, setTab] = useState<SettingsTab>(() => tabFromHash(window.location.hash))
  const [secrets, setSecrets] = useState<SecretRow[]>([])
  const [status, setStatus] = useState<SettingsStatus | null>(null)
  const [companyMeta, setCompanyMeta] = useState<CompanyMeta | null>(null)
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
      api<{
        business: {
          name: string
          logoPath?: string | null
          status: string
          createdAt?: string
        }
        membership: { role: string } | null
      }>(`/api/b/${slug}`),
      api<{ secrets: SecretRow[] }>(`/api/b/${slug}/settings/secrets`).catch(() => ({
        secrets: [] as SecretRow[],
      })),
      api<{ status: SettingsStatus }>(`/api/b/${slug}/settings/status`),
    ])
      .then(([biz, sec, st]) => {
        if (cancelled) return
        setCompanyMeta({
          name: biz.business.name,
          logoPath: biz.business.logoPath,
          status: biz.business.status,
          createdAt: biz.business.createdAt ?? null,
          role: biz.membership?.role ?? null,
        })
        setSecrets(sec.secrets)
        setStatus(st.status)
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

  async function deleteCompany(confirmSlug: string) {
    if (!slug) return
    try {
      await api(`/api/b/${slug}`, {
        method: 'DELETE',
        body: JSON.stringify({ confirmSlug }),
      })
      try {
        writeLastCompany('')
      } catch {
        /* ignore */
      }
      navigate('/', { replace: true })
    } catch (e) {
      setDangerMsg(String(e))
    }
  }

  if (!slug) return null

  const canEdit = canManageMembers((companyMeta?.role as Role) || 'viewer')

  const tabLabels: Record<SettingsTab, string> = {
    details: t('settingsDetails'),
    connections: t('connections'),
    funnel: t('funnelAssignment'),
    team: t('team'),
    labels: t('settingsLabels'),
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

      <MktTabs level="surface" label={t('settings')} className="co-settings-tabs">
        {SETTINGS_TABS.map((id) => (
          <MktTab
            key={id}
            active={tab === id}
            label={tabLabels[id]}
            icon={TAB_ICONS[id]}
            onClick={() => setTabAndHash(id)}
          />
        ))}
      </MktTabs>

      <div className="co-settings-pane" role="tabpanel">
        {tab === 'details' ? (
          <SettingsCompanyTab
            slug={slug}
            name={companyMeta?.name ?? slug}
            logoPath={companyMeta?.logoPath}
            companyStatus={companyMeta?.status ?? 'active'}
            createdAt={companyMeta?.createdAt}
            role={companyMeta?.role}
            msg={dangerMsg}
            canEdit={canEdit}
            onMetaChanged={(next) =>
              setCompanyMeta((c) => (c ? { ...c, ...next } : c))
            }
            onArchive={archive}
            onReactivate={reactivate}
            onDelete={deleteCompany}
          />
        ) : null}
        {tab === 'connections' ? (
          <SettingsConnectionsTab
            slug={slug}
            secrets={secrets}
            canManage={canManageCredentials((companyMeta?.role as Role) || 'viewer')}
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
        {tab === 'team' ? <SettingsTeamTab slug={slug} /> : null}
        {tab === 'labels' ? <SettingsLabelsTab slug={slug} /> : null}
      </div>
    </div>
  )
}
