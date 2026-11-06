/**
 * ToolsPage — premium Tools hub: catalog tiles + install modal.
 * Location: apps/web/src/features/tools/ToolsPage.tsx
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import {
  ArrowsDownUp,
  List,
  Plus,
  PuzzlePiece,
  SquaresFour,
  Trash,
  X,
  type Icon,
} from '@phosphor-icons/react'
import {
  TOOL_SCOPE_RESOURCES,
  type ToolInstallDto,
  type ToolScopeResource,
} from '@bu2/shared'
import type { CompanyOutletContext } from '../../components/BusinessShell'
import { FunnelTip } from '../../components/FunnelTip'
import { api } from '../../lib/api'
import { companyRoutes } from '../../lib/companyPaths'
import { useI18n } from '../../lib/i18n'
import type { MessageKey } from '../../i18n/messages'

const SCOPE_LABEL_KEYS: Record<ToolScopeResource, MessageKey> = {
  customers: 'toolsScope_customers',
  projects: 'toolsScope_projects',
  inbox: 'toolsScope_inbox',
  marketing: 'toolsScope_marketing',
  products: 'toolsScope_products',
  finance: 'toolsScope_finance',
  settings: 'toolsScope_settings',
  integrations: 'toolsScope_integrations',
}

function scopeLabel(res: ToolScopeResource, t: (k: MessageKey) => string): string {
  return t(SCOPE_LABEL_KEYS[res])
}

type ViewMode = 'grid' | 'list'
type ScopeDraft = Record<string, { read: boolean; write: boolean }>

function emptyScopes(): ScopeDraft {
  const out: ScopeDraft = {}
  for (const r of TOOL_SCOPE_RESOURCES) out[r] = { read: false, write: false }
  return out
}

function openCustomTool(tool: ToolInstallDto, slug: string) {
  try {
    const u = new URL(tool.entryUrl)
    u.searchParams.set('bu2_slug', slug)
    u.searchParams.set('bu2_manifest', tool.manifestId)
    window.open(u.toString(), '_blank', 'noopener,noreferrer')
  } catch {
    window.open(tool.entryUrl, '_blank', 'noopener,noreferrer')
  }
}

function ToolIcon({ iconKey, size = 22 }: { iconKey: string; size?: number }) {
  const Ic: Icon = iconKey === 'sortanize' ? ArrowsDownUp : PuzzlePiece
  return <Ic size={size} weight="duotone" aria-hidden />
}

export function ToolsPage() {
  const { slug = '' } = useParams()
  const ctx = useOutletContext<CompanyOutletContext | null>()
  const { t } = useI18n()
  const routes = useMemo(() => companyRoutes(slug), [slug])
  const titleId = useId()
  const nameRef = useRef<HTMLInputElement>(null)

  const [tools, setTools] = useState<ToolInstallDto[]>([])
  const [canManage, setCanManage] = useState(false)
  const [view, setView] = useState<ViewMode>('grid')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [modalErr, setModalErr] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [manifestId, setManifestId] = useState('')
  const [entryUrl, setEntryUrl] = useState('')
  const [scopes, setScopes] = useState<ScopeDraft>(emptyScopes)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const r = await api<{ tools: ToolInstallDto[]; canManage: boolean }>(`/api/b/${slug}/tools`)
      setTools(r.tools)
      setCanManage(r.canManage)
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('loadFailed'))
      setTools([])
    } finally {
      setLoading(false)
    }
  }, [slug, t])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!showAdd) return
    setModalErr(null)
    const tmr = window.setTimeout(() => nameRef.current?.focus(), 0)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) setShowAdd(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(tmr)
      window.removeEventListener('keydown', onKey)
    }
  }, [showAdd, saving])

  function resetForm() {
    setName('')
    setManifestId('')
    setEntryUrl('')
    setScopes(emptyScopes())
    setModalErr(null)
  }

  function closeModal() {
    if (saving) return
    setShowAdd(false)
    resetForm()
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setModalErr(null)
    try {
      await api(`/api/b/${slug}/tools`, {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          manifestId: manifestId.trim().toLowerCase(),
          entryUrl: entryUrl.trim(),
          scopes,
        }),
      })
      setShowAdd(false)
      resetForm()
      await load()
    } catch (ex) {
      setModalErr(ex instanceof Error ? ex.message : t('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm(t('toolsUninstallConfirm'))) return
    setErr(null)
    try {
      await api(`/api/b/${slug}/tools/${id}`, { method: 'DELETE' })
      await load()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : t('saveFailed'))
    }
  }

  function toggleScope(res: ToolScopeResource, field: 'read' | 'write') {
    setScopes((prev) => ({
      ...prev,
      [res]: { ...prev[res]!, [field]: !prev[res]![field] },
    }))
  }

  const membership = ctx?.membership

  function renderOpen(tool: ToolInstallDto) {
    if (tool.manifestId === 'sortanize') {
      return (
        <Link className="btn primary tools-card-cta" to={routes.sortanize}>
          {t('toolsOpen')}
        </Link>
      )
    }
    return (
      <button
        type="button"
        className="btn primary tools-card-cta"
        onClick={() => openCustomTool(tool, slug)}
      >
        {t('toolsOpen')}
      </button>
    )
  }

  return (
    <div className="stack mkt-shell product-shell crm-shell tools-hub">
      <header className="product-page-head tools-hub-head">
        <div className="tools-hub-intro">
          <h1 className="section-title product-page-title tools-hub-title">
            <span>{t('toolsHub')}</span>
            <FunnelTip
              iconOnly
              wide
              className="tools-hub-tip"
              tip={[
                t('toolsHubLede'),
                '',
                `• ${t('toolsHubHow1')}`,
                `• ${t('toolsHubHow2')}`,
                `• ${t('toolsHubHow3')}`,
              ].join('\n')}
            >
              {t('toolsHub')}
            </FunnelTip>
          </h1>
        </div>
        <div className="tools-hub-actions">
          <div className="tools-view-toggle" role="group" aria-label={t('toolsViewMode')}>
            <button
              type="button"
              className={`tools-view-seg${view === 'grid' ? ' is-on' : ''}`}
              aria-pressed={view === 'grid'}
              onClick={() => setView('grid')}
            >
              <SquaresFour size={15} weight={view === 'grid' ? 'fill' : 'regular'} aria-hidden />
              {t('toolsViewGrid')}
            </button>
            <button
              type="button"
              className={`tools-view-seg${view === 'list' ? ' is-on' : ''}`}
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
            >
              <List size={15} weight={view === 'list' ? 'bold' : 'regular'} aria-hidden />
              {t('toolsViewList')}
            </button>
          </div>
          {canManage ? (
            <button type="button" className="btn primary" onClick={() => setShowAdd(true)}>
              <Plus size={14} weight="bold" aria-hidden />
              {t('toolsAdd')}
            </button>
          ) : null}
        </div>
      </header>

      {err ? (
        <p className="error" role="alert">
          {err}
        </p>
      ) : null}

      {loading ? (
        <div className="tools-grid" aria-busy="true">
          <div className="crm-skel tools-card-skel" />
          <div className="crm-skel tools-card-skel" />
          <div className="crm-skel tools-card-skel" />
        </div>
      ) : tools.length === 0 ? (
        <div className="panel tools-empty">
          <PuzzlePiece size={28} weight="duotone" aria-hidden />
          <p className="muted" style={{ margin: 0 }}>
            {t('toolsEmpty')}
          </p>
          {canManage ? (
            <button type="button" className="btn primary" onClick={() => setShowAdd(true)}>
              <Plus size={14} weight="bold" aria-hidden />
              {t('toolsAdd')}
            </button>
          ) : null}
        </div>
      ) : view === 'grid' ? (
        <div className="tools-grid">
          {tools.map((tool) => (
            <article key={tool.id} className="tools-card" data-kind={tool.kind}>
              <div className="tools-card-top">
                <div className="tools-card-ic" data-ic={tool.iconKey}>
                  <ToolIcon iconKey={tool.iconKey} size={24} />
                </div>
                <span className={`tools-kind-chip tools-kind-chip--${tool.kind}`}>
                  {tool.kind === 'system' ? t('toolsKindSystem') : t('toolsKindCustom')}
                </span>
              </div>
              <h3 className="tools-card-title">{tool.name}</h3>
              <p className="muted tools-card-meta">
                {tool.kind === 'system' ? t('toolsCardSystemHint') : t('toolsCardCustomHint')}
              </p>
              <div className="tools-card-actions">
                {renderOpen(tool)}
                {canManage && tool.kind === 'custom' ? (
                  <button
                    type="button"
                    className="btn tools-card-danger"
                    onClick={() => void onDelete(tool.id)}
                    aria-label={t('toolsUninstall')}
                  >
                    <Trash size={14} aria-hidden />
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel tools-table-wrap">
          <table className="product-table">
            <thead>
              <tr>
                <th>{t('toolsName')}</th>
                <th>{t('toolsKind')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tools.map((tool) => (
                <tr key={tool.id}>
                  <td>
                    <span className="tools-list-name">
                      <span className="tools-list-ic" data-ic={tool.iconKey}>
                        <ToolIcon iconKey={tool.iconKey} size={18} />
                      </span>
                      {tool.name}
                    </span>
                  </td>
                  <td>
                    <span className={`tools-kind-chip tools-kind-chip--${tool.kind}`}>
                      {tool.kind === 'system' ? t('toolsKindSystem') : t('toolsKindCustom')}
                    </span>
                  </td>
                  <td className="tools-list-actions">
                    {renderOpen(tool)}
                    {canManage && tool.kind === 'custom' ? (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => void onDelete(tool.id)}
                        aria-label={t('toolsUninstall')}
                      >
                        <Trash size={14} aria-hidden />
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {membership && !canManage ? (
        <p className="muted tools-manage-hint">{t('toolsManageHint')}</p>
      ) : null}

      {showAdd && canManage ? (
        <div
          className="bu-modal-overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal()
          }}
        >
          <div
            className="bu-modal panel crm-modal tools-install-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <header className="bu-modal-head">
              <h2 id={titleId} className="section-title" style={{ margin: 0 }}>
                {t('toolsAddTitle')}
              </h2>
              <button
                type="button"
                className="btn icon-btn"
                onClick={closeModal}
                aria-label={t('cancel')}
                disabled={saving}
              >
                <X size={16} weight="bold" aria-hidden />
              </button>
            </header>
            <p className="muted tools-install-lede">{t('toolsAddLede')}</p>
            <form className="crm-modal-body stack tools-install-form" onSubmit={onCreate}>
              <label className="field">
                <span className="label">{t('toolsName')}</span>
                <input
                  ref={nameRef}
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={120}
                  autoComplete="off"
                />
              </label>
              <label className="field">
                <span className="label">{t('toolsManifestId')}</span>
                <input
                  className="input kpi"
                  value={manifestId}
                  onChange={(e) => setManifestId(e.target.value)}
                  required
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  placeholder="my-app"
                  autoComplete="off"
                />
                <span className="muted tools-field-hint">{t('toolsManifestHint')}</span>
              </label>
              <label className="field">
                <span className="label">{t('toolsEntryUrl')}</span>
                <input
                  className="input"
                  type="url"
                  value={entryUrl}
                  onChange={(e) => setEntryUrl(e.target.value)}
                  required
                  placeholder="https://"
                  autoComplete="off"
                />
                <span className="muted tools-field-hint">{t('toolsEntryHint')}</span>
              </label>
              <fieldset className="tools-scope-matrix">
                <legend>{t('toolsScopes')}</legend>
                <p className="muted tools-scope-hint">{t('toolsScopesHint')}</p>
                <div className="tools-scope-grid" role="table" aria-label={t('toolsScopes')}>
                  <span className="tools-scope-corner" />
                  <span className="muted tools-scope-col">{t('toolsScopeRead')}</span>
                  <span className="muted tools-scope-col">{t('toolsScopeWrite')}</span>
                  {TOOL_SCOPE_RESOURCES.map((res) => (
                    <div key={res} className="tools-scope-row">
                      <span>{scopeLabel(res, t)}</span>
                      <input
                        type="checkbox"
                        checked={scopes[res]?.read ?? false}
                        onChange={() => toggleScope(res, 'read')}
                        aria-label={`${scopeLabel(res, t)} ${t('toolsScopeRead')}`}
                      />
                      <input
                        type="checkbox"
                        checked={scopes[res]?.write ?? false}
                        onChange={() => toggleScope(res, 'write')}
                        aria-label={`${scopeLabel(res, t)} ${t('toolsScopeWrite')}`}
                      />
                    </div>
                  ))}
                </div>
              </fieldset>
              {modalErr ? (
                <p className="error" role="alert">
                  {modalErr}
                </p>
              ) : null}
              <div className="bu-modal-actions">
                <button type="button" className="btn" onClick={closeModal} disabled={saving}>
                  {t('cancel')}
                </button>
                <button type="submit" className="btn primary" disabled={saving}>
                  {saving ? t('saving') : t('toolsInstall')}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
