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
  const [acl, setAcl] = useState<{ canEdit: boolean }>({ canEdit: true })
  const [attachments, setAttachments] = useState<any[]>([])
  const drag = useRef<{ id: string; ox: number; oy: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function refresh() {
    const r = await api<{ boards: any[]; acl: { canEdit: boolean } }>(`/api/b/${slug}/checkmap`)
    setAcl(r.acl)
    if (r.boards[0]) {
      setBoardId(r.boards[0].id)
      setTitle(r.boards[0].title)
      setNodes(r.boards[0].nodes ?? [])
      const a = await api<{ attachments: any[] }>(`/api/b/${slug}/checkmap/${r.boards[0].id}/attachments`)
      setAttachments(a.attachments)
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
    if (!acl.canEdit) return
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
    if (!acl.canEdit) return
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

  async function upload(file: File) {
    const id = await ensureBoard()
    const fd = new FormData()
    fd.append('file', file)
    if (selected) fd.append('nodeId', selected)
    await fetch(`/api/b/${slug}/checkmap/${id}/attachments`, { method: 'POST', body: fd, credentials: 'include' })
    await refresh()
  }

  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>{t('checkmap')}</h1>
      <div className="row">
        <input className="input" style={{ maxWidth: 280 }} value={title} onChange={(e) => setTitle(e.target.value)} disabled={!acl.canEdit} />
        <button className="btn primary" disabled={!acl.canEdit} onClick={addNode}>{t('addNode')}</button>
        <button className="btn" disabled={!acl.canEdit} onClick={() => persist(nodes)}>{t('save')}</button>
        <span className={`badge ${acl.canEdit ? 'ok' : 'warn'}`}>{acl.canEdit ? 'edit' : 'view'}</span>
      </div>
      <div className="canvas" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        {nodes.map((n) => (
          <div
            key={n.id}
            className={`canvas-node ${selected === n.id ? 'selected' : ''}`}
            style={{ left: n.x, top: n.y }}
            onPointerDown={(e) => onPointerDown(e, n.id)}
            onDoubleClick={() => {
              if (!acl.canEdit) return
              const title = prompt('Title', n.title)
              if (title == null) return
              const next = nodes.map((x) => (x.id === n.id ? { ...x, title } : x))
              setNodes(next)
              persist(next)
            }}
          >
            <div className="muted">{n.type} · {n.priority} · {n.status}</div>
            <strong>{n.title}</strong>
          </div>
        ))}
      </div>
      <div className="panel stack">
        <h3 style={{ margin: 0 }}>{t('attachments')}</h3>
        <input ref={fileRef} type="file" disabled={!acl.canEdit} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <ul>
          {attachments.map((a) => (
            <li key={a.id}><a href={a.url} target="_blank" rel="noreferrer">{a.filename}</a> <span className="muted">{a.mimeType}</span></li>
          ))}
        </ul>
      </div>
    </div>
  )
}
