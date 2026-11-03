/**
 * CustomerDetail — Dark-Ops CRM detail: identity header, icon tabs, panel workstations.
 * Location: apps/web/src/features/customer/CustomerDetail.tsx
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import {
  ArrowSquareOut,
  Buildings,
  ChartBar,
  ChatCircle,
  ClipboardText,
  Copy,
  DotsThree,
  DotsThreeCircle,
  EnvelopeSimple,
  Folders,
  Handshake,
  IdentificationCard,
  MagnifyingGlass,
  PencilSimple,
  Phone,
  Plus,
  SealCheck,
  X,
  SquaresFour,
  ClockCounterClockwise,
  Trash,
  User,
  UserPlus,
  UsersThree,
  WhatsappLogo,
} from '@phosphor-icons/react'
import { CrmIconSelect, type CrmIconSelectOption } from '../../components/CrmIconSelect'
import { FunnelDateRangePicker } from '../../components/FunnelDateRangePicker'
import { FunnelTip } from '../../components/FunnelTip'
import { MktTab, MktTabs } from '../../components/MktTabs'
import { api } from '../../lib/api'
import { dateInRange, defaultDateRange, ORGANIC_PRESETS } from '../../lib/dateRange'
import { useI18n } from '../../lib/i18n'
import type { MessageKey } from '../../i18n/messages'
import { companyRoutes } from '../../lib/companyPaths'
import type { CustomerOutletContext } from './CustomerShell'
import {
  CustomerNoteEditor,
  NoteBodyHtml,
  notePlainText,
  sanitizeNoteHtml,
} from './CustomerNoteEditor'
import type {
  BuCustomer,
  BuCustomerConsent,
  BuCustomerEvent,
  BuCustomerNote,
  BuCustomerStats,
  BuLinkedTask,
} from './customerTypes'

type Tab = 'overview' | 'profile' | 'comms' | 'history' | 'cases'
type TFn = (k: MessageKey) => string

type DetailPayload = {
  customer: BuCustomer
  notes: BuCustomerNote[]
  consents: BuCustomerConsent[]
  events: BuCustomerEvent[]
  linkedTasks: BuLinkedTask[]
  linkedProjects: { id: string; name: string }[]
  stats: BuCustomerStats
  channels: Record<string, { connected: boolean }>
}

type PersonaOption = { id: string; name: string; summary?: string | null }
type ProductOption = { id: string; name: string; sellingPriceCents?: number }

function formatMoney(cents: number, currency = 'EUR'): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`
  }
}

function emptyStats(): BuCustomerStats {
  return {
    ltvCents: 0,
    currency: 'EUR',
    customerSince: new Date().toISOString(),
    customerDays: 0,
    purchaseCount: 0,
    persona: null,
    products: [],
    purchases: [],
  }
}

const TABS: { id: Tab; labelKey: MessageKey; Icon: typeof SquaresFour }[] = [
  { id: 'overview', labelKey: 'customerTabOverview', Icon: SquaresFour },
  { id: 'profile', labelKey: 'customerTabProfile', Icon: IdentificationCard },
  { id: 'comms', labelKey: 'customerTabComms', Icon: ChatCircle },
  { id: 'history', labelKey: 'customerTabHistory', Icon: ClockCounterClockwise },
  { id: 'cases', labelKey: 'customerTabCases', Icon: Folders },
]

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
}

function statusLabel(s: string, t: TFn): string {
  if (s === 'prospect') return t('customerStatusProspect')
  if (s === 'customer') return t('customerStatusCustomer')
  return t('customerStatusLead')
}

function statusIcon(s: string) {
  if (s === 'prospect') return <Handshake size={12} weight="regular" aria-hidden />
  if (s === 'customer') return <SealCheck size={12} weight="regular" aria-hidden />
  return <UserPlus size={12} weight="regular" aria-hidden />
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const HISTORY_TYPES = ['created', 'updated', 'note', 'communication', 'consent'] as const

function historyTypeLabel(type: string, t: TFn): string {
  const key = `customerHistoryType_${type}` as MessageKey
  const labeled = t(key)
  return labeled === key ? type : labeled
}

function historyTypeTone(type: string): string {
  if (type === 'note') return 'accent'
  if (type === 'communication') return 'good'
  if (type === 'consent') return 'warn'
  if (type === 'created') return 'good'
  if (type === 'updated') return 'dim'
  return 'dim'
}

function HistoryTypeIcon({ type }: { type: string }) {
  if (type === 'note') return <ClipboardText size={15} weight="regular" aria-hidden />
  if (type === 'communication') return <ChatCircle size={15} weight="regular" aria-hidden />
  if (type === 'consent') return <SealCheck size={15} weight="regular" aria-hidden />
  if (type === 'created') return <UserPlus size={15} weight="regular" aria-hidden />
  if (type === 'updated') return <PencilSimple size={15} weight="regular" aria-hidden />
  return <ClockCounterClockwise size={15} weight="regular" aria-hidden />
}

function formatBirthDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function birthDateInputValue(iso: string | null | undefined): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

export function CustomerDetail() {
  const { id } = useParams()
  const ctx = useOutletContext<CustomerOutletContext>()
  const slug = ctx?.slug || ''
  const canWrite = ctx?.canWrite ?? false
  const { t } = useI18n()
  const navigate = useNavigate()
  const routes = companyRoutes(slug)

  const [tab, setTab] = useState<Tab>('overview')
  const [data, setData] = useState<DetailPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [noteBody, setNoteBody] = useState('')
  const [noteCreateOpen, setNoteCreateOpen] = useState(false)
  const [noteCreating, setNoteCreating] = useState(false)
  const [noteSearch, setNoteSearch] = useState('')
  const [noteDateRange, setNoteDateRange] = useState(() => defaultDateRange('all'))
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNoteBody, setEditingNoteBody] = useState('')
  const [noteBusyId, setNoteBusyId] = useState<string | null>(null)
  const [noteMenuId, setNoteMenuId] = useState<string | null>(null)
  const [noteMenuPos, setNoteMenuPos] = useState<{ top: number; left: number } | null>(null)
  const noteMenuRef = useRef<HTMLDivElement | null>(null)
  const noteMenuBtnRef = useRef<HTMLButtonElement | null>(null)
  const [catalogTags, setCatalogTags] = useState<{ id: string; name: string; color: string | null }[]>(
    [],
  )
  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [tagsBusy, setTagsBusy] = useState(false)
  const [commSummary, setCommSummary] = useState('')
  const [commChannel, setCommChannel] = useState<'email' | 'phone' | 'whatsapp' | 'meeting' | 'other'>(
    'email',
  )
  const [consentPurpose, setConsentPurpose] = useState('')
  const [caseFilter, setCaseFilter] = useState<'all' | 'open' | 'in_progress' | 'done'>('all')
  const [historyType, setHistoryType] = useState('all')
  const [billingSame, setBillingSame] = useState(true)
  const [statsOpen, setStatsOpen] = useState(false)
  const [personaOptions, setPersonaOptions] = useState<PersonaOption[]>([])
  const [productOptions, setProductOptions] = useState<ProductOption[]>([])
  const [purchaseLabel, setPurchaseLabel] = useState('')
  const [purchaseAmount, setPurchaseAmount] = useState('')
  const [purchaseProductId, setPurchaseProductId] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [statsBusy, setStatsBusy] = useState(false)
  const [err, setErr] = useState('')

  async function refresh() {
    if (!slug || !id) return
    setLoading(true)
    try {
      const [r, tagRes] = await Promise.all([
        api<DetailPayload>(`/api/b/${slug}/customers/${id}`),
        api<{
          labels?: { id: string; name: string; color: string | null }[]
          tags?: { id: string; name: string; color: string | null }[]
        }>(`/api/b/${slug}/labels?scope=customer`).catch(() => ({
          labels: [] as { id: string; name: string; color: string | null }[],
          tags: [] as { id: string; name: string; color: string | null }[],
        })),
      ])
      setData({ ...r, stats: r.stats || emptyStats() })
      setCatalogTags(tagRes.labels || tagRes.tags || [])
      const c = r.customer
      const same =
        !(c.billingStreet || c.billingPostalCode || c.billingCity || c.billingCountry) ||
        ((c.billingStreet || '') === (c.street || '') &&
          (c.billingPostalCode || '') === (c.postalCode || '') &&
          (c.billingCity || '') === (c.city || '') &&
          (c.billingCountry || '') === (c.country || ''))
      setBillingSame(same)
    } catch (e) {
      setErr((e as Error).message)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh().catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, id])

  useEffect(() => {
    if (!statsOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !statsBusy) setStatsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [statsOpen, statsBusy])

  const filteredEvents = useMemo(() => {
    if (!data) return []
    if (historyType === 'all') return data.events
    return data.events.filter((ev) => ev.type === historyType)
  }, [data, historyType])

  const filteredTasks = useMemo(() => {
    if (!data) return []
    if (caseFilter === 'all') return data.linkedTasks
    return data.linkedTasks.filter((task) => task.status === caseFilter)
  }, [data, caseFilter])

  const filteredNotes = useMemo(() => {
    if (!data) return []
    const q = noteSearch.trim().toLowerCase()
    return data.notes.filter((n) => {
      if (q) {
        const author = (n.authorDisplayName || '').toLowerCase()
        const body = notePlainText(n.body).toLowerCase()
        if (!body.includes(q) && !author.includes(q)) return false
      }
      if (!dateInRange(n.createdAt, noteDateRange.from, noteDateRange.to)) return false
      return true
    })
  }, [data, noteSearch, noteDateRange])

  const commEvents = useMemo(
    () => (data?.events || []).filter((ev) => ev.type === 'communication'),
    [data],
  )

  function closeNoteMenu() {
    setNoteMenuId(null)
    setNoteMenuPos(null)
  }

  function openNoteMenu(noteId: string, btn: HTMLButtonElement) {
    if (noteMenuId === noteId) {
      closeNoteMenu()
      return
    }
    const r = btn.getBoundingClientRect()
    const menuW = 176
    const menuH = 118
    let top = r.bottom + 4
    let left = r.right - menuW
    if (left < 8) left = 8
    if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8
    if (top + menuH > window.innerHeight - 8) top = Math.max(8, r.top - menuH - 4)
    noteMenuBtnRef.current = btn
    setNoteMenuPos({ top, left })
    setNoteMenuId(noteId)
  }

  function startEditNote(note: BuCustomerNote) {
    closeNoteMenu()
    setEditingNoteId(note.id)
    setEditingNoteBody(note.body)
  }

  function cancelEditNote() {
    setEditingNoteId(null)
    setEditingNoteBody('')
  }

  async function createNote() {
    if (!slug || !id || !notePlainText(noteBody)) return
    setNoteCreating(true)
    try {
      await api(`/api/b/${slug}/customers/${id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ body: sanitizeNoteHtml(noteBody) }),
      })
      setNoteBody('')
      setNoteCreateOpen(false)
      await refresh()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setNoteCreating(false)
    }
  }

  async function openStatsModal() {
    setStatsOpen(true)
    if (!slug) return
    try {
      const [p, prod] = await Promise.all([
        api<{ personas: PersonaOption[] }>(`/api/b/${slug}/personas`).catch(() => ({
          personas: [] as PersonaOption[],
        })),
        api<{ products: ProductOption[] }>(`/api/b/${slug}/products`).catch(() => ({
          products: [] as ProductOption[],
        })),
      ])
      setPersonaOptions(p.personas || [])
      setProductOptions(prod.products || [])
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  async function saveBuyerPersona(personaId: string | null) {
    if (!slug || !id) return
    setStatsBusy(true)
    try {
      const r = await api<{ stats: BuCustomerStats }>(`/api/b/${slug}/customers/${id}/stats`, {
        method: 'PATCH',
        body: JSON.stringify({ buyerPersonaId: personaId }),
      })
      if (data) setData({ ...data, stats: r.stats, customer: { ...data.customer, buyerPersonaId: personaId } })
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setStatsBusy(false)
    }
  }

  async function addPurchase() {
    if (!slug || !id) return
    const product = productOptions.find((p) => p.id === purchaseProductId)
    const label = purchaseLabel.trim() || product?.name || ''
    if (!label) return
    const euros = Number(purchaseAmount.replace(',', '.'))
    if (!Number.isFinite(euros) || euros < 0) {
      setErr(t('customerStatsPurchaseAmount'))
      return
    }
    setStatsBusy(true)
    try {
      const purchasedAt = purchaseDate
        ? new Date(`${purchaseDate}T12:00:00`).toISOString()
        : undefined
      const r = await api<{ stats: BuCustomerStats }>(`/api/b/${slug}/customers/${id}/purchases`, {
        method: 'POST',
        body: JSON.stringify({
          label,
          amountCents: Math.round(euros * 100),
          currency: 'EUR',
          productId: purchaseProductId || null,
          purchasedAt,
        }),
      })
      setPurchaseLabel('')
      setPurchaseAmount('')
      setPurchaseProductId('')
      if (data) setData({ ...data, stats: r.stats })
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setStatsBusy(false)
    }
  }

  async function removePurchase(purchaseId: string) {
    if (!slug || !id) return
    if (!window.confirm(t('customerStatsPurchaseDelete'))) return
    setStatsBusy(true)
    try {
      const r = await api<{ stats: BuCustomerStats }>(
        `/api/b/${slug}/customers/${id}/purchases/${purchaseId}`,
        { method: 'DELETE' },
      )
      if (data) setData({ ...data, stats: r.stats })
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setStatsBusy(false)
    }
  }

  async function saveEditNote(noteId: string) {
    if (!slug || !id || !notePlainText(editingNoteBody)) return
    setNoteBusyId(noteId)
    try {
      await api(`/api/b/${slug}/customers/${id}/notes/${noteId}`, {
        method: 'PATCH',
        body: JSON.stringify({ body: sanitizeNoteHtml(editingNoteBody) }),
      })
      cancelEditNote()
      await refresh()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setNoteBusyId(null)
    }
  }

  async function deleteNote(noteId: string) {
    if (!slug || !id) return
    if (!window.confirm(t('customerNoteDeleteConfirm'))) return
    closeNoteMenu()
    setNoteBusyId(noteId)
    try {
      await api(`/api/b/${slug}/customers/${id}/notes/${noteId}`, { method: 'DELETE' })
      if (editingNoteId === noteId) cancelEditNote()
      await refresh()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setNoteBusyId(null)
    }
  }

  async function duplicateNote(note: BuCustomerNote) {
    if (!slug || !id || !note.body.trim()) return
    closeNoteMenu()
    setNoteBusyId(note.id)
    try {
      await api(`/api/b/${slug}/customers/${id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ body: note.body.trim() }),
      })
      await refresh()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setNoteBusyId(null)
    }
  }

  useEffect(() => {
    if (!noteMenuId) return
    function onDoc(e: MouseEvent) {
      const target = e.target as Node
      if (noteMenuRef.current?.contains(target)) return
      if (noteMenuBtnRef.current?.contains(target)) return
      closeNoteMenu()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeNoteMenu()
    }
    function onScroll() {
      closeNoteMenu()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [noteMenuId])

  const channelOptions = useMemo<CrmIconSelectOption[]>(
    () => [
      {
        value: 'email',
        label: t('customerChannelEmail'),
        icon: <EnvelopeSimple size={14} weight="regular" aria-hidden />,
      },
      {
        value: 'phone',
        label: t('customerChannelPhone'),
        icon: <Phone size={14} weight="regular" aria-hidden />,
      },
      {
        value: 'whatsapp',
        label: t('customerChannelWhatsapp'),
        icon: <WhatsappLogo size={14} weight="regular" aria-hidden />,
      },
      {
        value: 'meeting',
        label: t('customerChannelMeeting'),
        icon: <UsersThree size={14} weight="regular" aria-hidden />,
      },
      {
        value: 'other',
        label: t('customerChannelOther'),
        icon: <DotsThreeCircle size={14} weight="regular" aria-hidden />,
      },
    ],
    [t],
  )

  const statusOptions = useMemo<CrmIconSelectOption[]>(() => {
    const opts: CrmIconSelectOption[] = [
      {
        value: 'lead',
        label: t('customerStatusLead'),
        icon: <UserPlus size={14} weight="regular" aria-hidden />,
        tone: 'lead',
      },
      {
        value: 'customer',
        label: t('customerStatusCustomer'),
        icon: <SealCheck size={14} weight="regular" aria-hidden />,
        tone: 'customer',
      },
    ]
    // Legacy: keep selectable only while still assigned, so status can be changed away.
    if (data?.customer.relationStatus === 'prospect') {
      opts.splice(1, 0, {
        value: 'prospect',
        label: t('customerStatusProspect'),
        icon: <Handshake size={14} weight="regular" aria-hidden />,
        tone: 'prospect',
      })
    }
    return opts
  }, [t, data?.customer.relationStatus])

  const kindOptions = useMemo<CrmIconSelectOption[]>(
    () => [
      {
        value: 'person',
        label: t('customerKindPerson'),
        icon: <User size={14} weight="regular" aria-hidden />,
      },
      {
        value: 'org',
        label: t('customerKindOrg'),
        icon: <Buildings size={14} weight="regular" aria-hidden />,
      },
    ],
    [t],
  )

  if (loading && !data) {
    return (
      <div className="stack mkt-shell product-shell crm-shell crm-detail-loading" aria-busy>
        <span className="crm-skel crm-skel-line" style={{ width: '28%' }} />
        <span className="crm-skel crm-skel-line" style={{ width: '48%', height: 22 }} />
        <span className="crm-skel crm-skel-line crm-skel-line--sm" style={{ width: '36%' }} />
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <span className="crm-skel crm-skel-pill" />
          <span className="crm-skel crm-skel-pill" />
          <span className="crm-skel crm-skel-pill" />
        </div>
        <div className="panel" style={{ padding: 16, marginTop: 8 }}>
          <span className="crm-skel crm-skel-line" style={{ width: '70%' }} />
          <span className="crm-skel crm-skel-line crm-skel-line--sm" style={{ width: '52%', marginTop: 10 }} />
        </div>
      </div>
    )
  }
  if (!data) return <p className="error">{err || t('notFound')}</p>

  const c = data.customer
  const since = new Date(c.createdAt).toLocaleDateString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  async function patch(body: Record<string, unknown>) {
    if (!canWrite) return
    await api(`/api/b/${slug}/customers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
    await refresh()
  }

  async function saveCustomerTags(next: string[]) {
    if (!canWrite || !slug || !id || !data) return
    const tags = [...new Set(next.map((t) => t.trim()).filter(Boolean))].slice(0, 40)
    setTagsBusy(true)
    try {
      await api(`/api/b/${slug}/customers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ tags }),
      })
      setData({ ...data, customer: { ...data.customer, tags } })
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setTagsBusy(false)
    }
  }

  async function addCatalogTag(name: string) {
    const tag = name.trim()
    if (!tag || !data) return
    const current = data.customer.tags || []
    if (current.includes(tag)) {
      setTagPickerOpen(false)
      return
    }
    await saveCustomerTags([...current, tag])
    setTagPickerOpen(false)
  }

  async function createAndAssignTag() {
    const tag = newTagName.trim()
    if (!tag || !slug || !canWrite) return
    setTagsBusy(true)
    try {
      const r = await api<{
        label?: { id: string; name: string; color: string | null }
        tag?: { id: string; name: string; color: string | null }
      }>(`/api/b/${slug}/labels`, {
        method: 'POST',
        body: JSON.stringify({ name: tag, scope: 'customer' }),
      })
      const created = r.label || r.tag
      if (!created) throw new Error('label_create_failed')
      setCatalogTags((prev) =>
        prev.some((t) => t.id === created.id)
          ? prev
          : [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
      )
      setNewTagName('')
      const current = data?.customer.tags || []
      if (!current.includes(created.name)) {
        await saveCustomerTags([...current, created.name])
      } else {
        setTagsBusy(false)
      }
      setTagPickerOpen(false)
    } catch (e) {
      setErr((e as Error).message)
      setTagsBusy(false)
    }
  }

  function tagColor(name: string): string | null {
    return catalogTags.find((t) => t.name === name)?.color ?? null
  }

  return (
    <div className="stack mkt-shell product-shell crm-shell">
      <header className="product-page-head customer-detail-head">
        <div className="customer-identity">
          <Link to={routes.customer} className="muted customer-back">
            ← {t('customer')}
          </Link>
          <div className="customer-identity-row">
            <span className="customer-av" aria-hidden>
              {initials(c.displayName)}
            </span>
            <div className="customer-identity-text">
              <div className="customer-title-row">
                <h1 className="section-title product-page-title" style={{ margin: 0 }}>
                  {c.displayName}
                </h1>
                <span className="crm-tag crm-tag--kind">
                  {c.kind === 'org' ? (
                    <Buildings size={12} weight="regular" aria-hidden />
                  ) : (
                    <User size={12} weight="regular" aria-hidden />
                  )}
                  {c.kind === 'org' ? t('customerKindOrg') : t('customerKindPerson')}
                </span>
                <span className={`crm-status crm-status--${c.relationStatus}`}>
                  {statusIcon(c.relationStatus)}
                  {statusLabel(c.relationStatus, t)}
                </span>
              </div>
              <div className="customer-meta-row">
                {c.email ? (
                  <span className="customer-meta-item">
                    <EnvelopeSimple size={14} weight="regular" aria-hidden />
                    {c.email}
                  </span>
                ) : null}
                {c.phone ? (
                  <span className="customer-meta-item">
                    <Phone size={14} weight="regular" aria-hidden />
                    {c.phone}
                  </span>
                ) : null}
                <span className="customer-meta-item muted">
                  {t('customerSince')} {since}
                </span>
              </div>
            </div>
          </div>
        </div>
        {canWrite ? (
          <div className="product-page-actions">
            {c.archivedAt ? (
              <button
                type="button"
                className="btn"
                onClick={async () => {
                  await api(`/api/b/${slug}/customers/${id}/restore`, { method: 'POST' })
                  await refresh()
                  await ctx.refreshList?.()
                }}
              >
                {t('restore')}
              </button>
            ) : (
              <button
                type="button"
                className="btn ghost"
                onClick={async () => {
                  await api(`/api/b/${slug}/customers/${id}/archive`, { method: 'POST' })
                  await ctx.refreshList?.()
                  navigate(routes.customer)
                }}
              >
                {t('archive')}
              </button>
            )}
          </div>
        ) : null}
      </header>

      <MktTabs level="surface" label={t('customer')} className="crm-detail-tabs">
        {TABS.map(({ id: tabId, labelKey, Icon }) => (
          <MktTab
            key={tabId}
            active={tab === tabId}
            label={t(labelKey)}
            icon={Icon}
            onClick={() => setTab(tabId)}
          />
        ))}
      </MktTabs>

      {tab === 'overview' ? (
        <div className="crm-tab-panel">
          <div className="customer-overview-grid">
            <section className="panel customer-card customer-notes-panel customer-overview-card">
              <header className="customer-card-head customer-notes-head">
                <h2 className="crm-section-title" style={{ margin: 0 }}>
                  {t('customerNotes')}
                </h2>
                <div className="customer-notes-tools">
                  {data.notes.length > 0 ? (
                    <>
                      <FunnelDateRangePicker
                        className="customer-notes-dr"
                        value={noteDateRange}
                        onChange={setNoteDateRange}
                        presets={ORGANIC_PRESETS}
                        hideCompare
                        compact
                        showLabel={false}
                        popoverAlign="end"
                      />
                      <label className="customer-notes-search">
                        <MagnifyingGlass size={14} weight="regular" aria-hidden />
                        <input
                          type="search"
                          className="input customer-notes-search-input"
                          value={noteSearch}
                          onChange={(e) => setNoteSearch(e.target.value)}
                          placeholder={t('customerNotesSearchPh')}
                          aria-label={t('customerNotesSearchPh')}
                        />
                      </label>
                    </>
                  ) : null}
                  {canWrite ? (
                    <button
                      type="button"
                      className="btn primary customer-notes-add"
                      aria-label={t('customerNoteAdd')}
                      title={t('customerNoteAdd')}
                      onClick={() => {
                        setNoteBody('')
                        setNoteCreateOpen(true)
                      }}
                    >
                      {t('customerNoteAddShort')}
                    </button>
                  ) : null}
                </div>
              </header>
              {data.notes.length === 0 ? (
                <div className="customer-empty-block">
                  <ClipboardText size={22} weight="regular" aria-hidden />
                  <p className="muted" style={{ margin: 0 }}>
                    {t('customerNotesEmpty')}
                  </p>
                </div>
              ) : filteredNotes.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>
                  {t('customerNotesFilterEmpty')}
                </p>
              ) : (
                <ul className="customer-note-list">
                  {filteredNotes.map((n) => {
                    const author =
                      n.authorDisplayName?.trim() || t('customerNoteAuthorUnknown')
                    const isEditing = editingNoteId === n.id
                    const busy = noteBusyId === n.id
                    const edited =
                      n.updatedAt &&
                      n.createdAt &&
                      new Date(n.updatedAt).getTime() - new Date(n.createdAt).getTime() > 1000
                    return (
                      <li key={n.id} className="customer-note-card">
                        {isEditing ? (
                          <div className="customer-note-edit">
                            <CustomerNoteEditor
                              key={n.id}
                              value={editingNoteBody}
                              onChange={setEditingNoteBody}
                              disabled={busy}
                              placeholder={t('customerNotePh')}
                              autoFocus
                              rows={4}
                            />
                            <div className="customer-note-edit-actions">
                              <button
                                type="button"
                                className="btn"
                                disabled={busy}
                                onClick={cancelEditNote}
                              >
                                {t('customerNoteCancel')}
                              </button>
                              <button
                                type="button"
                                className="btn primary"
                                disabled={busy || !notePlainText(editingNoteBody)}
                                onClick={() => void saveEditNote(n.id)}
                              >
                                {t('customerNoteSave')}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="customer-note-main">
                            <NoteBodyHtml body={n.body} />
                            {canWrite ? (
                              <div className="customer-note-actions">
                                <button
                                  type="button"
                                  className="btn icon-btn customer-note-menu-btn"
                                  disabled={busy}
                                  aria-label={t('customerNoteMenu')}
                                  title={t('customerNoteMenu')}
                                  aria-haspopup="menu"
                                  aria-expanded={noteMenuId === n.id}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openNoteMenu(n.id, e.currentTarget)
                                  }}
                                >
                                  <DotsThree size={14} weight="bold" aria-hidden />
                                </button>
                              </div>
                            ) : null}
                          </div>
                        )}
                        <footer className="customer-note-meta">
                          <div className="customer-note-author">
                            <span className="customer-note-av" aria-hidden>
                              {initials(author)}
                            </span>
                            <div className="customer-note-author-text">
                              <span className="customer-note-author-name">{author}</span>
                              <span className="muted customer-note-when">
                                {formatWhen(n.createdAt)}
                                {edited ? ` · ${t('customerNoteEdited')}` : ''}
                              </span>
                            </div>
                          </div>
                        </footer>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <section className="panel customer-card customer-overview-card">
              <header className="customer-card-head">
                <h2 className="crm-section-title" style={{ margin: 0 }}>
                  {t('customerTabCases')}
                </h2>
              </header>
              {data.linkedTasks.length === 0 ? (
                <div className="customer-empty-block">
                  <Folders size={22} weight="regular" aria-hidden />
                  <p style={{ margin: 0 }}>{t('customerCasesEmpty')}</p>
                  <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                    {t('customerCasesEmptyHint')}
                  </p>
                </div>
              ) : (
                <ul className="customer-link-list">
                  {data.linkedTasks.slice(0, 4).map((task) => (
                    <li key={task.id}>
                      <Link
                        to={
                          task.projectId
                            ? `${routes.projects}/${task.projectId}`
                            : `${routes.projects}/mine`
                        }
                      >
                        {task.title}
                      </Link>
                      <span className={`crm-status crm-status--${task.status}`}>{task.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel customer-card customer-overview-card customer-stats-card">
              <header className="customer-card-head">
                <h2 className="crm-section-title" style={{ margin: 0 }}>
                  {t('customerStats')}
                </h2>
                <button
                  type="button"
                  className="btn icon-btn"
                  aria-label={t('customerStatsOpen')}
                  title={t('customerStatsOpen')}
                  onClick={() => void openStatsModal()}
                >
                  <ArrowSquareOut size={15} weight="regular" aria-hidden />
                </button>
              </header>
              {(() => {
                const s = data.stats || emptyStats()
                const topProducts = s.products.slice(0, 3)
                return (
                  <dl className="customer-dl customer-stats-dl">
                    <div>
                      <dt>
                        <FunnelTip tip={t('customerStatsLtvTip')}>{t('customerStatsLtv')}</FunnelTip>
                      </dt>
                      <dd className="customer-stats-ltv">{formatMoney(s.ltvCents, s.currency)}</dd>
                    </div>
                    <div>
                      <dt>{t('customerStatsSince')}</dt>
                      <dd>{formatBirthDate(s.customerSince)}</dd>
                    </div>
                    <div>
                      <dt>{t('customerStatsDuration')}</dt>
                      <dd>{t('customerStatsDays').replace('{n}', String(s.customerDays))}</dd>
                    </div>
                    <div>
                      <dt>{t('customerStatsProducts')}</dt>
                      <dd>
                        {topProducts.length === 0 ? (
                          <span className="muted">{t('customerStatsProductsEmpty')}</span>
                        ) : (
                          <span className="crm-tag-row">
                            {topProducts.map((p) => (
                              <span key={`${p.productId || p.name}`} className="crm-tag">
                                {p.name}
                              </span>
                            ))}
                            {s.products.length > topProducts.length ? (
                              <span className="crm-tag muted">+{s.products.length - topProducts.length}</span>
                            ) : null}
                          </span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('customerStatsPersona')}</dt>
                      <dd>
                        {s.persona ? (
                          <span className="customer-stats-persona">
                            <ChartBar size={13} weight="regular" aria-hidden />
                            {s.persona.name}
                          </span>
                        ) : (
                          <span className="muted">{t('customerStatsPersonaEmpty')}</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                )
              })()}
            </section>

            <section className="panel customer-card customer-overview-card">
              <header className="customer-card-head">
                <h2 className="crm-section-title" style={{ margin: 0 }}>
                  {t('customerIntegrations')}
                </h2>
              </header>
              <div className="customer-empty-block">
                <ClipboardText size={22} weight="regular" aria-hidden />
                <p className="muted" style={{ margin: 0 }}>
                  {t('customerIntegrationsEmpty')}
                </p>
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {tab === 'profile' ? (
        <div className="crm-tab-panel">
          <div className="customer-profile-grid">
            <form
              className="panel customer-card customer-profile-form"
              onSubmit={async (e) => {
                e.preventDefault()
                const billing = billingSame
                  ? {
                      billingStreet: c.street,
                      billingPostalCode: c.postalCode,
                      billingCity: c.city,
                      billingCountry: c.country,
                    }
                  : {
                      billingStreet: c.billingStreet,
                      billingPostalCode: c.billingPostalCode,
                      billingCity: c.billingCity,
                      billingCountry: c.billingCountry,
                    }
                await patch({
                  displayName: c.displayName,
                  email: c.email,
                  phone: c.phone,
                  birthDate: c.birthDate,
                  street: c.street,
                  postalCode: c.postalCode,
                  city: c.city,
                  country: c.country,
                  ...billing,
                  relationStatus: c.relationStatus,
                  kind: c.kind,
                })
              }}
            >
              <header className="customer-card-head">
                <h2 className="crm-section-title" style={{ margin: 0 }}>
                  {t('customerMasterData')}
                </h2>
              </header>
              <label className="field">
                <span className="label">{t('name')}</span>
                <input
                  className="input"
                  disabled={!canWrite}
                  value={c.displayName}
                  onChange={(e) =>
                    setData({ ...data, customer: { ...c, displayName: e.target.value } })
                  }
                />
              </label>
              <div className="customer-settings-row">
                <div className="field">
                  <span className="label">{t('customerStatus')}</span>
                  <CrmIconSelect
                    name="relationStatus"
                    value={c.relationStatus}
                    options={statusOptions}
                    disabled={!canWrite}
                    aria-label={t('customerStatus')}
                    onChange={(v) =>
                      setData({ ...data, customer: { ...c, relationStatus: v } })
                    }
                  />
                </div>
                <div className="field">
                  <span className="label">{t('customerKind')}</span>
                  <CrmIconSelect
                    name="kind"
                    value={c.kind}
                    options={kindOptions}
                    disabled={!canWrite}
                    aria-label={t('customerKind')}
                    onChange={(v) => setData({ ...data, customer: { ...c, kind: v } })}
                  />
                </div>
              </div>
              <div className="customer-profile-contact-row">
                <label className="field">
                  <span className="label">{t('email')}</span>
                  <input
                    className="input"
                    disabled={!canWrite}
                    value={c.email || ''}
                    onChange={(e) =>
                      setData({ ...data, customer: { ...c, email: e.target.value || null } })
                    }
                  />
                </label>
                <label className="field">
                  <span className="label">{t('customerPhone')}</span>
                  <input
                    className="input"
                    disabled={!canWrite}
                    value={c.phone || ''}
                    onChange={(e) =>
                      setData({ ...data, customer: { ...c, phone: e.target.value || null } })
                    }
                  />
                </label>
                <label className="field">
                  <span className="label">{t('customerBirthDate')}</span>
                  <input
                    type="date"
                    className="input"
                    disabled={!canWrite}
                    value={birthDateInputValue(c.birthDate)}
                    onChange={(e) =>
                      setData({
                        ...data,
                        customer: { ...c, birthDate: e.target.value || null },
                      })
                    }
                  />
                </label>
              </div>

              <fieldset className="customer-address-block">
                <legend className="label">{t('customerAddress')}</legend>
                <label className="field">
                  <span className="label">{t('customerStreet')}</span>
                  <input
                    className="input"
                    disabled={!canWrite}
                    value={c.street || ''}
                    onChange={(e) => {
                      const street = e.target.value || null
                      setData({
                        ...data,
                        customer: {
                          ...c,
                          street,
                          ...(billingSame ? { billingStreet: street } : {}),
                        },
                      })
                    }}
                  />
                </label>
                <div className="customer-address-row">
                  <label className="field">
                    <span className="label">{t('customerPostalCode')}</span>
                    <input
                      className="input"
                      disabled={!canWrite}
                      value={c.postalCode || ''}
                      onChange={(e) => {
                        const postalCode = e.target.value || null
                        setData({
                          ...data,
                          customer: {
                            ...c,
                            postalCode,
                            ...(billingSame ? { billingPostalCode: postalCode } : {}),
                          },
                        })
                      }}
                    />
                  </label>
                  <label className="field customer-address-city">
                    <span className="label">{t('customerCity')}</span>
                    <input
                      className="input"
                      disabled={!canWrite}
                      value={c.city || ''}
                      onChange={(e) => {
                        const city = e.target.value || null
                        setData({
                          ...data,
                          customer: {
                            ...c,
                            city,
                            ...(billingSame ? { billingCity: city } : {}),
                          },
                        })
                      }}
                    />
                  </label>
                </div>
                <label className="field">
                  <span className="label">{t('customerCountry')}</span>
                  <input
                    className="input"
                    disabled={!canWrite}
                    value={c.country || ''}
                    onChange={(e) => {
                      const country = e.target.value || null
                      setData({
                        ...data,
                        customer: {
                          ...c,
                          country,
                          ...(billingSame ? { billingCountry: country } : {}),
                        },
                      })
                    }}
                  />
                </label>
              </fieldset>

              <fieldset className="customer-address-block">
                <legend className="label">{t('customerBillingAddress')}</legend>
                <label className="customer-billing-same">
                  <input
                    type="checkbox"
                    disabled={!canWrite}
                    checked={billingSame}
                    onChange={(e) => {
                      const on = e.target.checked
                      setBillingSame(on)
                      if (on) {
                        setData({
                          ...data,
                          customer: {
                            ...c,
                            billingStreet: c.street,
                            billingPostalCode: c.postalCode,
                            billingCity: c.city,
                            billingCountry: c.country,
                          },
                        })
                      }
                    }}
                  />
                  <span>{t('customerBillingSame')}</span>
                </label>
                {!billingSame ? (
                  <>
                    <label className="field">
                      <span className="label">{t('customerStreet')}</span>
                      <input
                        className="input"
                        disabled={!canWrite}
                        value={c.billingStreet || ''}
                        onChange={(e) =>
                          setData({
                            ...data,
                            customer: { ...c, billingStreet: e.target.value || null },
                          })
                        }
                      />
                    </label>
                    <div className="customer-address-row">
                      <label className="field">
                        <span className="label">{t('customerPostalCode')}</span>
                        <input
                          className="input"
                          disabled={!canWrite}
                          value={c.billingPostalCode || ''}
                          onChange={(e) =>
                            setData({
                              ...data,
                              customer: { ...c, billingPostalCode: e.target.value || null },
                            })
                          }
                        />
                      </label>
                      <label className="field customer-address-city">
                        <span className="label">{t('customerCity')}</span>
                        <input
                          className="input"
                          disabled={!canWrite}
                          value={c.billingCity || ''}
                          onChange={(e) =>
                            setData({
                              ...data,
                              customer: { ...c, billingCity: e.target.value || null },
                            })
                          }
                        />
                      </label>
                    </div>
                    <label className="field">
                      <span className="label">{t('customerCountry')}</span>
                      <input
                        className="input"
                        disabled={!canWrite}
                        value={c.billingCountry || ''}
                        onChange={(e) =>
                          setData({
                            ...data,
                            customer: { ...c, billingCountry: e.target.value || null },
                          })
                        }
                      />
                    </label>
                  </>
                ) : null}
              </fieldset>

              {canWrite ? (
                <div className="customer-form-foot">
                  <button type="submit" className="btn primary">
                    {t('save')}
                  </button>
                </div>
              ) : null}
            </form>

            <aside className="customer-profile-rail">
              <section className="panel customer-card">
                <h2 className="crm-section-title" style={{ margin: 0 }}>
                  {t('customerRelations')}
                </h2>
                <p style={{ margin: 0 }}>
                  {c.kind === 'org' ? t('customerKindOrg') : t('customerRelationsPrivate')}
                </p>
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                  {t('customerRelationsOrgNone')}
                </p>
              </section>

              <section className="panel customer-card customer-tags-card">
                <header className="customer-card-head">
                  <h2 className="crm-section-title" style={{ margin: 0 }}>
                    {t('customerTags')}
                  </h2>
                  {canWrite ? (
                    <button
                      type="button"
                      className="btn icon-btn"
                      disabled={tagsBusy}
                      aria-label={t('customerTagsAdd')}
                      title={t('customerTagsAdd')}
                      aria-expanded={tagPickerOpen}
                      onClick={() => setTagPickerOpen((v) => !v)}
                    >
                      <Plus size={14} weight="bold" aria-hidden />
                    </button>
                  ) : null}
                </header>
                {(c.tags || []).length ? (
                  <span className="crm-tag-row">
                    {c.tags.map((tag) => {
                      const color = tagColor(tag)
                      return (
                        <span
                          key={tag}
                          className="crm-tag customer-tag-chip"
                          style={
                            color
                              ? {
                                  borderColor: `color-mix(in srgb, ${color} 45%, var(--border))`,
                                  background: `color-mix(in srgb, ${color} 16%, var(--panel2))`,
                                  color,
                                }
                              : undefined
                          }
                        >
                          {tag}
                          {canWrite ? (
                            <button
                              type="button"
                              className="customer-tag-remove"
                              disabled={tagsBusy}
                              aria-label={`${t('customerTagsRemove')}: ${tag}`}
                              onClick={() =>
                                void saveCustomerTags((c.tags || []).filter((x) => x !== tag))
                              }
                            >
                              <X size={10} weight="bold" aria-hidden />
                            </button>
                          ) : null}
                        </span>
                      )
                    })}
                  </span>
                ) : (
                  <p className="muted" style={{ margin: 0 }}>
                    {t('customerTagsEmpty')}
                  </p>
                )}
                {tagPickerOpen && canWrite ? (
                  <div className="customer-tag-picker">
                    {catalogTags.filter((t) => !(c.tags || []).includes(t.name)).length ? (
                      <div className="crm-tag-row">
                        {catalogTags
                          .filter((t) => !(c.tags || []).includes(t.name))
                          .map((tItem) => (
                            <button
                              key={tItem.id}
                              type="button"
                              className="crm-tag customer-tag-pick"
                              disabled={tagsBusy}
                              style={
                                tItem.color
                                  ? {
                                      borderColor: `color-mix(in srgb, ${tItem.color} 45%, var(--border))`,
                                      background: `color-mix(in srgb, ${tItem.color} 16%, var(--panel2))`,
                                      color: tItem.color,
                                    }
                                  : undefined
                              }
                              onClick={() => void addCatalogTag(tItem.name)}
                            >
                              <Plus size={10} weight="bold" aria-hidden />
                              {tItem.name}
                            </button>
                          ))}
                      </div>
                    ) : (
                      <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                        {catalogTags.length === 0
                          ? t('settingsLabelsEmpty')
                          : t('customerTagsEmpty')}
                      </p>
                    )}
                    <form
                      className="customer-tag-create"
                      onSubmit={(e) => {
                        e.preventDefault()
                        void createAndAssignTag()
                      }}
                    >
                      <input
                        className="input"
                        value={newTagName}
                        disabled={tagsBusy}
                        maxLength={40}
                        placeholder={t('customerTagsCreate')}
                        aria-label={t('customerTagsCreate')}
                        onChange={(e) => setNewTagName(e.target.value)}
                      />
                      <button
                        type="submit"
                        className="btn primary"
                        disabled={tagsBusy || !newTagName.trim()}
                      >
                        {t('settingsLabelsAdd')}
                      </button>
                    </form>
                    <Link className="muted customer-tag-manage" to={routes.settingsLabels}>
                      {t('customerTagsManage')} →
                    </Link>
                  </div>
                ) : null}
              </section>

              <section className="panel customer-card">
                <h2 className="crm-section-title" style={{ margin: 0 }}>
                  {t('customerConsents')}
                </h2>
                {data.consents.length === 0 ? (
                  <p className="muted" style={{ margin: 0 }}>
                    {t('customerConsentsEmpty')}
                  </p>
                ) : (
                  <ul className="customer-consent-list">
                    {data.consents.map((co) => (
                      <li key={co.id}>
                        <span>{co.purpose}</span>
                        <span className="muted">
                          {co.channel} ·{' '}
                          {co.grantedAt && !co.revokedAt
                            ? t('customerConsentGranted')
                            : t('customerConsentRevoked')}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {canWrite ? (
                  <form
                    className="customer-inline-form"
                    onSubmit={async (e) => {
                      e.preventDefault()
                      if (!consentPurpose.trim()) return
                      await api(`/api/b/${slug}/customers/${id}/consents`, {
                        method: 'POST',
                        body: JSON.stringify({
                          purpose: consentPurpose.trim(),
                          channel: 'email',
                          granted: true,
                        }),
                      })
                      setConsentPurpose('')
                      await refresh()
                    }}
                  >
                    <input
                      className="input"
                      value={consentPurpose}
                      onChange={(e) => setConsentPurpose(e.target.value)}
                      placeholder={t('customerConsentPh')}
                    />
                    <button type="submit" className="btn">
                      {t('add')}
                    </button>
                  </form>
                ) : null}
              </section>
            </aside>
          </div>
        </div>
      ) : null}

      {tab === 'comms' ? (
        <div className="crm-tab-panel">
          <div className="customer-comms-grid">
            <aside className="panel customer-card customer-channel-rail">
              <h2 className="crm-section-title" style={{ margin: 0 }}>
                {t('customerChannels')}
              </h2>
              <button type="button" className="customer-channel-item is-on">
                <span>{t('customerChannelAll')}</span>
                <span className="customer-channel-count">{commEvents.length}</span>
              </button>
              {(['email', 'whatsapp', 'phone'] as const).map((ch) => (
                <div key={ch} className="customer-channel-item is-muted">
                  <span style={{ textTransform: 'capitalize' }}>{ch}</span>
                  <span className="muted" style={{ fontSize: 11 }}>
                    {t('customerChannelDisconnected')}
                  </span>
                </div>
              ))}
            </aside>

            <div className="customer-comms-main stack">
              <section className="panel customer-card">
                <div className="customer-empty-block">
                  <ChatCircle size={24} weight="regular" aria-hidden />
                  <p style={{ margin: 0 }}>{t('customerCommsEmptyTitle')}</p>
                  <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                    {t('customerCommsHint')}
                  </p>
                </div>
              </section>

              <section className="panel customer-card">
                <header className="customer-card-head">
                  <h2 className="crm-section-title" style={{ margin: 0 }}>
                    {t('customerCommLog')}
                  </h2>
                </header>
                {canWrite ? (
                  <form
                    className="customer-comm-form"
                    onSubmit={async (e) => {
                      e.preventDefault()
                      if (!commSummary.trim()) return
                      await api(`/api/b/${slug}/customers/${id}/communication`, {
                        method: 'POST',
                        body: JSON.stringify({
                          channel: commChannel,
                          summary: commSummary.trim(),
                        }),
                      })
                      setCommSummary('')
                      await refresh()
                    }}
                  >
                    <div className="field">
                      <span className="label">{t('customerCommChannel')}</span>
                      <CrmIconSelect
                        name="commChannel"
                        value={commChannel}
                        options={channelOptions}
                        aria-label={t('customerCommChannel')}
                        onChange={(v) => setCommChannel(v as typeof commChannel)}
                      />
                    </div>
                    <label className="field">
                      <span className="label">{t('customerCommSummary')}</span>
                      <input
                        className="input"
                        value={commSummary}
                        onChange={(e) => setCommSummary(e.target.value)}
                        placeholder={t('customerCommLogAdd')}
                      />
                    </label>
                    <button type="submit" className="btn primary">
                      {t('customerCommSave')}
                    </button>
                  </form>
                ) : null}
                {commEvents.length === 0 ? (
                  <p className="muted" style={{ margin: 0 }}>
                    {t('customerCommEmpty')}
                  </p>
                ) : (
                  <ul className="customer-timeline">
                    {commEvents.map((ev) => (
                      <li key={ev.id} className="customer-timeline-item">
                        <span className="customer-timeline-dot" aria-hidden />
                        <div>
                          <strong>{String(ev.meta?.channel || '—')}</strong>
                          <p style={{ margin: '2px 0 0' }}>{ev.summary}</p>
                          <span className="muted" style={{ fontSize: 12 }}>
                            {formatWhen(ev.createdAt)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'history' ? (
        <div className="crm-tab-panel">
          <div className="customer-history-grid">
            <aside className="panel customer-card customer-history-filters">
              <h2 className="crm-section-title" style={{ margin: 0 }}>
                {t('customerHistoryFilter')}
              </h2>
              <button
                type="button"
                className={`customer-filter-item${historyType === 'all' ? ' is-on' : ''}`}
                onClick={() => setHistoryType('all')}
              >
                <span className="customer-filter-item-main">
                  <ClockCounterClockwise size={15} weight="regular" aria-hidden />
                  <span>{t('customerHistoryAll')}</span>
                </span>
                <span className="customer-channel-count">{data.events.length}</span>
              </button>
              {HISTORY_TYPES.map((type) => {
                const count = data.events.filter((ev) => ev.type === type).length
                if (!count && type !== 'created') return null
                return (
                  <button
                    key={type}
                    type="button"
                    className={`customer-filter-item${historyType === type ? ' is-on' : ''}`}
                    onClick={() => setHistoryType(type)}
                  >
                    <span className="customer-filter-item-main">
                      <span className={`customer-history-type-dot tone-${historyTypeTone(type)}`} aria-hidden />
                      <span>{historyTypeLabel(type, t)}</span>
                    </span>
                    <span className="customer-channel-count">{count}</span>
                  </button>
                )
              })}
            </aside>

            <section className="panel customer-card customer-history-panel">
              <header className="customer-history-panel-head">
                <h2 className="crm-section-title" style={{ margin: 0 }}>
                  {t('customerHistoryFeed')}
                </h2>
                <span className="muted" style={{ fontSize: 12 }}>
                  {filteredEvents.length}
                </span>
              </header>
              {filteredEvents.length === 0 ? (
                <div className="customer-empty-block">
                  <ClockCounterClockwise size={22} weight="regular" aria-hidden />
                  <p style={{ margin: 0 }}>{t('customerHistoryEmpty')}</p>
                </div>
              ) : (
                <ol className="customer-history-feed">
                  {filteredEvents.map((ev) => {
                    const actor =
                      ev.actorDisplayName?.trim() || t('customerHistoryActorUnknown')
                    const tone = historyTypeTone(ev.type)
                    return (
                      <li key={ev.id} className="customer-history-item">
                        <div className="customer-history-rail" aria-hidden>
                          <span className={`customer-history-icon tone-${tone}`}>
                            <HistoryTypeIcon type={ev.type} />
                          </span>
                        </div>
                        <div className="customer-history-body">
                          <div className="customer-history-top">
                            <strong className="customer-history-summary">{ev.summary}</strong>
                            <time className="customer-history-when" dateTime={ev.createdAt}>
                              {formatWhen(ev.createdAt)}
                            </time>
                          </div>
                          <div className="customer-history-meta">
                            <span className={`customer-history-type tone-${tone}`}>
                              {historyTypeLabel(ev.type, t)}
                            </span>
                            <span className="customer-history-actor" title={actor}>
                              <span className="customer-history-avatar" aria-hidden>
                                {initials(actor)}
                              </span>
                              <span>
                                {t('customerHistoryBy').replace('{name}', actor)}
                              </span>
                            </span>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
              <p className="customer-hint-banner muted" style={{ marginTop: 12 }}>
                {t('customerHistoryModulesHint')}
              </p>
            </section>
          </div>
        </div>
      ) : null}

      {tab === 'cases' ? (
        <div className="crm-tab-panel">
          <div className="customer-cases-head">
            <div>
              <h2 className="crm-section-title" style={{ margin: 0 }}>
                {t('customerTabCases')}
              </h2>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
                {t('customerCasesLede')}
              </p>
            </div>
            <div className="customer-filter-pills" role="group" aria-label={t('customerTabCases')}>
              {(
                [
                  ['all', t('customerCasesFilterAll')],
                  ['open', 'open'],
                  ['in_progress', 'in_progress'],
                  ['done', 'done'],
                ] as const
              ).map(([key, label]) => {
                const count =
                  key === 'all'
                    ? data.linkedTasks.length
                    : data.linkedTasks.filter((task) => task.status === key).length
                return (
                  <button
                    key={key}
                    type="button"
                    className={`customer-pill${caseFilter === key ? ' is-on' : ''}`}
                    onClick={() => setCaseFilter(key)}
                  >
                    {label} <span className="customer-channel-count">{count}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="customer-cases-grid">
            <section className="panel customer-card">
              {filteredTasks.length === 0 ? (
                <div className="customer-empty-block">
                  <Folders size={24} weight="regular" aria-hidden />
                  <p style={{ margin: 0 }}>{t('customerCasesEmpty')}</p>
                  <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                    {t('customerCasesEmptyHint')}
                  </p>
                </div>
              ) : (
                <ul className="customer-link-list">
                  {filteredTasks.map((task) => (
                    <li key={task.id}>
                      <Link
                        to={
                          task.projectId
                            ? `${routes.projects}/${task.projectId}`
                            : `${routes.projects}/mine`
                        }
                      >
                        {task.title}
                      </Link>
                      <span className={`crm-status crm-status--${task.status}`}>{task.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <aside className="panel customer-card">
              <h2 className="crm-section-title" style={{ margin: 0 }}>
                {t('customerCasesSources')}
              </h2>
              <ul className="customer-source-list">
                <li>
                  <span className="customer-source-dot" data-tone="accent" />
                  {t('projects')}
                </li>
                <li>
                  <span className="customer-source-dot" data-tone="good" />
                  {t('customerTabComms')}
                </li>
                <li>
                  <span className="customer-source-dot" data-tone="warn" />
                  {t('customerIntegrations')}
                </li>
              </ul>
            </aside>
          </div>
        </div>
      ) : null}

      {noteMenuId && noteMenuPos
        ? createPortal(
            <div
              ref={noteMenuRef}
              className="customer-note-menu customer-note-menu--fixed"
              role="menu"
              style={{ top: noteMenuPos.top, left: noteMenuPos.left }}
            >
              {(() => {
                const n = data?.notes.find((x) => x.id === noteMenuId)
                if (!n) return null
                const busy = noteBusyId === n.id
                return (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      className="customer-note-menu-item"
                      disabled={busy}
                      onClick={() => startEditNote(n)}
                    >
                      <PencilSimple size={13} weight="regular" aria-hidden />
                      {t('customerNoteEdit')}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="customer-note-menu-item"
                      disabled={busy}
                      onClick={() => void duplicateNote(n)}
                    >
                      <Copy size={13} weight="regular" aria-hidden />
                      {t('customerNoteDuplicate')}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="customer-note-menu-item customer-note-menu-item--danger"
                      disabled={busy}
                      onClick={() => void deleteNote(n.id)}
                    >
                      <Trash size={13} weight="regular" aria-hidden />
                      {t('customerNoteDelete')}
                    </button>
                  </>
                )
              })()}
            </div>,
            document.body,
          )
        : null}

      {noteCreateOpen
        ? createPortal(
            <div
              className="bu-modal-overlay"
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget && !noteCreating) setNoteCreateOpen(false)
              }}
            >
              <form
                className="bu-modal panel crm-modal customer-note-modal"
                role="dialog"
                aria-modal="true"
                aria-label={t('customerNoteAdd')}
                onSubmit={(e) => {
                  e.preventDefault()
                  void createNote()
                }}
              >
                <header className="bu-modal-head">
                  <h2 className="section-title" style={{ margin: 0, fontSize: '1.1rem' }}>
                    {t('customerNoteAdd')}
                  </h2>
                </header>
                <div className="crm-modal-body stack">
                  <CustomerNoteEditor
                    value={noteBody}
                    onChange={setNoteBody}
                    disabled={noteCreating}
                    placeholder={t('customerNotePh')}
                    autoFocus
                    rows={6}
                  />
                </div>
                <footer className="bu-modal-actions">
                  <button
                    type="button"
                    className="btn"
                    disabled={noteCreating}
                    onClick={() => setNoteCreateOpen(false)}
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    className="btn primary"
                    disabled={noteCreating || !notePlainText(noteBody)}
                  >
                    {noteCreating ? '…' : t('customerNoteAdd')}
                  </button>
                </footer>
              </form>
            </div>,
            document.body,
          )
        : null}

      {statsOpen && data
        ? createPortal(
            <div
              className="bu-modal-overlay"
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget && !statsBusy) setStatsOpen(false)
              }}
            >
              <div
                className="bu-modal panel crm-modal customer-stats-modal"
                role="dialog"
                aria-modal="true"
                aria-label={t('customerStats')}
              >
                <header className="bu-modal-head">
                  <h2 className="section-title" style={{ margin: 0, fontSize: '1.1rem' }}>
                    {t('customerStats')}
                  </h2>
                  <button
                    type="button"
                    className="btn"
                    disabled={statsBusy}
                    onClick={() => setStatsOpen(false)}
                  >
                    {t('cancel')}
                  </button>
                </header>
                <div className="crm-modal-body stack">
                  {(() => {
                    const s = data.stats || emptyStats()
                    return (
                      <>
                        <dl className="customer-dl customer-stats-dl customer-stats-dl--modal">
                          <div>
                            <dt>
                              <FunnelTip tip={t('customerStatsLtvTip')}>
                                {t('customerStatsLtv')}
                              </FunnelTip>
                            </dt>
                            <dd className="customer-stats-ltv">
                              {formatMoney(s.ltvCents, s.currency)}
                            </dd>
                          </div>
                          <div>
                            <dt>{t('customerStatsSince')}</dt>
                            <dd>{formatBirthDate(s.customerSince)}</dd>
                          </div>
                          <div>
                            <dt>{t('customerStatsDuration')}</dt>
                            <dd>
                              {t('customerStatsDays').replace('{n}', String(s.customerDays))}
                            </dd>
                          </div>
                          <div>
                            <dt>{t('customerStatsPersona')}</dt>
                            <dd>
                              {canWrite ? (
                                <select
                                  className="input"
                                  value={s.persona?.id || ''}
                                  disabled={statsBusy}
                                  aria-label={t('customerStatsPersonaPick')}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    void saveBuyerPersona(v || null)
                                  }}
                                >
                                  <option value="">{t('customerStatsPersonaNone')}</option>
                                  {personaOptions.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name}
                                    </option>
                                  ))}
                                </select>
                              ) : s.persona ? (
                                s.persona.name
                              ) : (
                                <span className="muted">{t('customerStatsPersonaEmpty')}</span>
                              )}
                            </dd>
                          </div>
                        </dl>

                        {s.persona?.summary ? (
                          <p className="customer-stats-persona-summary muted">{s.persona.summary}</p>
                        ) : null}

                        <div className="customer-stats-purchases">
                          <h3 className="crm-section-title" style={{ margin: 0, fontSize: '0.95rem' }}>
                            {t('customerStatsPurchases')}
                          </h3>
                          {s.purchases.length === 0 ? (
                            <p className="muted" style={{ margin: 0 }}>
                              {t('customerStatsProductsEmpty')}
                            </p>
                          ) : (
                            <ul className="customer-stats-purchase-list">
                              {s.purchases.map((p) => (
                                <li key={p.id} className="customer-stats-purchase-row">
                                  <div className="customer-stats-purchase-main">
                                    <strong>{p.label}</strong>
                                    <span className="muted">{formatBirthDate(p.purchasedAt)}</span>
                                  </div>
                                  <div className="customer-stats-purchase-side">
                                    <span>{formatMoney(p.amountCents, p.currency)}</span>
                                    {canWrite ? (
                                      <button
                                        type="button"
                                        className="btn icon-btn"
                                        disabled={statsBusy}
                                        aria-label={t('customerStatsPurchaseDelete')}
                                        title={t('customerStatsPurchaseDelete')}
                                        onClick={() => void removePurchase(p.id)}
                                      >
                                        <Trash size={14} weight="regular" aria-hidden />
                                      </button>
                                    ) : null}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        {canWrite ? (
                          <form
                            className="customer-stats-add stack"
                            onSubmit={(e) => {
                              e.preventDefault()
                              void addPurchase()
                            }}
                          >
                            <h3
                              className="crm-section-title"
                              style={{ margin: 0, fontSize: '0.95rem' }}
                            >
                              {t('customerStatsPurchaseAdd')}
                            </h3>
                            {productOptions.length > 0 ? (
                              <label className="field">
                                <span>{t('customerStatsProducts')}</span>
                                <select
                                  className="input"
                                  value={purchaseProductId}
                                  disabled={statsBusy}
                                  onChange={(e) => {
                                    const pid = e.target.value
                                    setPurchaseProductId(pid)
                                    const prod = productOptions.find((p) => p.id === pid)
                                    if (prod) {
                                      if (!purchaseLabel.trim()) setPurchaseLabel(prod.name)
                                      if (!purchaseAmount.trim() && prod.sellingPriceCents != null) {
                                        setPurchaseAmount((prod.sellingPriceCents / 100).toFixed(2))
                                      }
                                    }
                                  }}
                                >
                                  <option value="">—</option>
                                  {productOptions.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            ) : null}
                            <label className="field">
                              <span>{t('customerStatsPurchaseLabel')}</span>
                              <input
                                className="input"
                                value={purchaseLabel}
                                disabled={statsBusy}
                                onChange={(e) => setPurchaseLabel(e.target.value)}
                                required={!purchaseProductId}
                              />
                            </label>
                            <div className="bu-modal-row-2">
                              <label className="field">
                                <span>{t('customerStatsPurchaseAmount')}</span>
                                <input
                                  className="input"
                                  inputMode="decimal"
                                  value={purchaseAmount}
                                  disabled={statsBusy}
                                  onChange={(e) => setPurchaseAmount(e.target.value)}
                                  required
                                />
                              </label>
                              <label className="field">
                                <span>{t('customerStatsPurchaseDate')}</span>
                                <input
                                  className="input"
                                  type="date"
                                  value={purchaseDate}
                                  disabled={statsBusy}
                                  onChange={(e) => setPurchaseDate(e.target.value)}
                                />
                              </label>
                            </div>
                            <div className="customer-stats-add-actions">
                              <button
                                type="submit"
                                className="btn primary"
                                disabled={
                                  statsBusy ||
                                  (!purchaseLabel.trim() && !purchaseProductId) ||
                                  !purchaseAmount.trim()
                                }
                              >
                                {statsBusy ? '…' : t('customerStatsPurchaseAdd')}
                              </button>
                            </div>
                          </form>
                        ) : null}
                      </>
                    )
                  })()}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
