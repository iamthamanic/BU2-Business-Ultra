/**
 * ProductPersonaTab — Buyer Persona profile/link OR Customer Journey matrix
 * (section chosen by parent modal tabs).
 * Location: apps/web/src/components/product/ProductPersonaTab.tsx
 */
import { ArrowRight, Plus, UserFocus } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import {
  normalizeJourneyMap,
  type JourneyMap,
} from '../../features/product/customerJourney'
import {
  initials,
  type ProductDraft,
} from '../../features/product/productTypes'
import { CustomerJourneyGrid } from './CustomerJourneyGrid'

type PersonaRow = { id: string; name: string; summary?: string | null }

type Props = {
  draft: ProductDraft
  personas: PersonaRow[]
  onChange: (patch: Partial<ProductDraft>) => void
  readOnly?: boolean
  /** Which top-level modal tab content to render */
  section: 'persona' | 'journey'
  slug: string
  /** After creating a persona in the library, parent refreshes the list */
  onPersonaCreated?: (p: PersonaRow) => void
}

const NEW_SENTINEL = '__new__'

export function ProductPersonaTab({
  draft,
  personas,
  onChange,
  readOnly,
  section,
  slug,
  onPersonaCreated,
}: Props) {
  const { t } = useI18n()
  const draftP = draft.personaDraft || {}
  const [picker, setPicker] = useState<string>(() => draft.personaIds[0] || '')
  const [creating, setCreating] = useState(false)
  const [createErr, setCreateErr] = useState('')

  useEffect(() => {
    if (picker === NEW_SENTINEL) return
    const primary = draft.personaIds[0] || ''
    if (primary && primary !== picker) setPicker(primary)
    if (!primary && picker && picker !== NEW_SENTINEL && !personas.some((p) => p.id === picker)) {
      setPicker('')
    }
  }, [draft.personaIds, personas, picker])

  const linked = useMemo(() => {
    const id = draft.personaIds[0]
    return id ? personas.find((p) => p.id === id) : undefined
  }, [draft.personaIds, personas])

  const isNewMode = picker === NEW_SENTINEL

  function setDraft(patch: Partial<typeof draftP>) {
    onChange({ personaDraft: { ...draftP, ...patch } })
  }

  function selectFromDb(id: string) {
    if (readOnly) return
    setCreateErr('')
    if (id === NEW_SENTINEL) {
      setPicker(NEW_SENTINEL)
      return
    }
    if (!id) {
      setPicker('')
      onChange({ personaIds: [] })
      return
    }
    const p = personas.find((x) => x.id === id)
    setPicker(id)
    const personaIds = [id, ...draft.personaIds.filter((x) => x !== id)]
    onChange({
      personaIds,
      personaDraft: {
        ...draftP,
        name: p?.name || draftP.name || '',
        role: p?.summary || draftP.role || '',
      },
    })
  }

  async function createPersona() {
    if (readOnly || creating) return
    const name = (draftP.name || '').trim()
    if (!name) {
      setCreateErr(t('productPersonaNameRequired'))
      return
    }
    setCreating(true)
    setCreateErr('')
    try {
      const r = await api<{ persona: PersonaRow }>(`/api/b/${slug}/personas`, {
        method: 'POST',
        body: JSON.stringify({
          name,
          summary: (draftP.role || '').trim() || undefined,
          goals: [],
          pains: draftP.pains || [],
          channels: [],
          journey: [],
        }),
      })
      const created = r.persona
      onPersonaCreated?.(created)
      setPicker(created.id)
      onChange({
        personaIds: [created.id, ...draft.personaIds.filter((x) => x !== created.id)],
        personaDraft: { ...draftP, name: created.name, role: created.summary || draftP.role || '' },
      })
    } catch (e) {
      setCreateErr(String(e))
    } finally {
      setCreating(false)
    }
  }

  function togglePersona(id: string) {
    if (readOnly) return
    const has = draft.personaIds.includes(id)
    const personaIds = has ? draft.personaIds.filter((x) => x !== id) : [...draft.personaIds, id]
    onChange({ personaIds })
    if (!has) {
      setPicker(id)
      const p = personas.find((x) => x.id === id)
      setDraft({ name: p?.name || draftP.name, role: p?.summary || draftP.role })
    } else if (picker === id) {
      setPicker(personaIds[0] || '')
    }
  }

  function addTag(field: 'roles' | 'pains', value: string) {
    const v = value.trim()
    if (!v || readOnly) return
    const cur = draftP[field] || []
    if (cur.includes(v)) return
    setDraft({ [field]: [...cur, v] })
  }

  function removeTag(field: 'roles' | 'pains', value: string) {
    if (readOnly) return
    setDraft({ [field]: (draftP[field] || []).filter((x) => x !== value) })
  }

  function setJourneyMap(map: JourneyMap) {
    onChange({
      journeyCanvas: {
        ...draft.journeyCanvas,
        nodes: draft.journeyCanvas.nodes || [],
        edges: draft.journeyCanvas.edges || [],
        map,
      },
    })
  }

  return (
    <div className="product-tab-persona">
      {section === 'persona' ? (
        <div className="product-persona-grid">
          <header className="product-persona-hero" aria-label={t('productPersonaHero')}>
            <div className="product-persona-hero-card product-persona-hero-persona panel">
              <div className="product-persona-hero-av" aria-hidden>
                {initials(draftP.name || linked?.name || t('productSubPersona'))}
              </div>
              <div className="product-persona-hero-text">
                <p className="product-persona-hero-kicker">{t('productSubPersona')}</p>
                <label className="product-persona-picker">
                  <span className="sr-only">{t('productPersonaPick')}</span>
                  <select
                    className="input product-persona-picker-select"
                    disabled={readOnly}
                    value={isNewMode ? NEW_SENTINEL : picker || draft.personaIds[0] || ''}
                    onChange={(e) => selectFromDb(e.target.value)}
                  >
                    <option value="">{t('productPersonaPickNone')}</option>
                    {personas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                    <option value={NEW_SENTINEL}>{t('productPersonaPickNew')}</option>
                  </select>
                </label>
                <input
                  className="product-persona-hero-name"
                  value={draftP.name || ''}
                  disabled={readOnly || (!!picker && !isNewMode)}
                  placeholder={t('productPersonaNamePh')}
                  onChange={(e) => setDraft({ name: e.target.value })}
                  aria-label={t('name')}
                />
                <div className="product-persona-name-variants">
                  <span>
                    {(draftP.name || t('productSubPersona')).trim()} {t('productPersonaWithProduct')}
                  </span>
                  <span>
                    {(draftP.name || t('productSubPersona')).trim()} {t('productPersonaWithoutProduct')}
                  </span>
                </div>
                <input
                  className="product-persona-hero-role"
                  value={draftP.role || ''}
                  disabled={readOnly}
                  placeholder={t('productPersonaRolePh')}
                  onChange={(e) => setDraft({ role: e.target.value })}
                  aria-label={t('productPersonaRolePh')}
                />
                {isNewMode && !readOnly ? (
                  <div className="product-persona-create-row">
                    <button
                      type="button"
                      className="btn primary"
                      disabled={creating}
                      onClick={() => void createPersona()}
                    >
                      <Plus size={12} weight="bold" aria-hidden />
                      {creating ? t('loading') : t('productPersonaCreate')}
                    </button>
                    {createErr ? (
                      <span className="product-cover-err" role="alert">
                        {createErr}
                      </span>
                    ) : (
                      <span className="muted">{t('productPersonaCreateHint')}</span>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="product-persona-hero-arrow" aria-hidden title={t('productPersonaHero')}>
              <ArrowRight size={28} weight="regular" />
            </div>

            <div className="product-persona-hero-card product-persona-hero-product panel">
              <div className="product-persona-hero-media">
                {draft.coverDataUrl || draft.coverPath ? (
                  <img src={draft.coverDataUrl || draft.coverPath || ''} alt="" />
                ) : (
                  <span className="product-persona-hero-media-ph">
                    {initials(draft.name || t('product'))}
                  </span>
                )}
              </div>
              <div className="product-persona-hero-text">
                <p className="product-persona-hero-kicker">{t('product')}</p>
                <h3 className="product-persona-hero-prod-name">
                  {draft.name.trim() || t('productNamePh')}
                </h3>
              </div>
            </div>
          </header>

          <label className="product-field product-jtbd panel">
            <span className="label">{t('productJobToBeDone')}</span>
            <textarea
              className="textarea"
              rows={3}
              disabled={readOnly}
              value={draftP.jobToBeDone || ''}
              onChange={(e) => setDraft({ jobToBeDone: e.target.value })}
              placeholder={t('productJobToBeDonePh')}
            />
          </label>

          <div className="product-persona-two">
            <div className="panel product-persona-card">
              <h3 className="section-title">{t('productDemografie')}</h3>
              <label className="product-field">
                <span className="label">{t('productGender')}</span>
                <select
                  className="input"
                  disabled={readOnly}
                  value={draftP.gender || 'male'}
                  onChange={(e) => setDraft({ gender: e.target.value })}
                >
                  <option value="male">{t('productGenderMale')}</option>
                  <option value="female">{t('productGenderFemale')}</option>
                  <option value="open">{t('productOpen')}</option>
                </select>
              </label>
              <label className="product-field">
                <span className="label">{t('productAge')}</span>
                <select
                  className="input"
                  disabled={readOnly}
                  value={draftP.ageGroup || '25-34'}
                  onChange={(e) => setDraft({ ageGroup: e.target.value })}
                >
                  <option value="18-24">18–24</option>
                  <option value="25-34">25–34</option>
                  <option value="35-44">35–44</option>
                  <option value="45-54">45–54</option>
                  <option value="55+">55+</option>
                </select>
              </label>
              <label className="product-field">
                <span className="label">{t('productIncome')}</span>
                <select
                  className="input"
                  disabled={readOnly}
                  value={draftP.incomeGroup || 'open'}
                  onChange={(e) => setDraft({ incomeGroup: e.target.value })}
                >
                  <option value="open">{t('productOpen')}</option>
                  <option value="low">{t('productIncomeLow')}</option>
                  <option value="mid">{t('productIncomeMid')}</option>
                  <option value="high">{t('productIncomeHigh')}</option>
                </select>
              </label>
              <p className="muted product-destatis">{t('productDestatis')}</p>
            </div>

            <div className="panel product-persona-card">
              <h3 className="section-title">{t('productFirma')}</h3>
              <label className="product-field">
                <span className="label">{t('productRevenue')}</span>
                <select
                  className="input"
                  disabled={readOnly}
                  value={draftP.revenueBand || '500k-1m'}
                  onChange={(e) => setDraft({ revenueBand: e.target.value })}
                >
                  <option value="lt100k">&lt; 100k €</option>
                  <option value="100-500k">100–500k €</option>
                  <option value="500k-1m">500k–1 Mio €</option>
                  <option value="1m+">1 Mio+ €</option>
                  <option value="open">{t('productOpen')}</option>
                </select>
              </label>
              <label className="product-field">
                <span className="label">{t('productHeadcount')}</span>
                <select
                  className="input"
                  disabled={readOnly}
                  value={draftP.headcount || 'open'}
                  onChange={(e) => setDraft({ headcount: e.target.value })}
                >
                  <option value="1-10">1–10</option>
                  <option value="11-50">11–50</option>
                  <option value="51-200">51–200</option>
                  <option value="open">{t('productOpen')}</option>
                </select>
              </label>
              <TagEditor
                label={t('productRoles')}
                values={draftP.roles || []}
                placeholder={t('productRolePh')}
                readOnly={readOnly}
                onAdd={(v) => addTag('roles', v)}
                onRemove={(v) => removeTag('roles', v)}
              />
            </div>
          </div>

          <div className="panel product-persona-card">
            <TagEditor
              label={t('productPains')}
              values={draftP.pains || []}
              placeholder={t('productPainPh')}
              readOnly={readOnly}
              onAdd={(v) => addTag('pains', v)}
              onRemove={(v) => removeTag('pains', v)}
            />
          </div>

          <label className="product-field panel product-persona-card">
            <span className="label">{t('productVocab')}</span>
            <input
              className="input"
              disabled={readOnly}
              value={draftP.vocabulary || ''}
              onChange={(e) => setDraft({ vocabulary: e.target.value })}
              placeholder={t('productVocabPh')}
            />
          </label>

          <div className="panel product-persona-card">
            <h3 className="section-title">{t('productLinkPersonas')}</h3>
            {personas.length === 0 ? (
              <p className="muted">{t('productNoPersonas')}</p>
            ) : (
              <ul className="product-persona-link-list">
                {personas.map((p) => (
                  <li key={p.id}>
                    <label className="product-persona-link">
                      <input
                        type="checkbox"
                        checked={draft.personaIds.includes(p.id)}
                        disabled={readOnly}
                        onChange={() => togglePersona(p.id)}
                      />
                      <UserFocus size={14} weight="regular" aria-hidden />
                      <span>
                        <strong>{p.name}</strong>
                        {p.summary ? <span className="muted"> — {p.summary}</span> : null}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <CustomerJourneyGrid
          value={normalizeJourneyMap(draft.journeyCanvas?.map)}
          onChange={setJourneyMap}
          readOnly={readOnly}
          productName={draft.name}
          productCover={draft.coverDataUrl || draft.coverPath}
        />
      )}
    </div>
  )
}

function TagEditor({
  label,
  values,
  placeholder,
  readOnly,
  onAdd,
  onRemove,
}: {
  label: string
  values: string[]
  placeholder: string
  readOnly?: boolean
  onAdd: (v: string) => void
  onRemove: (v: string) => void
}) {
  const [text, setText] = useState('')
  return (
    <div className="product-field">
      <span className="label">{label}</span>
      <div className="product-tags">
        {values.map((v) => (
          <span key={v} className="chip product-tag">
            {v}
            {!readOnly ? (
              <button type="button" className="product-tag-x" onClick={() => onRemove(v)} aria-label="remove">
                ×
              </button>
            ) : null}
          </span>
        ))}
      </div>
      {!readOnly ? (
        <input
          className="input"
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onAdd(text)
              setText('')
            }
          }}
        />
      ) : null}
    </div>
  )
}
