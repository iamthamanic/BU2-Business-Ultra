/**
 * InboxPage — omnichannel messaging inbox (Telegram Bot E2E first).
 * Two-pane Dark-Ops: list · thread (CRM link lives in thread header).
 * Empty: finished chrome + FunnelConnectHint (no top panel, no fake rows).
 * Location: apps/web/src/features/inbox/InboxPage.tsx
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import {
  ArrowSquareOut,
  ArrowsClockwise,
  Buildings,
  DotsThreeVertical,
  MagnifyingGlass,
  PaperPlaneTilt,
  PlugsConnected,
  User,
  X,
} from '@phosphor-icons/react'
import { canMutateContent } from '@bu2/shared'
import type { CompanyOutletContext } from '../../components/BusinessShell'
import { MktTab, MktTabs } from '../../components/MktTabs'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { companyRoutes } from '../../lib/companyPaths'
import { ConnBrandLogo } from '../settings/connBrandLogos'
import { FunnelConnectHint } from '../marketing/FunnelConnectHint'
import { EmailComposerModal } from './EmailComposerModal'
import { InboxAssignModal } from './InboxAssignModal'
import { InboxChannelFilter } from './InboxChannelFilter'
import { InboxComposerBar, type ComposerAttachment } from './InboxComposerBar'
import { inboxChannelLabelKey, inboxLogoId } from './inboxChannel'
import type { InboxMessageFormat } from '@bu2/shared'

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
  connectionDisplayName?: string | null
  connectionProvider?: string | null
  title: string | null
  status: string
  lastMessageAt: string | null
  lastPreview: string | null
  contactIdentityId: string | null
  identityKind?: string | null
  identityValue?: string | null
  identityDisplayName?: string | null
  customerId?: string | null
  isExistingCustomer?: boolean
  assigneeUserId?: string | null
  assigneeDisplayName?: string | null
  unreadCount?: number
  isUnread?: boolean
}

type TeamMember = {
  userId: string
  displayName: string | null
  email: string
}

type InboxMessage = {
  id: string
  direction: string
  body: string
  deliveryStatus: string
  errorDetail: string | null
  sentAt: string | null
  createdAt: string
  actorName?: string | null
  actorAddress?: string | null
  viaAccount?: string | null
}

type Identity = {
  id: string
  kind: string
  value: string
  displayName: string | null
  customerId: string | null
  customerName?: string | null
  customerKind?: string | null
  confidence: string
} | null

type ListFilter = 'all' | 'open' | 'assigned' | 'unread' | 'archived'

export function InboxPage() {
  const { slug: paramSlug } = useParams()
  const ctx = useOutletContext<CompanyOutletContext | null>()
  const slug = paramSlug || ctx?.slug || ''
  const m = ctx?.membership
  const meId = ctx?.user?.id || null
  const canWrite = m
    ? canMutateContent({ isOwner: Boolean(m.isOwner), permissions: m.permissions ?? [] })
    : false
  const { t } = useI18n()
  const routes = companyRoutes(slug)

  const [connections, setConnections] = useState<InboxConnection[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [identity, setIdentity] = useState<Identity>(null)
  const [threadTitle, setThreadTitle] = useState<string | null>(null)
  const [threadChannel, setThreadChannel] = useState<string | null>(null)
  const [threadAccount, setThreadAccount] = useState<string | null>(null)
  const [threadAssigneeId, setThreadAssigneeId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [threadLoading, setThreadLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [reply, setReply] = useState('')
  const [emailHtmlDraft, setEmailHtmlDraft] = useState('')
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [sending, setSending] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [filter, setFilter] = useState<ListFilter>('all')
  const [listQuery, setListQuery] = useState('')
  const [enabledSourceIds, setEnabledSourceIds] = useState<string[]>([])
  const seenSourceIdsRef = useRef<Set<string>>(new Set())
  const [composerFormats, setComposerFormats] = useState<InboxMessageFormat[]>(['text'])
  const [threadMenuOpen, setThreadMenuOpen] = useState(false)
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const threadMenuRef = useRef<HTMLDivElement>(null)

  async function refreshList() {
    if (!slug) return
    setLoading(true)
    setError(null)
    try {
      const [c, conv, mem] = await Promise.all([
        api<{ connections: InboxConnection[] }>(`/api/b/${slug}/inbox/connections`),
        api<{ conversations: Conversation[] }>(`/api/b/${slug}/inbox/conversations`),
        api<{ members: TeamMember[] }>(`/api/b/${slug}/members`).catch(() => ({ members: [] })),
      ])
      setConnections(c.connections || [])
      setConversations(conv.conversations || [])
      setMembers(mem.members || [])
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
        conversation: {
          title: string | null
          channel?: string
          connectionDisplayName?: string | null
          connectionProvider?: string | null
          connectionExternalAccountId?: string | null
          assigneeUserId?: string | null
          composerFormats?: InboxMessageFormat[]
        }
        messages: InboxMessage[]
        identity: Identity
      }>(`/api/b/${slug}/inbox/conversations/${id}`)
      setMessages(data.messages || [])
      setIdentity(data.identity)
      setThreadTitle(data.conversation?.title || null)
      const fromList = conversations.find((c) => c.id === id)
      setThreadChannel(data.conversation?.channel || fromList?.channel || null)
      const accountLabel =
        data.conversation?.connectionDisplayName ||
        fromList?.connectionDisplayName ||
        data.conversation?.connectionExternalAccountId ||
        data.conversation?.connectionProvider ||
        fromList?.connectionProvider ||
        null
      setThreadAccount(accountLabel)
      setThreadAssigneeId(
        data.conversation?.assigneeUserId ?? fromList?.assigneeUserId ?? null,
      )
      setComposerFormats(
        data.conversation?.composerFormats?.length
          ? data.conversation.composerFormats
          : ['text'],
      )
      // Opening marks read server-side — clear unread in local list.
      setConversations((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, unreadCount: 0, isUnread: false } : c,
        ),
      )
    } catch (e) {
      setError(String((e as Error).message || e))
    } finally {
      setThreadLoading(false)
    }
  }

  async function patchAssignee(assigneeUserId: string | null) {
    if (!slug || !selectedId) return
    setAssigning(true)
    setError(null)
    try {
      await api(`/api/b/${slug}/inbox/conversations/${selectedId}`, {
        method: 'PATCH',
        body: JSON.stringify({ assigneeUserId }),
      })
      setThreadAssigneeId(assigneeUserId)
      const member = members.find((m) => m.userId === assigneeUserId)
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedId
            ? {
                ...c,
                assigneeUserId,
                assigneeDisplayName: member
                  ? member.displayName || member.email
                  : null,
              }
            : c,
        ),
      )
    } catch (e) {
      setError(String((e as Error).message || e))
    } finally {
      setAssigning(false)
    }
  }

  function mapInboxError(code: string): string {
    switch (code) {
      case 'gmail_api_disabled':
        return t('inboxErr_gmail_api_disabled')
      case 'gmail_insufficient_scopes':
        return t('inboxErr_gmail_insufficient_scopes')
      case 'gmail_api_403':
        return t('inboxErr_gmail_api_403')
      case 'gmail_token_expired':
        return t('inboxErr_gmail_token_expired')
      case 'media_unsupported_for_provider':
        return t('inboxErr_media_unsupported')
      case 'attachment_too_large':
        return t('inboxErr_attachment_too_large')
      case 'format_not_allowed':
        return t('inboxErr_format_not_allowed')
      default:
        return code
    }
  }

  async function syncAll() {
    if (!slug) return
    setSyncing(true)
    setError(null)
    try {
      const summary = await api<{
        results: Array<{ ok: boolean; error?: string; skipped?: boolean }>
        synced: number
        failed: number
      }>(`/api/b/${slug}/inbox/sync`, { method: 'POST' })
      const firstFail = summary.results.find((r) => !r.ok && r.error)
      if (firstFail?.error) {
        setError(mapInboxError(firstFail.error))
      } else if (summary.synced === 0 && summary.results.every((r) => r.skipped)) {
        setError(t('inboxErr_no_syncable'))
      }
      await refreshList()
      if (selectedId) await openThread(selectedId)
    } catch (e) {
      const code =
        e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : String(e)
      setError(mapInboxError(code))
    } finally {
      setSyncing(false)
    }
  }

  async function sendReplyBody(body: string, attachment?: ComposerAttachment) {
    if (!slug || !selectedId) return
    if (!body.trim() && !attachment) return
    setSending(true)
    setError(null)
    try {
      await api(`/api/b/${slug}/inbox/conversations/${selectedId}/reply`, {
        method: 'POST',
        body: JSON.stringify({
          body: body.trim().slice(0, 4000),
          attachment: attachment || undefined,
        }),
      })
      setReply('')
      setEmailHtmlDraft('')
      setEmailModalOpen(false)
      await openThread(selectedId)
      await refreshList()
    } catch (e) {
      const code =
        e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : String(e)
      setError(mapInboxError(code))
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    refreshList().catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  useEffect(() => {
    if (!threadMenuOpen) return
    function onDoc(e: MouseEvent) {
      if (!threadMenuRef.current?.contains(e.target as Node)) setThreadMenuOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setThreadMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [threadMenuOpen])

  useEffect(() => {
    if (!slug) return
    api<{ business: { name: string } }>(`/api/b/${slug}`)
      .then((r) => setCompanyName(r.business?.name || ''))
      .catch(() => setCompanyName(''))
  }, [slug])

  useEffect(() => {
    const ids = connections.map((c) => c.id)
    setEnabledSourceIds((prev) => {
      const next = new Set(prev.filter((id) => ids.includes(id)))
      for (const id of ids) {
        if (!seenSourceIdsRef.current.has(id)) next.add(id)
      }
      seenSourceIdsRef.current = new Set(ids)
      return ids.filter((id) => next.has(id))
    })
  }, [connections])

  const enabledSourceSet = useMemo(() => new Set(enabledSourceIds), [enabledSourceIds])

  const filtered = useMemo(() => {
    const needle = listQuery.trim().toLowerCase()
    const sourceFilterActive = connections.length > 0
    return conversations.filter((c) => {
      if (sourceFilterActive) {
        if (enabledSourceSet.size === 0) return false
        if (c.connectionId && !enabledSourceSet.has(c.connectionId)) return false
      }
      if (filter === 'open' && !(c.status === 'open' || c.status === 'active')) return false
      if (filter === 'archived' && !(c.status === 'archived' || c.status === 'closed')) return false
      if (filter === 'assigned' && !(meId && c.assigneeUserId === meId)) return false
      if (filter === 'unread' && !((c.unreadCount ?? 0) > 0 || c.isUnread)) return false
      if (!needle) return true
      const hay = [
        c.title,
        c.lastPreview,
        c.identityDisplayName,
        c.identityValue,
        c.connectionDisplayName,
        c.connectionProvider,
        c.channel,
        c.assigneeDisplayName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(needle)
    })
  }, [conversations, filter, meId, listQuery, connections.length, enabledSourceSet])

  const emptyList = !loading && filtered.length === 0
  const hasConnection = connections.length > 0
  /** Finished chrome without content — connect CTA lives inside the list pane. */
  const showPreviewChrome = !loading && !hasConnection

  const openCount = conversations.filter((c) => c.status === 'open' || c.status === 'active').length
  const assignedCount = conversations.filter((c) => meId && c.assigneeUserId === meId).length
  const unreadCount = conversations.filter((c) => (c.unreadCount ?? 0) > 0 || c.isUnread).length

  const threadTitleNorm = (threadTitle || '').trim().toLowerCase()
  const identityName = identity?.displayName?.trim() || null
  const identityValue = identity?.value?.trim() || null
  const senderNameUseful = Boolean(
    identityName &&
      identityName.toLowerCase() !== threadTitleNorm &&
      !threadTitleNorm.startsWith(identityName.toLowerCase()) &&
      (!identityValue || identityName.toLowerCase() !== identityValue.toLowerCase()),
  )
  const senderEmail = identityValue
  const senderLabel = senderNameUseful
    ? `${identityName} · ${identityValue}`
    : identityValue || identityName
  const ingressLabel = [
    threadChannel ? t(inboxChannelLabelKey(threadChannel)) : null,
    threadAccount,
  ]
    .filter(Boolean)
    .join(' · ')
  const isEmailChannel =
    (threadChannel || '').toLowerCase() === 'email' ||
    (identity?.kind || '').toLowerCase() === 'email'
  const assigneeName =
    members.find((m) => m.userId === threadAssigneeId)?.displayName ||
    members.find((m) => m.userId === threadAssigneeId)?.email ||
    null

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
        <div className="product-page-actions inbox-page-actions">
          <label className="inbox-search">
            <MagnifyingGlass size={14} weight="regular" aria-hidden />
            <input
              className="input inbox-search-input"
              type="search"
              value={listQuery}
              onChange={(e) => setListQuery(e.target.value)}
              placeholder={t('inboxSearchPh')}
              aria-label={t('inboxSearchPh')}
            />
          </label>
          <InboxChannelFilter
            connections={connections}
            enabledIds={enabledSourceIds}
            onChange={setEnabledSourceIds}
            label={t('inboxSources')}
            emptyLabel={t('inboxNoSources')}
            allLabel={t('inboxSourceAll')}
          />
          <button
            type="button"
            className="btn icon-btn"
            disabled={syncing || !canWrite}
            aria-label={syncing ? t('inboxSyncing') : t('inboxSync')}
            title={syncing ? t('inboxSyncing') : t('inboxSync')}
            onClick={() => syncAll().catch(console.error)}
          >
            <ArrowsClockwise
              size={16}
              weight="bold"
              aria-hidden
              className={syncing ? 'inbox-sync-spin' : undefined}
            />
          </button>
          <Link
            className="btn icon-btn"
            to={routes.settingsConnections}
            aria-label={t('connConnectAccount')}
            title={t('connConnectAccount')}
          >
            <PlugsConnected size={16} weight="bold" aria-hidden />
          </Link>
        </div>
      </header>

      {error ? (
        <p className="inbox-error" role="alert">
          {error}
        </p>
      ) : null}

      <div
        className="inbox-panes"
        data-has-thread={selectedId || showPreviewChrome ? 'true' : 'false'}
        data-preview={showPreviewChrome ? 'true' : 'false'}
      >
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
              label={`${t('inboxFilterAssigned')} ${assignedCount}`}
              onClick={() => setFilter('assigned')}
            />
            <MktTab
              active={filter === 'unread'}
              label={`${t('inboxFilterUnread')} ${unreadCount}`}
              onClick={() => setFilter('unread')}
            />
            <MktTab
              active={filter === 'archived'}
              label={t('inboxFilterArchived')}
              onClick={() => setFilter('archived')}
            />
          </MktTabs>

          {loading ? <p className="muted">{t('loading')}</p> : null}

          {showPreviewChrome ? (
            <div className="inbox-list-empty-slot">
              <FunnelConnectHint
                need="key"
                settingsHref={routes.settingsConnections}
                message={t('inboxConnectInSettings')}
              />
            </div>
          ) : null}

          {emptyList && hasConnection ? (
            <p className="muted inbox-empty">
              {enabledSourceIds.length === 0
                ? t('inboxSourcesFilteredEmpty')
                : filter === 'assigned'
                  ? t('inboxFilterAssignedEmpty')
                  : filter === 'unread'
                    ? t('inboxFilterUnreadEmpty')
                    : t('inboxEmpty')}
            </p>
          ) : null}

          <ul className="inbox-conv-list">
            {filtered.map((c) => {
              const chLabel = t(inboxChannelLabelKey(c.channel))
              const logoId = inboxLogoId(c.channel, c.connectionProvider)
              const isEmail =
                (c.channel || '').toLowerCase() === 'email' ||
                (c.identityKind || '').toLowerCase() === 'email'
              const when = fmtListWhen(c.lastMessageAt, t('inboxYesterday'))
              const senderName = c.identityDisplayName?.trim() || null
              const senderEmail = c.identityValue?.trim() || null
              const senderTitleUseful =
                senderName &&
                senderName.toLowerCase() !== (c.title || '').trim().toLowerCase() &&
                !((c.title || '').trim().toLowerCase().startsWith(senderName.toLowerCase()))
              const senderLine = [senderTitleUseful ? senderName : null, senderEmail]
                .filter(Boolean)
                .join(' · ')
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`inbox-conv${selectedId === c.id ? ' is-active' : ''}`}
                    onClick={() => openThread(c.id).catch(console.error)}
                    aria-label={`${c.title || t('inboxUnknown')} · ${chLabel}${when ? ` · ${when}` : ''}`}
                  >
                    <span className="inbox-conv-row">
                      <span className="inbox-conv-icon" title={chLabel} data-ch={c.channel}>
                        <ConnBrandLogo id={logoId} size="sm" />
                      </span>
                      <span className="inbox-conv-body">
                        <span className="inbox-conv-top">
                          <span className="inbox-conv-title">
                            {(c.unreadCount ?? 0) > 0 || c.isUnread ? (
                              <span className="inbox-unread-dot" aria-hidden />
                            ) : null}
                            <span className="inbox-conv-v">{c.title || t('inboxUnknown')}</span>
                          </span>
                          <span className="inbox-conv-top-end">
                            {(c.unreadCount ?? 0) > 0 ? (
                              <span className="inbox-unread-count">{c.unreadCount}</span>
                            ) : null}
                            {when ? (
                              <time
                                className="inbox-conv-time muted"
                                dateTime={c.lastMessageAt || undefined}
                              >
                                {when}
                              </time>
                            ) : null}
                          </span>
                        </span>
                        <span className="inbox-conv-sub muted">
                          {isEmail && senderLine ? (
                            <>
                              <span className="inbox-conv-from">{senderLine}</span>
                              <span className="inbox-conv-meta-sep" aria-hidden>
                                ·
                              </span>
                            </>
                          ) : null}
                          <span className="inbox-conv-channel">{chLabel}</span>
                          <span className="inbox-conv-meta-sep" aria-hidden>
                            ·
                          </span>
                          <span className="inbox-conv-account">
                            {c.connectionDisplayName || c.connectionProvider || '—'}
                          </span>
                        </span>
                        {c.lastPreview ? (
                          <span className="inbox-conv-preview muted">{c.lastPreview}</span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        <section className="inbox-thread" aria-label={t('inboxThread')}>
          {showPreviewChrome ? (
            <>
              <header className="inbox-thread-head">
                <div className="inbox-skel-line inbox-skel-line--title" aria-hidden />
                <div className="inbox-skel-line inbox-skel-line--meta" aria-hidden />
              </header>
              <div className="inbox-messages inbox-messages--preview">
                <div className="inbox-bubble inbox-bubble-inbound inbox-bubble--ghost" aria-hidden>
                  <div className="inbox-skel-line" />
                  <div className="inbox-skel-line inbox-skel-line--short" />
                </div>
                <div className="inbox-bubble inbox-bubble-outbound inbox-bubble--ghost" aria-hidden>
                  <div className="inbox-skel-line" />
                </div>
                <p className="muted inbox-empty inbox-empty--inline">{t('inboxPickConversation')}</p>
              </div>
              <form className="inbox-composer" onSubmit={(e) => e.preventDefault()}>
                <textarea
                  className="input inbox-composer-input"
                  rows={3}
                  disabled
                  placeholder={t('inboxReplyPh')}
                  aria-label={t('inboxReplyPh')}
                />
                <button type="button" className="btn primary" disabled>
                  <PaperPlaneTilt size={14} weight="bold" aria-hidden />
                  {t('inboxSend')}
                </button>
              </form>
            </>
          ) : !selectedId ? (
            <p className="muted inbox-empty">{t('inboxPickConversation')}</p>
          ) : threadLoading ? (
            <p className="muted">{t('loading')}</p>
          ) : (
            <>
              <header className="inbox-thread-head">
                <div className="inbox-thread-head-main">
                  <div className="inbox-thread-title-row">
                    {threadChannel ? (
                      <span
                        className="inbox-thread-channel-icon"
                        title={t(inboxChannelLabelKey(threadChannel))}
                      >
                        <ConnBrandLogo
                          id={inboxLogoId(
                            threadChannel,
                            conversations.find((c) => c.id === selectedId)?.connectionProvider,
                          )}
                          size="sm"
                        />
                      </span>
                    ) : null}
                    <div className="inbox-thread-title-stack">
                      <dl className="inbox-thread-fields">
                        <div className="inbox-thread-field inbox-thread-field--subject">
                          <dt>{t('inboxHeaderSubject')}</dt>
                          <dd>
                            <h2 className="inbox-thread-title">
                              {threadTitle || t('inboxUnknown')}
                            </h2>
                          </dd>
                        </div>
                        {senderEmail || senderLabel ? (
                          <div className="inbox-thread-field">
                            <dt>{t('inboxHeaderFrom')}</dt>
                            <dd title={senderEmail || senderLabel || undefined}>
                              {senderEmail || senderLabel}
                            </dd>
                          </div>
                        ) : null}
                        {ingressLabel ? (
                          <div className="inbox-thread-field">
                            <dt>{t('inboxHeaderIngress')}</dt>
                            <dd title={ingressLabel}>{ingressLabel}</dd>
                          </div>
                        ) : null}
                      </dl>
                    </div>
                  </div>
                </div>
                <div className="inbox-thread-head-actions">
                  <div className="inbox-thread-actions-stack">
                    {identity?.customerId ? (
                      <Link
                        className="inbox-crm-row"
                        to={routes.customerDetail(identity.customerId)}
                        title={t('inboxOpenCustomer')}
                      >
                        <span className="inbox-crm-kind" data-kind={identity.customerKind || 'person'}>
                          {(identity.customerKind || 'person') === 'org' ? (
                            <Buildings size={13} weight="bold" aria-hidden />
                          ) : (
                            <User size={13} weight="bold" aria-hidden />
                          )}
                        </span>
                        <span className="inbox-crm-meta">
                          <span className="inbox-crm-name">
                            {identity.customerName ||
                              identity.displayName ||
                              identity.value ||
                              t('inboxUnknown')}
                          </span>
                          <span className="badge inbox-crm-kind-badge">
                            {(identity.customerKind || 'person') === 'org'
                              ? t('customerKindOrg')
                              : t('customerKindPerson')}
                          </span>
                        </span>
                        <ArrowSquareOut
                          className="inbox-crm-open"
                          size={14}
                          weight="bold"
                          aria-hidden
                        />
                      </Link>
                    ) : identity ? (
                      <span
                        className="inbox-customer-pill inbox-customer-pill--ghost"
                        title={t('inboxNoCustomerYet')}
                      >
                        {t('inboxNoCustomerShort')}
                      </span>
                    ) : null}
                  </div>
                  <div className="inbox-thread-actions-end">
                    <button
                      type="button"
                      className="btn icon-btn inbox-thread-close"
                      aria-label={t('inboxCloseThread')}
                      title={t('inboxCloseThread')}
                      onClick={() => {
                        setSelectedId(null)
                        setMessages([])
                        setIdentity(null)
                        setThreadTitle(null)
                        setThreadChannel(null)
                        setThreadAccount(null)
                        setThreadAssigneeId(null)
                        setComposerFormats(['text'])
                        setThreadMenuOpen(false)
                        setAssignModalOpen(false)
                        setEmailModalOpen(false)
                        setReply('')
                        setEmailHtmlDraft('')
                      }}
                    >
                      <X size={14} weight="bold" aria-hidden />
                    </button>
                    {canWrite ? (
                      <div
                        ref={threadMenuRef}
                        className={`inbox-thread-menu${threadMenuOpen ? ' is-open' : ''}`}
                      >
                        <button
                          type="button"
                          className="btn icon-btn"
                          aria-label={t('inboxThreadMore')}
                          title={t('inboxThreadMore')}
                          aria-haspopup="menu"
                          aria-expanded={threadMenuOpen}
                          onClick={() => setThreadMenuOpen((v) => !v)}
                        >
                          <DotsThreeVertical size={16} weight="bold" aria-hidden />
                        </button>
                        {threadMenuOpen ? (
                          <div className="inbox-thread-menu-panel" role="menu">
                            <button
                              type="button"
                              role="menuitem"
                              className="inbox-thread-menu-item"
                              disabled={assigning}
                              onClick={() => {
                                setThreadMenuOpen(false)
                                setAssignModalOpen(true)
                              }}
                            >
                              {t('inboxAssignAction')}
                              {assigneeName ? (
                                <span className="muted inbox-thread-menu-meta">{assigneeName}</span>
                              ) : null}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </header>
              <div className="inbox-messages">
                {messages.map((m) => {
                  const who =
                    m.direction === 'outbound'
                      ? [m.viaAccount || m.actorAddress || threadAccount, m.actorName]
                          .filter(Boolean)
                          .join(' · ')
                      : senderEmail ||
                        m.actorAddress ||
                        [m.actorName, m.actorAddress].filter(Boolean).join(' · ') ||
                        senderLabel ||
                        '—'
                  const when = fmtMessageWhen(m.sentAt || m.createdAt)
                  const statusLabel =
                    m.direction === 'outbound'
                      ? m.deliveryStatus === 'failed'
                        ? `${t('inboxFailed')}${m.errorDetail ? `: ${m.errorDetail}` : ''}`
                        : m.deliveryStatus === 'pending'
                          ? t('inboxPending')
                          : t('inboxSent')
                      : t('inboxReceived')
                  return (
                    <div
                      key={m.id}
                      className={`inbox-bubble inbox-bubble-${m.direction}`}
                      data-status={m.deliveryStatus}
                    >
                      {who ? <span className="inbox-bubble-actor">{who}</span> : null}
                      <p className="inbox-bubble-body">{m.body}</p>
                      <span className="inbox-bubble-meta muted">
                        {statusLabel}
                        {when ? ` · ${when}` : ''}
                      </span>
                    </div>
                  )
                })}
              </div>
              {canWrite ? (
                isEmailChannel ? (
                  <form className="inbox-composer" onSubmit={(e) => e.preventDefault()}>
                    <button
                      type="button"
                      className="input inbox-composer-input inbox-composer-trigger"
                      onClick={() => setEmailModalOpen(true)}
                      onFocus={() => setEmailModalOpen(true)}
                    >
                      {reply.trim() ||
                        emailPlainPreview(emailHtmlDraft) ||
                        t('inboxEmailOpenComposer')}
                    </button>
                    <button
                      type="button"
                      className="btn primary"
                      disabled={sending}
                      onClick={() => setEmailModalOpen(true)}
                    >
                      <PaperPlaneTilt size={14} weight="bold" aria-hidden />
                      {sending ? t('loading') : t('inboxEmailOpenComposerShort')}
                    </button>
                  </form>
                ) : (
                  <InboxComposerBar
                    formats={composerFormats}
                    reply={reply}
                    onReplyChange={setReply}
                    placeholder={
                      threadChannel
                        ? `${t('inboxReplyPh')} (${threadChannel})`
                        : t('inboxReplyPh')
                    }
                    sending={sending}
                    sendLabel={t('inboxSend')}
                    attachLabel={t('inboxAttach')}
                    voiceLabel={t('inboxVoice')}
                    voiceStopLabel={t('inboxVoiceStop')}
                    pendingLabel={t('inboxAttachClear')}
                    onSend={({ body, attachment }) => {
                      void sendReplyBody(body, attachment)
                    }}
                  />
                )
              ) : null}
            </>
          )}
        </section>
      </div>

      <EmailComposerModal
        open={emailModalOpen}
        busy={sending}
        error={error}
        context={{
          subject: threadTitle || t('inboxUnknown'),
          toEmail: senderEmail,
          toName: senderNameUseful ? identityName : null,
          fromAccount: threadAccount,
          companyName: companyName || slug,
          assigneeName,
        }}
        history={messages.map((m) => ({
          id: m.id,
          direction: m.direction,
          body: m.body,
          when: fmtMessageWhen(m.sentAt || m.createdAt),
          // Same actor label as thread bubbles — email/address before subject-like names.
          who:
            m.direction === 'outbound'
              ? [m.viaAccount || m.actorAddress || threadAccount, m.actorName]
                  .filter(Boolean)
                  .join(' · ') || t('inboxSend')
              : senderEmail ||
                m.actorAddress ||
                [m.actorName, m.actorAddress].filter(Boolean).join(' · ') ||
                senderLabel ||
                t('inboxUnknown'),
        }))}
        initialHtml={emailHtmlDraft}
        onClose={() => setEmailModalOpen(false)}
        onSend={(plain, html) => {
          setEmailHtmlDraft(html)
          setReply(plain)
          void sendReplyBody(plain)
        }}
      />

      <InboxAssignModal
        open={assignModalOpen}
        busy={assigning}
        title={t('inboxAssignAction')}
        noneLabel={t('inboxAssigneeNone')}
        cancelLabel={t('cancel')}
        members={members}
        selectedId={threadAssigneeId}
        onClose={() => setAssignModalOpen(false)}
        onAssign={(userId) => {
          void patchAssignee(userId).then(() => setAssignModalOpen(false))
        }}
      />
    </div>
  )
}

function fmtMessageWhen(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fmtListWhen(iso: string | null | undefined, yesterdayLabel: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  const now = new Date()
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === now.toDateString()) return time
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return `${yesterdayLabel} ${time}`
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function emailPlainPreview(html: string): string {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
