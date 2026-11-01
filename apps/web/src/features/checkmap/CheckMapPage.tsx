import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'

type Node = { id: string; type: 'milestone' | 'todo' | 'note'; title: string; x: number; y: number; status: string; priority: string }

export function CheckMapPage() {
  const { slug } = useParams()
  const { t } = useI18n()
  const [boardId, setBoardId] = useState<string | null>(null)
  const [title, setTitle] = useState('Roadmap')
  const [nodes, setNodes] = useState<Node[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const drag = useRef<{ id: string; ox: number; oy: number } | null>(null)

  async function refresh() {
    const r = await api<{ boards: any[] }>(`/api/b/${slug}/checkmap`)
    if (r.boards[0]) {
      setBoardId(r.boards[0].id)
      setTitle(r.boards[0].title)
      setNodes(r.boards[0].nodes ?? [])
    }
  }

  useEffect(() => { refresh().catch(console.error) }, [slug])

  async function ensureBoard() {
    if (boardId) return boardId
    const r = await api<{ board: { id: string } }>(`/api/b/${slug}/checkmap`, {
      method: 'POST',
      body: JSON.stringify({ title, nodes: [], edges: [] }),
    })
    setBoardId(r.board.id)
    return r.board.id
  }

  async function persist(next: Node[]) {
    const id = await ensureBoard()
    await api(`/api/b/${slug}/checkmap/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ title, nodes: next, edges: [] }),
    })
  }

  function addNode() {
    const n: Node = {
      id: `n-${Date.now()}`,
      type: 'todo',
      title: 'New todo',
      x: 40 + nodes.length * 24,
      y: 40 + nodes.length * 18,
      status: 'open',
      priority: 'p2',
    }
    const next = [...nodes, n]
    setNodes(next)
    persist(next)
  }

  function onPointerDown(e: React.PointerEvent, id: string) {
    const n = nodes.find((x) => x.id === id)
    if (!n) return
    setSelected(id)
    drag.current = { id, ox: e.clientX - n.x, oy: e.clientY - n.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return
    const { id, ox, oy } = drag.current
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, x: e.clientX - ox, y: e.clientY - oy } : n)))
  }

  function onPointerUp() {
    if (!drag.current) return
    drag.current = null
    persist(nodes)
  }

  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>{t('checkmap')}</h1>
      <div className="row">
        <input className="input" style={{ maxWidth: 280 }} value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className="btn primary" onClick={addNode}>+ Node</button>
        <button className="btn" onClick={() => persist(nodes)}>{t('save')}</button>
      </div>
      <div className="canvas" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        {nodes.map((n) => (
          <div
            key={n.id}
            className={`canvas-node ${selected === n.id ? 'selected' : ''}`}
            style={{ left: n.x, top: n.y }}
            onPointerDown={(e) => onPointerDown(e, n.id)}
          >
            <div className="muted">{n.type} · {n.priority}</div>
            <strong>{n.title}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}
