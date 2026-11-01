import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'

export function PersonasPage() {
  const { slug } = useParams()
  const { t } = useI18n()
  const [rows, setRows] = useState<any[]>([])
  const [name, setName] = useState('')
  const [summary, setSummary] = useState('')

  async function refresh() {
    const r = await api<{ personas: any[] }>(`/api/b/${slug}/personas`)
    setRows(r.personas)
  }

  useEffect(() => { refresh().catch(console.error) }, [slug])

  async function create() {
    await api(`/api/b/${slug}/personas`, {
      method: 'POST',
      body: JSON.stringify({
        name,
        summary,
        goals: ['Convert'],
        pains: ['Friction'],
        channels: ['Instagram'],
        journey: [{ stage: 'aware', lane: 'social', note: 'Discover' }],
      }),
    })
    setName('')
    setSummary('')
    await refresh()
  }

  function downloadPdf(id: string, n: string) {
    window.open(`/api/b/${slug}/personas/${id}/pdf`, '_blank')
  }

  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>{t('personas')}</h1>
      <div className="panel stack">
        <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <textarea className="textarea" placeholder="Summary" value={summary} onChange={(e) => setSummary(e.target.value)} />
        <button className="btn primary" onClick={create}>{t('save')}</button>
      </div>
      <div className="panel">
        <table className="table">
          <thead><tr><th>Name</th><th>Summary</th><th>PDF</th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td className="muted">{p.summary}</td>
                <td><button className="btn" onClick={() => downloadPdf(p.id, p.name)}>PDF</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
