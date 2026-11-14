/**
 * StyleguidePage — editable brand guideline hub (Marketing L1) + PDF export.
 * Location: apps/web/src/features/marketing/StyleguidePage.tsx
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import {
  BookOpen,
  Check,
  DownloadSimple,
  FloppyDisk,
  Palette,
  PencilSimple,
  Plus,
  Prohibit,
  TextAa,
  Image as ImageIcon,
  SquaresFour,
  Trash,
  WarningCircle,
  X,
} from '@phosphor-icons/react'
import { canMutateContent } from '@bu2/shared'
import type { StyleguideColor } from '@bu2/shared'
import { BizLogo } from '../../components/BizLogo'
import type { CompanyOutletContext } from '../../components/BusinessShell'
import { api } from '../../lib/api'
import { companyRoutes } from '../../lib/companyPaths'
import { useI18n } from '../../lib/i18n'
import {
  resolveStyleguide,
  toStyleguidePayload,
  type ResolvedStyleguide,
} from './styleguideDefaults'
import { exportStyleguidePdf } from './styleguideExport'

type SectionId =
  | 'toc'
  | 'company'
  | 'logo'
  | 'colors'
  | 'type'
  | 'surfaces'
  | 'icons'
  | 'rules'

const SECTIONS: { id: SectionId; pages: string }[] = [
  { id: 'company', pages: '03' },
  { id: 'logo', pages: '04–05' },
  { id: 'colors', pages: '06–07' },
  { id: 'type', pages: '08–09' },
  { id: 'surfaces', pages: '10' },
  { id: 'icons', pages: '11' },
  { id: 'rules', pages: '12' },
]

function Field({
  label,
  value,
  onChange,
  editing,
  multiline,
  rows = 3,
}: {
  label?: string
  value: string
  onChange: (v: string) => void
  editing: boolean
  multiline?: boolean
  rows?: number
}) {
  if (!editing) {
    if (multiline) return <p className={label ? undefined : undefined}>{value}</p>
    return <>{value}</>
  }
  return (
    <label className="mkt-sg-field">
      {label ? <span className="mkt-sg-field-label">{label}</span> : null}
      {multiline ? (
        <textarea
          className="input textarea mkt-sg-input"
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="input mkt-sg-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  )
}

export function StyleguidePage() {
  const { slug } = useParams()
  const ctx = useOutletContext<CompanyOutletContext | undefined>()
  const { t, locale } = useI18n()
  const routes = slug ? companyRoutes(slug) : null

  const [active, setActive] = useState<SectionId>('toc')
  const [copied, setCopied] = useState('')
  const [company, setCompany] = useState<{ name: string; logoPath?: string | null } | null>(null)
  const [doc, setDoc] = useState<ResolvedStyleguide | null>(null)
  const [draft, setDraft] = useState<ResolvedStyleguide | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [loaded, setLoaded] = useState(false)

  const canEdit =
    Boolean(ctx?.user.isSuperadmin) ||
    (ctx?.membership
      ? canMutateContent({
          isOwner: ctx.membership.isOwner,
          permissions: ctx.membership.permissions ?? [],
        })
      : false)

  const year = useMemo(() => new Date().getFullYear(), [])
  const brandName = company?.name || 'Business Ultra'
  const view = editing && draft ? draft : doc

  const load = useCallback(async () => {
    if (!slug) return
    setErr('')
    try {
      const r = await api<{
        business: { name: string; logoPath?: string | null }
        styleguide: Record<string, unknown>
      }>(`/api/b/${slug}/styleguide`)
      setCompany(r.business)
      const resolved = resolveStyleguide(
        r.styleguide,
        r.business.name,
        locale === 'en' ? 'en' : 'de',
      )
      setDoc(resolved)
      setDraft(resolved)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoaded(true)
    }
  }, [slug, locale])

  useEffect(() => {
    load().catch(console.error)
  }, [load])

  function scrollTo(id: SectionId) {
    setActive(id)
    document.getElementById(`sg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function copyHex(hex: string) {
    try {
      await navigator.clipboard.writeText(hex)
      setCopied(hex)
      window.setTimeout(() => setCopied(''), 1400)
    } catch {
      /* ignore */
    }
  }

  function patchDraft(partial: Partial<ResolvedStyleguide>) {
    setDraft((prev) => (prev ? { ...prev, ...partial } : prev))
  }

  function updateColor(id: string, next: Partial<StyleguideColor>) {
    setDraft((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        colors: prev.colors.map((c) => (c.id === id ? { ...c, ...next } : c)),
      }
    })
  }

  function addColor() {
    setDraft((prev) => {
      if (!prev) return prev
      const id = `c${Date.now().toString(36)}`
      return {
        ...prev,
        colors: [...prev.colors, { id, hex: '#3d8bfd', role: 'Accent', cmyk: '' }],
      }
    })
  }

  function removeColor(id: string) {
    setDraft((prev) => {
      if (!prev || prev.colors.length <= 1) return prev
      return { ...prev, colors: prev.colors.filter((c) => c.id !== id) }
    })
  }

  function updateList(key: 'dos' | 'donts', index: number, value: string) {
    setDraft((prev) => {
      if (!prev) return prev
      const list = [...prev[key]]
      list[index] = value
      return { ...prev, [key]: list }
    })
  }

  function addListItem(key: 'dos' | 'donts') {
    setDraft((prev) => {
      if (!prev || prev[key].length >= 12) return prev
      return { ...prev, [key]: [...prev[key], ''] }
    })
  }

  function removeListItem(key: 'dos' | 'donts', index: number) {
    setDraft((prev) => {
      if (!prev || prev[key].length <= 1) return prev
      return { ...prev, [key]: prev[key].filter((_, i) => i !== index) }
    })
  }

  async function save() {
    if (!slug || !draft) return
    setSaving(true)
    setErr('')
    try {
      const r = await api<{
        business: { name: string; logoPath?: string | null }
        styleguide: Record<string, unknown>
      }>(`/api/b/${slug}/styleguide`, {
        method: 'PUT',
        body: JSON.stringify(toStyleguidePayload(draft)),
      })
      setCompany(r.business)
      const resolved = resolveStyleguide(
        r.styleguide,
        r.business.name,
        locale === 'en' ? 'en' : 'de',
      )
      setDoc(resolved)
      setDraft(resolved)
      setEditing(false)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  function cancelEdit() {
    setDraft(doc)
    setEditing(false)
    setErr('')
  }

  async function runExport() {
    if (!view) return
    try {
      setErr('')
      await exportStyleguidePdf({
        brandName,
        year,
        doc: view,
        logoPath: company?.logoPath,
        labels: {
          title: t('styleguideTitle'),
          kicker: t('styleguideKicker'),
          toc: t('styleguideToc'),
          tocBody: t('styleguideTocBody'),
          company: t('styleguideSec_company'),
          logo: t('styleguideSec_logo'),
          colors: t('styleguideSec_colors'),
          type: t('styleguideSec_type'),
          typeDisplay: t('styleguideTypeDisplay'),
          typeBody: t('styleguideTypeBody'),
          typeMono: t('styleguideTypeMono'),
          surfaces: t('styleguideSec_surfaces'),
          icons: t('styleguideSec_icons'),
          rules: t('styleguideSec_rules'),
          dos: t('styleguideDos'),
          donts: t('styleguideDonts'),
        },
      })
    } catch (e) {
      setErr((e as Error).message || String(e))
    }
  }

  if (!loaded || !view) {
    return <p className="muted">{err || '…'}</p>
  }

  return (
    <div className={`mkt-styleguide${editing ? ' is-editing' : ''}`}>
      <div className="mkt-sg-toolbar panel">
        <div className="mkt-sg-toolbar-copy">
          <BookOpen size={16} weight="regular" aria-hidden />
          <div>
            <strong>{t('styleguideToolbarTitle')}</strong>
            <p className="muted">{t('styleguideToolbarHint')}</p>
          </div>
        </div>
        <div className="mkt-sg-toolbar-actions">
          <button
            type="button"
            className="btn"
            onClick={() => void runExport()}
            disabled={saving}
          >
            <DownloadSimple size={14} weight="bold" aria-hidden />
            {t('styleguideExportPdf')}
          </button>
          {canEdit && !editing ? (
            <button type="button" className="btn primary" onClick={() => setEditing(true)}>
              <PencilSimple size={14} weight="bold" aria-hidden />
              {t('styleguideEdit')}
            </button>
          ) : null}
          {canEdit && editing ? (
            <>
              <button type="button" className="btn" onClick={cancelEdit} disabled={saving}>
                <X size={14} weight="bold" aria-hidden />
                {t('cancel')}
              </button>
              <button type="button" className="btn primary" onClick={() => void save()} disabled={saving}>
                <FloppyDisk size={14} weight="bold" aria-hidden />
                {saving ? '…' : t('save')}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {err ? <p className="error mkt-sg-err">{err}</p> : null}

      <header className="mkt-sg-hero panel">
        <div className="mkt-sg-hero-kicker">
          <BookOpen size={14} weight="regular" aria-hidden />
          <span>{t('styleguideKicker')}</span>
          <span className="mkt-sg-year">{year}</span>
        </div>
        <h1 className="mkt-sg-title">{t('styleguideTitle')}</h1>
        {editing ? (
          <Field
            label={t('styleguideLedeLabel')}
            value={view.lede}
            onChange={(v) => patchDraft({ lede: v })}
            editing
            multiline
            rows={2}
          />
        ) : (
          <p className="mkt-sg-lede muted">{view.lede}</p>
        )}
        <div className="mkt-sg-hero-brand">
          <BizLogo name={brandName} logoPath={company?.logoPath} className="mkt-sg-logo" />
          <div className="mkt-sg-hero-brand-text">
            <strong>{brandName}</strong>
            {editing ? (
              <Field
                value={view.heroMeta}
                onChange={(v) => patchDraft({ heroMeta: v })}
                editing
              />
            ) : (
              <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
                {view.heroMeta}
              </p>
            )}
            {editing && routes ? (
              <p className="muted mkt-sg-logo-hint">
                {t('styleguideLogoViaSettings')}{' '}
                <Link to={routes.settings}>{t('settings')}</Link>
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mkt-sg-layout">
        <nav className="mkt-sg-toc panel" aria-label={t('styleguideToc')}>
          <h2 className="mkt-sg-toc-title">{t('styleguideToc')}</h2>
          <p className="muted mkt-sg-toc-hint">{t('styleguideTocHint')}</p>
          <ol className="mkt-sg-toc-list">
            <li>
              <button
                type="button"
                className={`mkt-sg-toc-link${active === 'toc' ? ' is-on' : ''}`}
                onClick={() => scrollTo('toc')}
              >
                <span>{t('styleguideToc')}</span>
                <span className="muted">02</span>
              </button>
            </li>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={`mkt-sg-toc-link${active === s.id ? ' is-on' : ''}`}
                  onClick={() => scrollTo(s.id)}
                >
                  <span>{t(`styleguideSec_${s.id}` as 'styleguideSec_company')}</span>
                  <span className="muted">{s.pages}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mkt-sg-main">
          <section id="sg-toc" className="mkt-sg-section panel">
            <header className="mkt-sg-sec-head">
              <span className="mkt-sg-sec-num">02</span>
              <div>
                <h2>{t('styleguideToc')}</h2>
                <p className="muted">{t('styleguideTocBody')}</p>
              </div>
            </header>
            <div className="mkt-sg-toc-grid">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="mkt-sg-toc-card"
                  onClick={() => scrollTo(s.id)}
                >
                  <span className="mkt-sg-toc-card-pages">{s.pages}</span>
                  <strong>{t(`styleguideSec_${s.id}` as 'styleguideSec_company')}</strong>
                </button>
              ))}
            </div>
          </section>

          <section id="sg-company" className="mkt-sg-section panel">
            <header className="mkt-sg-sec-head">
              <span className="mkt-sg-sec-num">03</span>
              <div>
                <h2>{t('styleguideSec_company')}</h2>
                {editing ? (
                  <Field
                    value={view.companySub}
                    onChange={(v) => patchDraft({ companySub: v })}
                    editing
                  />
                ) : (
                  <p className="muted">{view.companySub}</p>
                )}
              </div>
            </header>
            <div className="mkt-sg-prose">
              {editing ? (
                <>
                  <Field
                    label={t('styleguideCompanyBody1Label')}
                    value={view.companyBody1}
                    onChange={(v) => patchDraft({ companyBody1: v })}
                    editing
                    multiline
                    rows={4}
                  />
                  <Field
                    label={t('styleguideCompanyBody2Label')}
                    value={view.companyBody2}
                    onChange={(v) => patchDraft({ companyBody2: v })}
                    editing
                    multiline
                    rows={3}
                  />
                </>
              ) : (
                <>
                  <p>{view.companyBody1}</p>
                  <p className="muted">{view.companyBody2}</p>
                </>
              )}
            </div>
          </section>

          <section id="sg-logo" className="mkt-sg-section panel">
            <header className="mkt-sg-sec-head">
              <span className="mkt-sg-sec-num">04</span>
              <div>
                <h2>{t('styleguideSec_logo')}</h2>
                {editing ? (
                  <Field value={view.logoSub} onChange={(v) => patchDraft({ logoSub: v })} editing />
                ) : (
                  <p className="muted">{view.logoSub}</p>
                )}
              </div>
            </header>
            <div className="mkt-sg-logo-grid">
              <div className="mkt-sg-logo-stage mkt-sg-logo-stage--dark">
                <BizLogo name={brandName} logoPath={company?.logoPath} className="mkt-sg-logo-xl" />
                {editing ? (
                  <Field
                    value={view.logoNoteDark}
                    onChange={(v) => patchDraft({ logoNoteDark: v })}
                    editing
                  />
                ) : (
                  <span className="muted">{view.logoNoteDark}</span>
                )}
              </div>
              <div className="mkt-sg-logo-stage mkt-sg-logo-stage--light">
                <BizLogo name={brandName} logoPath={company?.logoPath} className="mkt-sg-logo-xl" />
                {editing ? (
                  <Field
                    value={view.logoNoteLight}
                    onChange={(v) => patchDraft({ logoNoteLight: v })}
                    editing
                  />
                ) : (
                  <span>{view.logoNoteLight}</span>
                )}
              </div>
              <div className="mkt-sg-clearspace">
                <div className="mkt-sg-clearspace-frame">
                  <BizLogo name={brandName} logoPath={company?.logoPath} className="mkt-sg-logo-md" />
                </div>
                {editing ? (
                  <Field
                    value={view.logoClearSpace}
                    onChange={(v) => patchDraft({ logoClearSpace: v })}
                    editing
                    multiline
                    rows={2}
                  />
                ) : (
                  <p>{view.logoClearSpace}</p>
                )}
              </div>
            </div>
          </section>

          <section id="sg-colors" className="mkt-sg-section panel">
            <header className="mkt-sg-sec-head">
              <span className="mkt-sg-sec-num">06</span>
              <div>
                <h2>{t('styleguideSec_colors')}</h2>
                {editing ? (
                  <Field
                    value={view.colorsSub}
                    onChange={(v) => patchDraft({ colorsSub: v })}
                    editing
                  />
                ) : (
                  <p className="muted">{view.colorsSub}</p>
                )}
              </div>
              <Palette size={18} weight="regular" className="mkt-sg-sec-ic" aria-hidden />
            </header>
            <div className="mkt-sg-swatches">
              {view.colors.map((c) =>
                editing ? (
                  <div key={c.id} className="mkt-sg-swatch mkt-sg-swatch--edit">
                    <input
                      type="color"
                      className="mkt-sg-color-picker"
                      value={c.hex.length === 7 ? c.hex : '#3d8bfd'}
                      onChange={(e) => updateColor(c.id, { hex: e.target.value })}
                      aria-label={t('styleguideCopyHex')}
                    />
                    <div className="mkt-sg-swatch-edit-fields">
                      <input
                        className="input mkt-sg-input"
                        value={c.hex}
                        onChange={(e) => updateColor(c.id, { hex: e.target.value })}
                        aria-label="HEX"
                      />
                      <input
                        className="input mkt-sg-input"
                        value={c.role}
                        onChange={(e) => updateColor(c.id, { role: e.target.value })}
                        aria-label={t('styleguideColorRole')}
                        placeholder={t('styleguideColorRole')}
                      />
                      <input
                        className="input mkt-sg-input"
                        value={c.cmyk || ''}
                        onChange={(e) => updateColor(c.id, { cmyk: e.target.value })}
                        aria-label="CMYK"
                        placeholder="CMYK"
                      />
                    </div>
                    <button
                      type="button"
                      className="btn ghost mkt-sg-swatch-del"
                      onClick={() => removeColor(c.id)}
                          aria-label={t('remove')}
                          disabled={view.colors.length <= 1}
                    >
                      <Trash size={14} weight="bold" aria-hidden />
                    </button>
                  </div>
                ) : (
                  <button
                    key={c.id}
                    type="button"
                    className="mkt-sg-swatch"
                    onClick={() => void copyHex(c.hex)}
                    title={t('styleguideCopyHex')}
                  >
                    <span className="mkt-sg-swatch-chip" style={{ background: c.hex }} />
                    <span className="mkt-sg-swatch-meta">
                      <strong>{c.hex.toUpperCase()}</strong>
                      <span className="muted">{c.role}</span>
                      {c.cmyk ? <span className="muted mkt-sg-cmyk">CMYK {c.cmyk}</span> : null}
                    </span>
                    {copied === c.hex ? (
                      <Check size={14} weight="bold" className="mkt-sg-copied" aria-hidden />
                    ) : null}
                  </button>
                ),
              )}
            </div>
            {editing ? (
              <button type="button" className="btn mkt-sg-add" onClick={addColor}>
                <Plus size={14} weight="bold" aria-hidden />
                {t('styleguideAddColor')}
              </button>
            ) : null}
          </section>

          <section id="sg-type" className="mkt-sg-section panel">
            <header className="mkt-sg-sec-head">
              <span className="mkt-sg-sec-num">08</span>
              <div>
                <h2>{t('styleguideSec_type')}</h2>
                {editing ? (
                  <Field value={view.typeSub} onChange={(v) => patchDraft({ typeSub: v })} editing />
                ) : (
                  <p className="muted">{view.typeSub}</p>
                )}
              </div>
              <TextAa size={18} weight="regular" className="mkt-sg-sec-ic" aria-hidden />
            </header>
            <div className="mkt-sg-type-grid">
              <div className="mkt-sg-type-card">
                <span className="muted">{t('styleguideTypeDisplay')}</span>
                {editing ? (
                  <Field
                    value={view.typeDisplay}
                    onChange={(v) => patchDraft({ typeDisplay: v })}
                    editing
                  />
                ) : (
                  <p className="mkt-sg-type-display">{view.typeDisplay}</p>
                )}
                <p className="mkt-sg-type-sample">
                  Aa Bb Cc
                  <br />
                  1234567890
                </p>
              </div>
              <div className="mkt-sg-type-card">
                <span className="muted">{t('styleguideTypeBody')}</span>
                {editing ? (
                  <>
                    <Field
                      value={view.typeBody}
                      onChange={(v) => patchDraft({ typeBody: v })}
                      editing
                    />
                    <Field
                      value={view.typeBodySample}
                      onChange={(v) => patchDraft({ typeBodySample: v })}
                      editing
                      multiline
                      rows={3}
                    />
                  </>
                ) : (
                  <>
                    <p className="mkt-sg-type-body-name">{view.typeBody}</p>
                    <p className="mkt-sg-type-body-sample">{view.typeBodySample}</p>
                  </>
                )}
              </div>
              <div className="mkt-sg-type-card mkt-sg-type-card--mono">
                <span className="muted">{t('styleguideTypeMono')}</span>
                {editing ? (
                  <Field
                    value={view.typeMono}
                    onChange={(v) => patchDraft({ typeMono: v })}
                    editing
                  />
                ) : (
                  <p className="mkt-sg-type-mono">{view.typeMono}</p>
                )}
                <p className="mkt-sg-type-mono-sample">HEX · CMYK · 0x3D8BFD</p>
              </div>
            </div>
          </section>

          <section id="sg-surfaces" className="mkt-sg-section panel">
            <header className="mkt-sg-sec-head">
              <span className="mkt-sg-sec-num">10</span>
              <div>
                <h2>{t('styleguideSec_surfaces')}</h2>
                {editing ? (
                  <Field
                    value={view.surfacesSub}
                    onChange={(v) => patchDraft({ surfacesSub: v })}
                    editing
                  />
                ) : (
                  <p className="muted">{view.surfacesSub}</p>
                )}
              </div>
              <SquaresFour size={18} weight="regular" className="mkt-sg-sec-ic" aria-hidden />
            </header>
            <div className="mkt-sg-surface-row">
              <div className="mkt-sg-surface" style={{ background: 'var(--bg)' }}>
                <span>--bg</span>
              </div>
              <div className="mkt-sg-surface" style={{ background: 'var(--panel)' }}>
                <span>--panel</span>
              </div>
              <div className="mkt-sg-surface" style={{ background: 'var(--panel2)' }}>
                <span>--panel2</span>
              </div>
              <div
                className="mkt-sg-surface mkt-sg-surface--border"
                style={{ background: 'var(--panel2)' }}
              >
                <span>--border</span>
              </div>
            </div>
          </section>

          <section id="sg-icons" className="mkt-sg-section panel">
            <header className="mkt-sg-sec-head">
              <span className="mkt-sg-sec-num">11</span>
              <div>
                <h2>{t('styleguideSec_icons')}</h2>
                {editing ? (
                  <Field
                    value={view.iconsSub}
                    onChange={(v) => patchDraft({ iconsSub: v })}
                    editing
                  />
                ) : (
                  <p className="muted">{view.iconsSub}</p>
                )}
              </div>
              <ImageIcon size={18} weight="regular" className="mkt-sg-sec-ic" aria-hidden />
            </header>
            <div className="mkt-sg-icon-row">
              {[BookOpen, Palette, TextAa, SquaresFour, ImageIcon, WarningCircle].map((Ic, i) => (
                <span key={i} className="mkt-sg-icon-cell">
                  <Ic size={22} weight="regular" aria-hidden />
                </span>
              ))}
            </div>
          </section>

          <section id="sg-rules" className="mkt-sg-section panel">
            <header className="mkt-sg-sec-head">
              <span className="mkt-sg-sec-num">12</span>
              <div>
                <h2>{t('styleguideSec_rules')}</h2>
                {editing ? (
                  <Field
                    value={view.rulesSub}
                    onChange={(v) => patchDraft({ rulesSub: v })}
                    editing
                  />
                ) : (
                  <p className="muted">{view.rulesSub}</p>
                )}
              </div>
            </header>
            <div className="mkt-sg-rules">
              <div className="mkt-sg-rule mkt-sg-rule--do">
                <h3>
                  <Check size={16} weight="bold" aria-hidden />
                  {t('styleguideDos')}
                </h3>
                {editing ? (
                  <ul className="mkt-sg-rule-edit">
                    {view.dos.map((item, i) => (
                      <li key={`do-${i}`}>
                        <input
                          className="input mkt-sg-input"
                          value={item}
                          onChange={(e) => updateList('dos', i, e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => removeListItem('dos', i)}
                          aria-label={t('remove')}
                          disabled={view.dos.length <= 1}
                        >
                          <Trash size={13} weight="bold" aria-hidden />
                        </button>
                      </li>
                    ))}
                    <li>
                      <button type="button" className="btn" onClick={() => addListItem('dos')}>
                        <Plus size={13} weight="bold" aria-hidden />
                        {t('styleguideAddRule')}
                      </button>
                    </li>
                  </ul>
                ) : (
                  <ul>
                    {view.dos.map((item, i) => (
                      <li key={`do-${i}`}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="mkt-sg-rule mkt-sg-rule--dont">
                <h3>
                  <Prohibit size={16} weight="bold" aria-hidden />
                  {t('styleguideDonts')}
                </h3>
                {editing ? (
                  <ul className="mkt-sg-rule-edit">
                    {view.donts.map((item, i) => (
                      <li key={`dont-${i}`}>
                        <input
                          className="input mkt-sg-input"
                          value={item}
                          onChange={(e) => updateList('donts', i, e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => removeListItem('donts', i)}
                          aria-label={t('remove')}
                          disabled={view.donts.length <= 1}
                        >
                          <Trash size={13} weight="bold" aria-hidden />
                        </button>
                      </li>
                    ))}
                    <li>
                      <button type="button" className="btn" onClick={() => addListItem('donts')}>
                        <Plus size={13} weight="bold" aria-hidden />
                        {t('styleguideAddRule')}
                      </button>
                    </li>
                  </ul>
                ) : (
                  <ul>
                    {view.donts.map((item, i) => (
                      <li key={`dont-${i}`}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
