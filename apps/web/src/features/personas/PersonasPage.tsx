/**
 * PersonasPage — minimal Persona library CRUD under Marketing.
 * Location: apps/web/src/features/personas/PersonasPage.tsx
 */
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Plus } from '@phosphor-icons/react'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'

const STAGES = ['aware', 'consider', 'decide', 'use', 'advocate'] as const
const LANES = ['social', 'search', 'sales', 'product', 'support', 'content', 'ads'] as const

type Persona = {
  id: string
  name: string
  summary: string | null
  goals: string[] | null
  pains: string[] | null
  channels: string[] | null
  journey: { stage: string; lane: string; note?: string }[] | null
}

export function PersonasPage() {
  const { slug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { t } = useI18n()
  const [rows, setRows] = useState<Persona[]>([])
  const [name, setName] = useState('')
  const [summary, setSummary] = useState('')
  const [selected, setSelected] = useState<Persona | null>(null)
  const [busy, setBusy] = useState(false)
  const deepPersonaId = searchParams.get('persona')

  async function refresh() {
    const r = await api<{ personas: Persona[] }>(`/api/b/${slug}/personas`)
    setRows(r.personas)
    return r.personas
  }

  useEffect(() => {
    refresh()
      .then((list) => {
        if (!deepPersonaId) return
        const hit = list.find((p) => p.id === deepPersonaId)
        if (hit) setSelected(hit)
      })
      .catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, deepPersonaId])

  async function create() {
    if (!name.trim()) return
    setBusy(true)
    try {
      const journey = STAGES.flatMap((stage) =>
        LANES.slice(0, 3).map((lane) => ({ stage, lane, note: '' })),
      )
      await api(`/api/b/${slug}/personas`, {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          summary: summary.trim() || undefined,
          goals: [],
          pains: [],
          channels: [],
          journey,
        }),
      })
      setName('')
      setSummary('')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  function noteFor(p: Persona, stage: string, lane: string) {
    const j = (p.journey ?? []).find((x) => x.stage === stage && x.lane === lane)
    return j?.note ?? ''
  }

  async function setNote(p: Persona, stage: string, lane: string, note: string) {
    const journey: { stage: string; lane: string; note?: string }[] = [...(p.journey ?? [])]
    const idx = journey.findIndex((x) => x.stage === stage && x.lane === lane)
    if (idx >= 0) {
      const cur = journey[idx]!
      journey[idx] = { stage: cur.stage, lane: cur.lane, note }
    } else journey.push({ stage, lane, note })
    await api(`/api/b/${slug}/personas/${p.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: p.name,
        summary: p.summary,
        goals: p.goals ?? [],
        pains: p.pains ?? [],
        channels: p.channels ?? [],
        journey,
      }),
    }).catch(() => {
      setSelected({ ...p, journey })
    })
    await refresh()
    const updated = (await api<{ personas: Persona[] }>(`/api/b/${slug}/personas`)).personas.find(
      (x) => x.id === p.id,
    )
    setSelected(updated || null)
  }

  return (
    <div className="stack funnel-page">
      <header className="product-page-head">
        <div>
          <h1 className="section-title product-page-title">{t('personas')}</h1>
          <p className="muted product-page-lede">{t('personasLede')}</p>
        </div>
      </header>

      <div className="panel stack">
        <div className="grid-2">
          <label>
            <span className="label">{t('name')}</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('name')}
            />
          </label>
          <label>
            <span className="label">{t('productDescription')}</span>
            <input
              className="input"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Summary"
            />
          </label>
        </div>
        <button className="btn primary" type="button" disabled={busy || !name.trim()} onClick={create}>
          <Plus size={14} weight="bold" aria-hidden />
          {t('save')}
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="panel product-empty">
          <p className="muted">{t('productNoPersonas')}</p>
        </div>
      ) : (
        <div className="product-card-grid">
          {rows.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`panel product-card${selected?.id === p.id ? ' is-active' : ''}`}
              onClick={() => {
                setSelected(p)
                setSearchParams(
                  (prev) => {
                    const next = new URLSearchParams(prev)
                    next.set('persona', p.id)
                    return next
                  },
                  { replace: true },
                )
              }}
            >
              <strong className="product-card-name">{p.name}</strong>
              <p className="muted product-card-desc">{p.summary || '—'}</p>
            </button>
          ))}
        </div>
      )}

      {selected ? (
        <div className="panel funnel-table-wrap">
          <h3 className="section-title" style={{ marginTop: 0 }}>
            {selected.name} — Journey
          </h3>
          <table className="table funnel-grid-table">
            <thead>
              <tr>
                <th>Lane</th>
                {STAGES.map((s) => (
                  <th key={s}>{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LANES.map((lane) => (
                <tr key={lane}>
                  <td>{lane}</td>
                  {STAGES.map((stage) => (
                    <td key={stage}>
                      <input
                        className="input"
                        value={noteFor(selected, stage, lane)}
                        onChange={(e) => setNote(selected, stage, lane, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
