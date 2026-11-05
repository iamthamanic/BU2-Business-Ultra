/**
 * ToolsPage — company Tools hub (system + custom installs).
 * Location: apps/web/src/features/tools/ToolsPage.tsx
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import {
  ArrowsDownUp,
  List,
  Plus,
  PuzzlePiece,
  SquaresFour,
  Trash,
  type Icon,
} from '@phosphor-icons/react'
import {
  TOOL_SCOPE_RESOURCES,
  type ToolInstallDto,
  type ToolScopeResource,
} from '@bu2/shared'
import type { CompanyOutletContext } from '../../components/BusinessShell'
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

function ToolIcon({ iconKey }: { iconKey: string }) {
  const Ic: Icon = iconKey === 'sortanize' ? ArrowsDownUp : PuzzlePiece
  return <Ic size={22} weight="duotone" aria-hidden />
}

export function ToolsPage() {
  const { slug = '' } = useParams()
  const ctx = useOutletContext<CompanyOutletContext | null>()
  const { t } = useI18n()
  const routes = useMemo(() => companyRoutes(slug), [slug])
  const [tools, setTools] = useState<ToolInstallDto[]>([])
  const [canManage, setCanManage] = useState(false)
  const [view, setView] = useState<ViewMode>('grid')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
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

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErr(null)
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
      setName('')
      setManifestId('')
      setEntryUrl('')
      setScopes(emptyScopes())
      await load()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : t('saveFailed'))
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

  return (
    <div className="stack mkt-shell product-shell crm-shell tools-hub">
      <header className="product-page-head tools-hub-head">
        <div>
          <h1 className="section-title product-page-title">{t('toolsHub')}</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            {t('toolsHubLede')}
          </p>
        </div>
        <div className="tools-hub-actions">
          <div className="product-archive-toggle" role="group" aria-label={t('toolsViewMode')}>
            <button
              type="button"
              className={`archive-seg${view === 'grid' ? ' is-active' : ''}`}
              aria-pressed={view === 'grid'}
              onClick={() => setView('grid')}
            >
              <SquaresFour size={14} aria-hidden />
              {t('toolsViewGrid')}
            </button>
            <button
              type="button"
              className={`archive-seg${view === 'list' ? ' is-active' : ''}`}
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
            >
              <List size={14} aria-hidden />
              {t('toolsViewList')}
            </button>
          </div>
          {canManage ? (
            <button type="button" className="btn primary" onClick={() => setShowAdd((v) => !v)}>
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

      {showAdd && canManage ? (
        <form className="panel tools-add-form stack" onSubmit={onCreate}>
          <h2 className="section-title" style={{ fontSize: 16, margin: 0 }}>
            {t('toolsAddTitle')}
          </h2>
          <label className="stack" style={{ gap: 4 }}>
            <span className="muted">{t('toolsName')}</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
            />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="muted">{t('toolsManifestId')}</span>
            <input
              className="input"
              value={manifestId}
              onChange={(e) => setManifestId(e.target.value)}
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              placeholder="my-app"
            />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="muted">{t('toolsEntryUrl')}</span>
            <input
              className="input"
              type="url"
              value={entryUrl}
              onChange={(e) => setEntryUrl(e.target.value)}
              required
              placeholder="https://"
            />
          </label>
          <fieldset className="tools-scope-matrix">
            <legend className="muted">{t('toolsScopes')}</legend>
            <div className="tools-scope-grid">
              <span />
              <span className="muted">{t('toolsScopeRead')}</span>
              <span className="muted">{t('toolsScopeWrite')}</span>
              {TOOL_SCOPE_RESOURCES.map((res) => (
                <div key={res} className="tools-scope-row">
                  <span>{scopeLabel(res, t)}</span>
                  <input
                    type="checkbox"
                    checked={scopes[res]?.read ?? false}
                    onChange={() => toggleScope(res, 'read')}
                    aria-label={`${res} read`}
                  />
                  <input
                    type="checkbox"
                    checked={scopes[res]?.write ?? false}
                    onChange={() => toggleScope(res, 'write')}
                    aria-label={`${res} write`}
                  />
                </div>
              ))}
            </div>
          </fieldset>
          <div className="row" style={{ gap: 8 }}>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? t('saving') : t('toolsInstall')}
            </button>
            <button type="button" className="btn" onClick={() => setShowAdd(false)}>
              {t('cancel')}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <div className="crm-skel" style={{ height: 120 }} aria-busy="true" />
      ) : tools.length === 0 ? (
        <div className="panel customer-empty-block" style={{ padding: 28 }}>
          <p className="muted" style={{ margin: 0 }}>
            {t('toolsEmpty')}
          </p>
        </div>
      ) : view === 'grid' ? (
        <div className="tools-grid">
          {tools.map((tool) => (
            <article key={tool.id} className="panel tools-card" data-kind={tool.kind}>
              <div className="tools-card-ic" data-ic={tool.iconKey}>
                <ToolIcon iconKey={tool.iconKey} />
              </div>
              <h3 className="tools-card-title">{tool.name}</h3>
              <p className="muted tools-card-meta">
                {tool.kind === 'system' ? t('toolsKindSystem') : t('toolsKindCustom')}
              </p>
              <div className="tools-card-actions">
                {tool.manifestId === 'sortanize' ? (
                  <Link className="btn primary" to={routes.sortanize}>
                    {t('toolsOpen')}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => openCustomTool(tool, slug)}
                  >
                    {t('toolsOpen')}
                  </button>
                )}
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
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
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
                      <ToolIcon iconKey={tool.iconKey} />
                      {tool.name}
                    </span>
                  </td>
                  <td className="muted">
                    {tool.kind === 'system' ? t('toolsKindSystem') : t('toolsKindCustom')}
                  </td>
                  <td className="tools-list-actions">
                    {tool.manifestId === 'sortanize' ? (
                      <Link className="btn primary" to={routes.sortanize}>
                        {t('toolsOpen')}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="btn primary"
                        onClick={() => openCustomTool(tool, slug)}
                      >
                        {t('toolsOpen')}
                      </button>
                    )}
                    {canManage && tool.kind === 'custom' ? (
                      <button type="button" className="btn" onClick={() => void onDelete(tool.id)}>
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
        <p className="muted" style={{ fontSize: 12 }}>
          {t('toolsManageHint')}
        </p>
      ) : null}
    </div>
  )
}
