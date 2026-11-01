import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'

export function SortanizePage() {
  const { slug } = useParams()
  const { t } = useI18n()
  const [health, setHealth] = useState<any>(null)
  const [result, setResult] = useState<any>(null)
  const [left, setLeft] = useState('Alice GmbH\nBob AG\nCarol UG')
  const [right, setRight] = useState('alice gmbh\nBobby AG\nDave Ltd')

  useEffect(() => {
    api(`/api/b/${slug}/sortanize/health`).then(setHealth).catch((e) => setHealth({ ok: false, error: String(e) }))
  }, [slug])

  async function runMatch() {
    const r = await api(`/api/b/${slug}/sortanize/match`, {
      method: 'POST',
      body: JSON.stringify({
        source: left.split('\n').map((s) => s.trim()).filter(Boolean),
        target: right.split('\n').map((s) => s.trim()).filter(Boolean),
      }),
    })
    setResult(r)
  }

  function toB64Csv(text: string, name: string) {
    const csv = 'unternehmen\n' + text.split('\n').filter(Boolean).join('\n')
    return { name, contentBase64: btoa(unescape(encodeURIComponent(csv))) }
  }

  async function runDuplicates() {
    const r = await api(`/api/b/${slug}/sortanize/run`, {
      method: 'POST',
      body: JSON.stringify({
        mode: 'duplicates',
        fileA: toB64Csv(left, 'bestand.csv'),
        fileB: toB64Csv(right, 'leads.csv'),
      }),
    })
    setResult(r)
  }

  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>{t('sortanize')}</h1>
      <span className={`badge ${health?.ok ? 'ok' : 'warn'}`}>{health?.ok ? t('sidecarUp') : t('sidecarDown')}</span>
      <div className="grid-2">
        <label><span className="label">Source / Bestand</span><textarea className="textarea" value={left} onChange={(e) => setLeft(e.target.value)} /></label>
        <label><span className="label">Target / Leads</span><textarea className="textarea" value={right} onChange={(e) => setRight(e.target.value)} /></label>
      </div>
      <div className="row">
        <button className="btn primary" onClick={runMatch}>{t('matchLists')}</button>
        <button className="btn" onClick={runDuplicates}>{t('runDuplicates')}</button>
      </div>
      {result && <pre className="panel">{JSON.stringify(result, null, 2)}</pre>}
    </div>
  )
}
