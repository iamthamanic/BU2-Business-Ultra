import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'

const STAGES = ['aware', 'consider', 'decide', 'use', 'advocate'] as const
const LANES = ['social', 'search', 'sales', 'product', 'support', 'content', 'ads'] as const

export function PersonasPage() {
  const { slug } = useParams()
  const { t } = useI18n()
  const [rows, setRows] = useState<any[]>([])
  const [name, setName] = useState('')
  const [summary, setSummary] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [cell, setCell] = useState('')

  async function refresh() {
    const r = await api<{ personas: any[] }>(`/api/b/${slug}/personas`)
    setRows(r.personas)
  }

  useEffect(() => { refresh().catch(console.error) }, [slug])

  async function create() {
    const journey = STAGES.flatMap((stage) =>
      LANES.slice(0, 3).map((lane) => ({ stage, lane, note: '' })),
    )
    await api(`/api/b/${slug}/personas`, {
      method: 'POST',
      body: JSON.stringify({
        name,
        summary,
        goals: ['Convert'],
        pains: ['Friction'],
        channels: ['Instagram'],
        journey,
      }),
    })
    setName('')
    setSummary('')
    await refresh()
  }

  function noteFor(p: any, stage: string, lane: string) {
    const j = (p.journey ?? []).find((x: any) => x.stage === stage && x.lane === lane)
    return j?.note ?? ''
  }

  async function setNote(p: any, stage: string, lane: string, note: string) {
    const journey = [...(p.journey ?? [])]
    const idx = journey.findIndex((x: any) => x.stage === stage && x.lane === lane)
    if (idx >= 0) journey[idx] = { ...journey[idx], note }
    else journey.push({ stage, lane, note })
    // Persist via recreate-lite: PATCH not implemented — use POST update endpoint if available
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
    }).catch(async () => {
      // fallback: keep local only
      setSelected({ ...p, journey })
    })
    await refresh()
    const updated = (await api<{ personas: any[] }>(`/api/b/${slug}/personas`)).personas.find((x) => x.id === p.id)
    setSelected(updated)
  }

  return (
    <div className="stack funnel-page">
      <div className="panel stack">
        <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <textarea className="textarea" placeholder="Summary" value={summary} onChange={(e) => setSummary(e.target.value)} />
        <button className="btn primary" onClick={create}>{t('save')}</button>
      </div>
      <div className="panel">
        <table className="table">
          <thead><tr><th>Name</th><th>Summary</th><th>PDF</th><th>{t('journey')}</th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td className="muted">{p.summary}</td>
                <td>
                  <a className="btn" href={`/api/b/${slug}/personas/${p.id}/pdf`} target="_blank" rel="noreferrer">{t('downloadPdf')}</a>
                </td>
                <td><button className="btn" onClick={() => setSelected(p)}>Canvas</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && (
        <div className="panel stack">
          <h3 style={{ margin: 0 }}>{t('journey')} — {selected.name}</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Lane</th>
                  {STAGES.map((s) => <th key={s}>{s}</th>)}
                </tr>
              </thead>
              <tbody>
                {LANES.map((lane) => (
                  <tr key={lane}>
                    <td className="muted">{lane}</td>
                    {STAGES.map((stage) => (
                      <td key={stage}>
                        <button
                          className="btn"
                          style={{ width: '100%', minHeight: 48, fontSize: 12 }}
                          onClick={() => {
                            const cur = noteFor(selected, stage, lane)
                            const next = prompt(`${stage}/${lane}`, cur)
                            if (next != null) setNote(selected, stage, lane, next)
                          }}
                        >
                          {noteFor(selected, stage, lane) || '·'}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
