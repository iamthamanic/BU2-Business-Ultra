/**
 * MarketingPage — organic + custom funnel channel depth (Legacy IA).
 * Organic Analyse: KPIs/table · Organic Planung: calendar (URL …/planung). Soft connect banner when needed.
 * Location: apps/web/src/features/marketing/MarketingPage.tsx
 */
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { companyRoutes, parseMarketingLocation } from '../../lib/companyPaths'
import { useI18n } from '../../lib/i18n'
import { CustomFunnelToolbar } from './CustomFunnelToolbar'
import { FunnelConnectHint } from './FunnelConnectHint'
import { OrganicPostsPanel, type OrganicPost } from './OrganicPostsPanel'
import { OrganicProductionPanel } from './OrganicProductionPanel'

type Connector = {
  surface: string
  provider: string
  status: string
  implemented: boolean
  keyReady: boolean
  brandsLinked: number
  blogIds: string[]
  integrationId: string | null
  brandLabel: string | null
  contentReady: boolean
  needs: 'key' | 'brand' | null
  message?: string
}

type OrganicPayload = {
  channel: string
  surface: string
  connector: Connector
  posts: OrganicPost[]
  window: string
  mode: 'live' | 'stub'
  generatedAt: string
}

export function MarketingPage() {
  const { slug, channel } = useParams()
  const { pathname } = useLocation()
  const { t } = useI18n()
  const parsed = useMemo(() => parseMarketingLocation(pathname), [pathname])
  const ch = (channel || 'instagram').toLowerCase()
  const isCustom = pathname.includes('/funnel/custom/')
  const isEmail = isCustom && ch === 'email'
  const isOffline = isCustom && ch === 'offline'
  const isPlanung = !isCustom && parsed.surface === 'planung'

  const [organic, setOrganic] = useState<OrganicPayload | null>(null)
  const [drafts, setDrafts] = useState<any[]>([])
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [brevoGate, setBrevoGate] = useState(false)
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [caps, setCaps] = useState<any[]>([])
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [win, setWin] = useState<'24h' | '7d' | '30d' | 'all'>('30d')

  const settingsHref = slug ? companyRoutes(slug).settingsConnections : '#'

  async function refreshOrganic(windowKey = win) {
    if (!slug || isCustom || isPlanung) return
    const r = await api<OrganicPayload>(
      `/api/b/${slug}/marketing/funnel/organic/${ch}?window=${windowKey}`,
    )
    setOrganic(r)
  }

  async function refresh() {
    setLoading(true)
    try {
      if (isPlanung) {
        setOrganic(null)
        return
      }
      if (isOffline) {
        setOrganic(null)
        return
      }
      if (isEmail) {
        const [b, c] = await Promise.all([
          api<{ ready: boolean }>(`/api/b/${slug}/integrations/brevo/ready`),
          api<{ campaigns: any[] }>(`/api/b/${slug}/marketing/brevo`),
        ])
        setBrevoGate(b.ready)
        setCampaigns(c.campaigns)
        return
      }
      const [d, cap] = await Promise.all([
        api<{ drafts: any[] }>(`/api/b/${slug}/marketing/drafts`),
        api<{ networks: any[] }>(`/api/b/${slug}/marketing/capabilities`),
      ])
      await refreshOrganic(win)
      setDrafts(d.drafts)
      setCaps(cap.networks)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh().catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh on route/window
  }, [slug, ch, isCustom, isEmail, isOffline, isPlanung, win])

  async function createDraft(nextTitle: string, nextText: string) {
    await api(`/api/b/${slug}/marketing/drafts`, {
      method: 'POST',
      body: JSON.stringify({
        title: nextTitle,
        masterText: nextText,
        variants: caps
          .filter((c) => c.canSchedule)
          .slice(0, 5)
          .map((c) => ({
            network: c.network,
            text: nextText,
            enabled: true,
            mediaKind: c.supportsVideo && !c.supportsImage ? 'video' : 'text',
          })),
      }),
    })
    await refresh()
  }

  async function schedule(id: string) {
    if (!confirm(t('confirmSchedule'))) return
    try {
      const r = await api(`/api/b/${slug}/marketing/drafts/${id}/schedule`, {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
      })
      setMsg(JSON.stringify(r, null, 2))
      await refresh()
    } catch (e) {
      setMsg(String(e))
    }
  }

  async function retry(id: string) {
    if (!confirm(t('confirmSchedule'))) return
    const r = await api(`/api/b/${slug}/marketing/drafts/${id}/retry`, {
      method: 'POST',
      body: JSON.stringify({ confirm: true }),
    })
    setMsg(JSON.stringify(r, null, 2))
    await refresh()
  }

  async function createBrevo() {
    await api(`/api/b/${slug}/marketing/brevo`, {
      method: 'POST',
      body: JSON.stringify({
        name: title || 'Campaign',
        subject: title || 'Hello',
        htmlContent: `<p>${text || '…'}</p>`,
      }),
    })
    await refresh()
  }

  async function sendBrevo(id: string) {
    if (!confirm(t('confirmSend'))) return
    try {
      const r = await api(`/api/b/${slug}/marketing/brevo/${id}/send`, {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
      })
      setMsg(JSON.stringify(r, null, 2))
      await refresh()
    } catch (e) {
      setMsg(String(e))
    }
  }

  if (isPlanung) {
    return (
      <div className="stack funnel-page">
        <OrganicProductionPanel initialWindow={win} onWindowChange={(w) => setWin(w)} />
      </div>
    )
  }

  if (isOffline) {
    return (
      <div className="stack funnel-page">
        <CustomFunnelToolbar
          channel={ch}
          win={win}
          onWindowChange={setWin}
          rows={[]}
        />
        <div className="panel funnel-table-wrap">
          <table className="table funnel-grid-table">
            <thead>
              <tr>
                <th>{t('colDate')}</th>
                <th>{t('name')}</th>
                <th>{t('status')}</th>
                <th>{t('colType')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4} className="funnel-table-empty muted">
                  <FunnelConnectHint
                    need="stub"
                    settingsHref={settingsHref}
                    message={t('offlineStubBody')}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (isEmail) {
    return (
      <div className="stack funnel-page">
        <CustomFunnelToolbar
          channel={ch}
          win={win}
          onWindowChange={setWin}
          rows={campaigns.map((c) => ({
            id: String(c.id),
            name: String(c.name ?? '—'),
            status: c.status != null ? String(c.status) : '—',
            type: 'email',
          }))}
        />

        <div className="panel stack">
          <input
            className="input"
            placeholder={t('draftTitlePh')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!brevoGate}
          />
          <textarea
            className="textarea"
            placeholder={t('draftTextPh')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!brevoGate}
          />
          <button className="btn primary" type="button" onClick={createBrevo} disabled={!brevoGate}>
            {t('saveDraft')}
          </button>
        </div>

        <div className="panel funnel-table-wrap">
          <h3 className="section-title" style={{ marginTop: 0 }}>
            Brevo
          </h3>
          <table className="table funnel-grid-table">
            <thead>
              <tr>
                <th>{t('name')}</th>
                <th>{t('status')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="funnel-table-empty muted">
                    {t('loading')}
                  </td>
                </tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan={3} className="funnel-table-empty muted">
                    {!brevoGate ? (
                      <FunnelConnectHint
                        need="key"
                        settingsHref={settingsHref}
                        message={t('connectBannerBrevo')}
                      />
                    ) : (
                      t('noCampaigns')
                    )}
                  </td>
                </tr>
              ) : (
                campaigns.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.status}</td>
                    <td>
                      <button
                        className="btn danger"
                        type="button"
                        disabled={!brevoGate}
                        onClick={() => sendBrevo(c.id)}
                      >
                        {t('send')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {msg ? <pre className="panel muted">{msg}</pre> : null}
      </div>
    )
  }

  // Organic Analyse — connect hint lives in the empty table row
  const need = organic?.connector.needs
  const needsConnect = need === 'key' || need === 'brand'
  const emptyHint =
    needsConnect || (organic?.connector.brandsLinked ?? 0) === 0
      ? t('postsEmptyNeedBrand')
      : t('postsEmptyWindow')

  return (
    <div className="stack funnel-page">
      <OrganicPostsPanel
        channel={ch}
        posts={organic?.posts ?? []}
        emptyHint={loading && !organic ? t('loading') : emptyHint}
        emptyContent={
          needsConnect ? <FunnelConnectHint need={need} settingsHref={settingsHref} /> : undefined
        }
        initialWindow={win}
        onWindowChange={(w) => setWin(w)}
      />

      {msg ? <pre className="panel muted">{msg}</pre> : null}
    </div>
  )
}
