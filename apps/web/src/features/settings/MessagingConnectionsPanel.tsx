/**
 * MessagingConnectionsPanel — Omnichannel account table + bindings (Settings → Verbindungen).
 * Uses Integration Core APIs; Telegram connect via ConnectAccountModal.
 * Location: apps/web/src/features/settings/MessagingConnectionsPanel.tsx
 */
import { Fragment, useCallback, useEffect, useState } from 'react'
import { ArrowsClockwise, Plus } from '@phosphor-icons/react'
import { MktTab, MktTabs } from '../../components/MktTabs'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { ConnectAccountModal } from './ConnectAccountModal'
import { ConnProviderIcon } from './connProviderIcons'

type PublicConnection = {
  id: string
  provider: string
  authMethod: string
  externalAccountId: string
  displayName: string | null
  status: string
}

type Binding = {
  id: string
  connectionId: string
  module: string
  purpose: string
  enabled: boolean
}

type ProviderRow = {
  id: string
  label: string
  authMethods: string[]
  adapterReady: boolean
  selectable?: boolean
  connectKind?: string
  domainGroup?: string
  redirectUri?: string | null
  oauthConfigured?: boolean | null
  clientConfigured?: boolean
}

const FINANCE_PROVIDERS = new Set(['finapi'])

type SubTab = 'accounts' | 'log'

type Props = {
  slug: string
  canManage: boolean
}

const USAGE_MODULES = ['inbox', 'crm', 'marketing'] as const

export function MessagingConnectionsPanel({ slug, canManage }: Props) {
  const { t } = useI18n()
  const [sub, setSub] = useState<SubTab>('accounts')
  const [connections, setConnections] = useState<PublicConnection[]>([])
  const [bindings, setBindings] = useState<Binding[]>([])
  const [providers, setProviders] = useState<ProviderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showConnect, setShowConnect] = useState(false)
  const [connectProviderId, setConnectProviderId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [oauthFlash, setOauthFlash] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [c, b, p] = await Promise.all([
        api<{ connections: PublicConnection[] }>(`/api/b/${slug}/integrations/connections`),
        api<{ bindings: Binding[] }>(`/api/b/${slug}/integrations/bindings`),
        api<{ providers: ProviderRow[] }>(`/api/b/${slug}/integrations/providers`),
      ])
      setConnections(c.connections || [])
      setBindings(b.bindings || [])
      setProviders(p.providers || [])
    } catch (e) {
      setError(String((e as Error).message || e))
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    load().catch(console.error)
  }, [load])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get('oauth_status')
    const err = params.get('oauth_error')
    const provider = params.get('oauth_provider') || params.get('oauth') || ''
    if (!status && !err) return
    if (status === 'connected') {
      setOauthFlash(t('connOauthConnected').replace('{provider}', provider || 'OAuth'))
      load().catch(console.error)
    } else if (err) {
      setOauthFlash(`${t('connOauthFailed')}: ${err}`)
    }
    params.delete('oauth')
    params.delete('oauth_status')
    params.delete('oauth_provider')
    params.delete('oauth_error')
    params.delete('oauth_error_detail')
    params.delete('connection_id')
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`
    window.history.replaceState({}, '', next)
  }, [load, t])

  function modulesFor(connectionId: string): string[] {
    const mods = new Set<string>()
    for (const b of bindings) {
      if (b.connectionId === connectionId && b.enabled) mods.add(b.module)
    }
    return [...mods]
  }

  function moduleOn(connectionId: string, mod: string): boolean {
    return bindings.some((b) => b.connectionId === connectionId && b.module === mod && b.enabled)
  }

  async function toggleModule(connectionId: string, mod: (typeof USAGE_MODULES)[number], enabled: boolean) {
    if (!canManage) return
    const key = `${connectionId}:${mod}`
    setToggling(key)
    setError(null)
    try {
      await api(`/api/b/${slug}/integrations/module-bindings`, {
        method: 'PUT',
        body: JSON.stringify({ connectionId, module: mod, enabled }),
      })
      await load()
    } catch (e) {
      setError(String((e as Error).message || e))
    } finally {
      setToggling(null)
    }
  }

  async function syncConnection(c: PublicConnection) {
    setSyncingId(c.id)
    setError(null)
    try {
      const path =
        c.provider === 'unipile'
          ? `/api/b/${slug}/inbox/unipile/connections/${c.id}/sync`
          : c.provider === 'google'
            ? `/api/b/${slug}/inbox/google/connections/${c.id}/sync`
            : `/api/b/${slug}/inbox/telegram/connections/${c.id}/sync`
      await api(path, { method: 'POST' })
    } catch (e) {
      setError(String((e as Error).message || e))
    } finally {
      setSyncingId(null)
    }
  }

  function providerLabel(id: string): string {
    return providers.find((p) => p.id === id)?.label || id
  }

  function providerReady(p: ProviderRow): boolean {
    if (p.selectable != null) return p.selectable
    return Boolean(p.adapterReady || p.connectKind === 'oauth')
  }

  function providerStatus(p: ProviderRow): string {
    if (p.connectKind === 'oauth') {
      return p.oauthConfigured ? t('connProviderReady') : t('connOauthNeedsClient')
    }
    if (p.id === 'unipile' && !p.adapterReady) return t('connUnipileNotConfigured')
    if (p.adapterReady) return t('connProviderReady')
    return t('connProviderSoon')
  }

  function openConnect(providerId?: string) {
    setConnectProviderId(providerId ?? null)
    setShowConnect(true)
  }

  const messagingProviders = providers.filter(
    (p) => p.id !== 'mock' && p.domainGroup !== 'finance' && !FINANCE_PROVIDERS.has(p.id),
  )
  const messagingConnections = connections.filter(
    (c) => c.provider !== 'mock' && !FINANCE_PROVIDERS.has(c.provider),
  )

  return (
    <section className="panel stack conn-messaging" id="messaging-connections">
      <div className="co-card-head">
        <div>
          <h3 className="co-card-title">{t('connMessagingTitle')}</h3>
          <p className="muted co-card-hint">{t('connMessagingHint')}</p>
        </div>
        {canManage ? (
          <button type="button" className="btn primary" onClick={() => openConnect()}>
            <Plus size={14} weight="bold" aria-hidden />
            {t('connConnectAccount')}
          </button>
        ) : null}
      </div>

      <div className="conn-info-banner" role="note">
        {t('connInboxBanner')}
      </div>

      <div className="conn-catalog">
        <div className="conn-catalog-head">
          <h4 className="conn-catalog-title">{t('connCatalogTitle')}</h4>
          <p className="muted conn-catalog-hint">{t('connCatalogHint')}</p>
        </div>
        <ul className="conn-provider-grid">
          {messagingProviders.map((p) => {
            const ready = providerReady(p)
            const linked = messagingConnections.some((c) => c.provider === p.id)
            return (
              <li key={p.id}>
                <div
                  className={`conn-provider-card conn-provider-card--premium${!ready ? ' is-disabled' : ''}${linked ? ' is-linked' : ''}`}
                  data-ic={p.id}
                >
                  <ConnProviderIcon id={p.id} size={28} />
                  <span className="conn-provider-copy">
                    <span className="conn-provider-name">{p.label}</span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {linked ? t('connStatusConnected') : providerStatus(p)}
                    </span>
                  </span>
                  {canManage ? (
                    <button
                      type="button"
                      className="btn primary conn-provider-cta"
                      disabled={!ready}
                      onClick={() => openConnect(p.id)}
                    >
                      {t('connectBannerCta')}
                    </button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <MktTabs level="surface" label={t('connMessagingTitle')}>
        <MktTab
          active={sub === 'accounts'}
          label={`${t('connTabAccounts')} (${messagingConnections.length})`}
          onClick={() => setSub('accounts')}
        />
        <MktTab active={sub === 'log'} label={t('connTabLog')} onClick={() => setSub('log')} />
      </MktTabs>

      {oauthFlash ? (
        <p className="conn-info-banner" role="status">
          {oauthFlash}
        </p>
      ) : null}

      {error ? (
        <p className="inbox-error" role="alert">
          {error}
        </p>
      ) : null}

      {sub === 'accounts' ? (
        loading ? (
          <p className="muted">{t('loading')}</p>
        ) : messagingConnections.length === 0 ? (
          <p className="muted">{t('connEmptyAccounts')}</p>
        ) : (
          <div className="conn-table-wrap">
            <table className="conn-table">
              <thead>
                <tr>
                  <th>{t('connColProvider')}</th>
                  <th>{t('connColAccount')}</th>
                  <th>{t('connColStatus')}</th>
                  <th>{t('connColUsage')}</th>
                  <th>{t('connColActions')}</th>
                </tr>
              </thead>
              <tbody>
                {messagingConnections.map((c) => {
                  const mods = modulesFor(c.id)
                  const open = expandedId === c.id
                  return (
                    <Fragment key={c.id}>
                      <tr>
                        <td>
                          <div className="conn-prov-cell">
                            <ConnProviderIcon id={c.provider} size={18} />
                            <div>
                              <strong>{providerLabel(c.provider)}</strong>
                              <span className="muted" style={{ fontSize: 12, display: 'block' }}>
                                {c.authMethod}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>{c.displayName || c.externalAccountId}</td>
                        <td>
                          <span
                            className={`crm-status${c.status === 'active' ? ' crm-status--active' : ''}`}
                          >
                            {c.status === 'active' ? t('connStatusConnected') : c.status}
                          </span>
                        </td>
                        <td>
                          <div className="conn-usage-tags">
                            {mods.length === 0 ? (
                              <span className="muted">—</span>
                            ) : (
                              mods.map((m) => (
                                <span key={m} className="crm-tag">
                                  {usageLabel(m, t)}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="conn-row-actions">
                            {c.provider === 'telegram' ||
                            c.provider === 'unipile' ||
                            c.provider === 'google' ? (
                              <button
                                type="button"
                                className="btn"
                                disabled={syncingId === c.id}
                                title={t('inboxSync')}
                                onClick={() => syncConnection(c).catch(console.error)}
                              >
                                <ArrowsClockwise size={14} weight="bold" aria-hidden />
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="btn"
                              onClick={() => setExpandedId(open ? null : c.id)}
                            >
                              {open ? t('connHideDetail') : t('connShowDetail')}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {open ? (
                        <tr className="conn-detail-row">
                          <td colSpan={5}>
                            <div className="conn-detail-panel stack">
                              <h4 className="conn-detail-title">{t('connUsageTitle')}</h4>
                              {USAGE_MODULES.map((mod) => {
                                const on = moduleOn(c.id, mod)
                                const key = `${c.id}:${mod}`
                                return (
                                  <label key={mod} className="conn-toggle-row">
                                    <span>
                                      <strong>{usageLabel(mod, t)}</strong>
                                      <span className="muted" style={{ display: 'block', fontSize: 12 }}>
                                        {usageHint(mod, t)}
                                      </span>
                                    </span>
                                    <input
                                      type="checkbox"
                                      checked={on}
                                      disabled={!canManage || toggling === key}
                                      onChange={(e) =>
                                        toggleModule(c.id, mod, e.target.checked).catch(console.error)
                                      }
                                    />
                                  </label>
                                )
                              })}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {sub === 'log' ? <p className="muted">{t('connLogSoon')}</p> : null}

      {showConnect ? (
        <ConnectAccountModal
          slug={slug}
          providers={messagingProviders}
          initialProviderId={connectProviderId}
          onClose={() => {
            setShowConnect(false)
            setConnectProviderId(null)
          }}
          onConnected={() => {
            load().catch(console.error)
          }}
        />
      ) : null}
    </section>
  )
}

function usageLabel(mod: string, t: (k: 'connUsageInbox' | 'connUsageCrm' | 'connUsageMarketing') => string) {
  if (mod === 'inbox') return t('connUsageInbox')
  if (mod === 'crm') return t('connUsageCrm')
  if (mod === 'marketing') return t('connUsageMarketing')
  return mod
}

function usageHint(mod: string, t: (k: 'connUsageInboxHint' | 'connUsageCrmHint' | 'connUsageMarketingHint') => string) {
  if (mod === 'inbox') return t('connUsageInboxHint')
  if (mod === 'crm') return t('connUsageCrmHint')
  return t('connUsageMarketingHint')
}
