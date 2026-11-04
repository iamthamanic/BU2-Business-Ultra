/**
 * InboxPage — omnichannel messaging inbox (Telegram Bot E2E first).
 * Three-pane Dark-Ops: list · thread · identity context.
 * Connect lives under Settings → Verbindungen; this page consumes sources.
 * Location: apps/web/src/features/inbox/InboxPage.tsx
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { ArrowsClockwise, PaperPlaneTilt, PlugsConnected } from '@phosphor-icons/react'
import { canMutateContent } from '@bu2/shared'
import type { CompanyOutletContext } from '../../components/BusinessShell'
import { MktTab, MktTabs } from '../../components/MktTabs'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { companyRoutes } from '../../lib/companyPaths'

type InboxConnection = {
  id: string
  provider: string
  displayName: string | null
  status: string
  externalAccountId: string
}

type Conversation = {
  id: string
  channel: string
  connectionId?: string
  title: string | null
  status: string
  lastMessageAt: string | null
  lastPreview: string | null
  contactIdentityId: string | null
}

type InboxMessage = {
  id: string
  direction: string
  body: string
  deliveryStatus: string
  errorDetail: string | null
  sentAt: string | null
  createdAt: string
}

type Identity = {
  id: string
  kind: string
  value: string
  displayName: string | null
  customerId: string | null
  confidence: string
} | null

type ListFilter = 'all' | 'open' | 'assigned' | 'unread' | 'archived'

export function InboxPage() {
  const { slug: paramSlug } = useParams()
  const ctx = useOutletContext<CompanyOutletContext | null>()
  const slug = paramSlug || ctx?.slug || ''
  const role = ctx?.membership?.role
  const canWrite = role ? canMutateContent(role) : Boolean(ctx?.user?.isSuperadmin)
  const { t } = useI18n()
  const routes = companyRoutes(slug)

  const [connections, setConnections] = useState<InboxConnection[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [identity, setIdentity] = useState<Identity>(null)
  const [threadTitle, setThreadTitle] = useState<string | null>(null)
  const [threadChannel, setThreadChannel] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [threadLoading, setThreadLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [filter, setFilter] = useState<ListFilter>('all')

  async function refreshList() {
    if (!slug) return
    setLoading(true)
    setError(null)
    try {
      const [c, conv] = await Promise.all([
        api<{ connections: InboxConnection[] }>(`/api/b/${slug}/inbox/connections`),
        api<{ conversations: Conversation[] }>(`/api/b/${slug}/inbox/conversations`),
      ])
      setConnections(c.connections || [])
      setConversations(conv.conversations || [])
    } catch (e) {
      setError(String((e as Error).message || e))
    } finally {
      setLoading(false)
    }
  }

  async function openThread(id: string) {
    if (!slug) return
    setSelectedId(id)
    setThreadLoading(true)
    setError(null)
    try {
      const data = await api<{
        conversation: { title: string | null; channel?: string }
        messages: InboxMessage[]
        identity: Identity
      }>(`/api/b/${slug}/inbox/conversations/${id}`)
      setMessages(data.messages || [])
      setIdentity(data.identity)
      setThreadTitle(data.conversation?.title || null)
      const fromList = conversations.find((c) => c.id === id)
      setThreadChannel(data.conversation?.channel || fromList?.channel || null)
    } catch (e) {
      setError(String((e as Error).message || e))
    } finally {
      setThreadLoading(false)
    }
  }

  async function syncAll() {
    if (!slug || !connections.length) return
    setSyncing(true)
    setError(null)
    try {
      for (const c of connections) {
        if (c.provider === 'telegram') {
          await api(`/api/b/${slug}/inbox/telegram/connections/${c.id}/sync`, { method: 'POST' })
        } else if (c.provider === 'unipile') {
          await api(`/api/b/${slug}/inbox/unipile/connections/${c.id}/sync`, { method: 'POST' })
        }
      }
      await refreshList()
      if (selectedId) await openThread(selectedId)
    } catch (e) {
      setError(String((e as Error).message || e))
    } finally {
      setSyncing(false)
    }
  }

  async function sendReply(ev: React.FormEvent) {
    ev.preventDefault()
    if (!slug || !selectedId || !reply.trim()) return
    setSending(true)
    setError(null)
    try {
      await api(`/api/b/${slug}/inbox/conversations/${selectedId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ body: reply.trim() }),
      })
      setReply('')
      await openThread(selectedId)
      await refreshList()
    } catch (e) {
      setError(String((e as Error).message || e))
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    refreshList().catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const filtered = useMemo(() => {
    return conversations.filter((c) => {
      if (filter === 'open') return c.status === 'open' || c.status === 'active'
      if (filter === 'archived') return c.status === 'archived' || c.status === 'closed'
      if (filter === 'assigned') return false
      if (filter === 'unread') return false
      return true
    })
  }, [conversations, filter])

  const emptyList = !loading && filtered.length === 0
  const hasConnection = connections.length > 0

  const openCount = conversations.filter((c) => c.status === 'open' || c.status === 'active').length

  return (
    <div className="stack mkt-shell product-shell crm-shell inbox-shell">
      <header className="product-page-head">
        <div>
          <div className="inbox-title-row">
            <h1 className="section-title product-page-title">{t('inbox')}</h1>
            <span className="crm-status crm-status--active">{t('inboxOmnichannelBadge')}</span>
          </div>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            {t('inboxMsgLede')}
          </p>
        </div>
        <div className="product-page-actions">
          {hasConnection ? (
            <button
              type="button"
              className="btn"
              disabled={syncing || !canWrite}
              onClick={() => syncAll().catch(console.error)}
            >
              <ArrowsClockwise size={14} weight="bold" aria-hidden />
              {syncing ? t('inboxSyncing') : t('inboxSync')}
            </button>
          ) : null}
          <Link className="btn" to={routes.settingsConnections}>
            <PlugsConnected size={14} weight="bold" aria-hidden />
            {t('connConnectAccount')}
          </Link>
        </div>
      </header>

      {error ? (
        <p className="inbox-error" role="alert">
          {error}
        </p>
      ) : null}

      {!hasConnection ? (
        <div className="inbox-empty-connect panel">
          <p style={{ margin: 0 }}>{t('inboxConnectInSettings')}</p>
          <Link className="btn primary" to={routes.settingsConnections}>
            {t('openConnections')}
          </Link>
        </div>
      ) : null}

      <div className="inbox-panes" data-has-thread={selectedId ? 'true' : 'false'}>
        <aside className="inbox-list" aria-label={t('inboxConversations')}>
          <MktTabs level="l3" label={t('inboxConversations')} className="inbox-filter-tabs">
            <MktTab
              active={filter === 'all'}
              label={`${t('inboxFilterAll')} ${conversations.length}`}
              onClick={() => setFilter('all')}
            />
            <MktTab
              active={filter === 'open'}
              label={`${t('inboxFilterOpen')} ${openCount}`}
              onClick={() => setFilter('open')}
            />
            <MktTab
              active={filter === 'assigned'}
              label={t('inboxFilterAssigned')}
              onClick={() => setFilter('assigned')}
            />
            <MktTab
              active={filter === 'unread'}
              label={t('inboxFilterUnread')}
              onClick={() => setFilter('unread')}
            />
            <MktTab
              active={filter === 'archived'}
              label={t('inboxFilterArchived')}
              onClick={() => setFilter('archived')}
            />
          </MktTabs>

          {loading ? <p className="muted">{t('loading')}</p> : null}
          {emptyList && hasConnection ? (
            <p className="muted inbox-empty">
              {filter === 'assigned' || filter === 'unread'
                ? t('inboxFilterStubEmpty')
                : t('inboxEmpty')}
            </p>
          ) : null}
          <ul className="inbox-conv-list">
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={`inbox-conv${selectedId === c.id ? ' is-active' : ''}`}
                  onClick={() => openThread(c.id).catch(console.error)}
                >
                  <span className="inbox-conv-top">
                    <span className="inbox-conv-title">{c.title || t('inboxUnknown')}</span>
                    <span className="inbox-channel-badge" data-ch={c.channel}>
                      {c.channel}
                    </span>
                  </span>
                  <span className="inbox-conv-preview muted">{c.lastPreview || '—'}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="inbox-thread" aria-label={t('inboxThread')}>
          {!selectedId ? (
            <p className="muted inbox-empty">{t('inboxPickConversation')}</p>
          ) : threadLoading ? (
            <p className="muted">{t('loading')}</p>
          ) : (
            <>
              <header className="inbox-thread-head">
                <h2 className="inbox-thread-title">{threadTitle || t('inboxUnknown')}</h2>
                {threadChannel ? (
                  <p className="inbox-reply-via">
                    {t('inboxReplyVia')}: <strong>{threadChannel}</strong>
                  </p>
                ) : null}
              </header>
              <div className="inbox-messages">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`inbox-bubble inbox-bubble-${m.direction}`}
                    data-status={m.deliveryStatus}
                  >
                    <p className="inbox-bubble-body">{m.body}</p>
                    <span className="inbox-bubble-meta muted">
                      {m.direction === 'outbound'
                        ? m.deliveryStatus === 'failed'
                          ? `${t('inboxFailed')}${m.errorDetail ? `: ${m.errorDetail}` : ''}`
                          : m.deliveryStatus === 'pending'
                            ? t('inboxPending')
                            : t('inboxSent')
                        : t('inboxReceived')}
                    </span>
                  </div>
                ))}
              </div>
              {canWrite ? (
                <form className="inbox-composer" onSubmit={sendReply}>
                  <textarea
                    className="input inbox-composer-input"
                    rows={3}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder={
                      threadChannel
                        ? `${t('inboxReplyPh')} (${threadChannel})`
                        : t('inboxReplyPh')
                    }
                    required
                  />
                  <button
                    type="submit"
                    className="btn primary"
                    disabled={sending || !reply.trim()}
                  >
                    <PaperPlaneTilt size={14} weight="bold" aria-hidden />
                    {sending ? t('loading') : t('inboxSend')}
                  </button>
                </form>
              ) : null}
            </>
          )}
        </section>

        <aside className="inbox-context" aria-label={t('inboxContext')}>
          <h3 className="inbox-context-title">{t('inboxContext')}</h3>
          {!selectedId ? (
            <p className="muted">{t('inboxContextEmpty')}</p>
          ) : identity ? (
            <div className="inbox-context-card">
              <p className="inbox-context-name">{identity.displayName || identity.value}</p>
              <p className="muted" style={{ fontSize: 13 }}>
                {identity.kind}: {identity.value}
              </p>
              <p className="muted" style={{ fontSize: 12 }}>
                {t('inboxConfidence')}: {identity.confidence}
              </p>
              {identity.customerId ? (
                <Link
                  className="btn"
                  style={{ marginTop: 10 }}
                  to={routes.customerDetail(identity.customerId)}
                >
                  {t('inboxOpenCustomer')}
                </Link>
              ) : (
                <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>
                  {t('inboxNoCustomerYet')}
                </p>
              )}
            </div>
          ) : (
            <p className="muted">{t('inboxContextEmpty')}</p>
          )}
        </aside>
      </div>
    </div>
  )
}
