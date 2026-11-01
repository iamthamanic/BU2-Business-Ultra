import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'

export function SortanizePage() {
  const { slug } = useParams()
  const { t } = useI18n()
  const [health, setHealth] = useState<any>(null)
  const [result, setResult] = useState<any>(null)
  const [left, setLeft] = useState('Alice\nBob\nCarol')
  const [right, setRight] = useState('alice\nBobby\nDave')

  useEffect(() => {
    api(`/api/b/${slug}/sortanize/health`).then(setHealth).catch((e) => setHealth({ ok: false, error: String(e) }))
  }, [slug])

  async function run() {
    const r = await api(`/api/b/${slug}/sortanize/match`, {
      method: 'POST',
      body: JSON.stringify({
        source: left.split('\n').map((s) => s.trim()).filter(Boolean),
        target: right.split('\n').map((s) => s.trim()).filter(Boolean),
      }),
    })
    setResult(r)
  }

  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>{t('sortanize')}</h1>
      <span className={`badge ${health?.ok ? 'ok' : 'warn'}`}>sidecar {health?.ok ? 'up' : 'down'}</span>
      <div className="grid-2">
        <label><span className="label">Source list</span><textarea className="textarea" value={left} onChange={(e) => setLeft(e.target.value)} /></label>
        <label><span className="label">Target list</span><textarea className="textarea" value={right} onChange={(e) => setRight(e.target.value)} /></label>
      </div>
      <button className="btn primary" onClick={run}>Match</button>
      {result && <pre className="panel">{JSON.stringify(result, null, 2)}</pre>}
    </div>
  )
}
