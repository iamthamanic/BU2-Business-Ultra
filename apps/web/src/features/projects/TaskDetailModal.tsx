/**
 * TaskDetailModal — centered task detail (status/prio/assignee/due, checklist, comments).
 * Location: apps/web/src/features/projects/TaskDetailModal.tsx
 */
import { useEffect, useRef, useState } from 'react'
import { Paperclip, Trash, X } from '@phosphor-icons/react'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { MemberAvatar, memberDisplayName, type MemberInfo } from './MemberAvatar'
import type { BuTask, BuTaskAttachment } from './projectTypes'
import { TASK_PRIORITIES, TASK_STATUSES, taskPriorityLabel, taskStatusLabel } from './taskLabels'

type Comment = { id: string; body: string; createdAt: string }
type CheckItem = { id: string; title: string; done: boolean }
type MemberById = Record<string, MemberInfo>

type Props = {
  slug: string
  taskId: string | null
  canWrite: boolean
  memberById?: MemberById
  members?: MemberInfo[]
  onClose: () => void
  onChanged: () => void
}

const MAX_BYTES = 10 * 1024 * 1024

function dueInputValue(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function dueAtFromDateInput(v: string): string | null {
  if (!v.trim()) return null
  const d = new Date(`${v.trim()}T17:00:00`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function TaskDetailModal({
  slug,
  taskId,
  canWrite,
  memberById = {},
  members = [],
  onClose,
  onChanged,
}: Props) {
  const { t } = useI18n()
  const fileRef = useRef<HTMLInputElement>(null)
  const [task, setTask] = useState<BuTask | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [checklist, setChecklist] = useState<CheckItem[]>([])
  const [attachments, setAttachments] = useState<BuTaskAttachment[]>([])
  const [commentBody, setCommentBody] = useState('')
  const [checkTitle, setCheckTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!slug || !taskId) {
      setTask(null)
      return
    }
    api<{
      task: BuTask
      comments: Comment[]
      checklist: CheckItem[]
      attachments?: BuTaskAttachment[]
    }>(`/api/b/${slug}/tasks/${taskId}`)
      .then((r) => {
        setTask(r.task)
        setComments(r.comments)
        setChecklist(r.checklist)
        setAttachments(r.attachments || [])
        setErr('')
      })
      .catch(console.error)
  }, [slug, taskId])

  async function patchTask(body: Record<string, unknown>) {
    if (!task) return
    const r = await api<{ task: BuTask }>(`/api/b/${slug}/tasks/${task.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...body, version: task.version }),
    })
    setTask(r.task)
    onChanged()
  }

  async function uploadFiles(files: FileList | File[]) {
    if (!task || !canWrite) return
    const list = [...files]
    for (const file of list) {
      if (file.size > MAX_BYTES) {
        setErr(t('taskAttachmentTooLarge'))
        return
      }
      setUploading(true)
      setErr('')
      try {
        const fd = new FormData()
        fd.append('file', file)
        const r = await api<{ attachment: BuTaskAttachment }>(
          `/api/b/${slug}/tasks/${task.id}/attachments`,
          { method: 'POST', body: fd },
        )
        setAttachments((prev) => [r.attachment, ...prev])
        onChanged()
      } catch (e) {
        setErr(e instanceof Error ? e.message : t('saveFailed'))
      } finally {
        setUploading(false)
      }
    }
  }

  if (!taskId || !task) return null

  const assignee = task.assigneeUserId ? memberById[task.assigneeUserId] : null

  return (
    <div
      className="bu-modal-overlay"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="bu-modal panel stack task-detail-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="task-detail-modal-head">
          <h2 className="section-title" style={{ margin: 0, fontSize: '1.15rem' }}>
            {task.title}
          </h2>
          <button type="button" className="btn icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} weight="bold" aria-hidden />
          </button>
        </header>

        <p className="muted" style={{ margin: 0 }}>
          {task.description || t('taskNoDesc')}
        </p>
        {err ? <p className="error">{err}</p> : null}

        <div className="task-detail-modal-fields">
          <label className="field">
            <span className="label">{t('taskStatus')}</span>
            <select
              className="input"
              disabled={!canWrite}
              value={task.status}
              onChange={async (e) => {
                const status = e.target.value
                const r = await api<{ task: BuTask }>(`/api/b/${slug}/tasks/${task.id}/status`, {
                  method: 'POST',
                  body: JSON.stringify({ status, version: task.version }),
                })
                setTask(r.task)
                onChanged()
              }}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {taskStatusLabel(s, t)}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="label">{t('taskPriority')}</span>
            <select
              className="input"
              disabled={!canWrite}
              value={task.priority}
              onChange={(e) => patchTask({ priority: e.target.value }).catch(console.error)}
            >
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {taskPriorityLabel(p, t)}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="label">{t('taskAssignee')}</span>
            <select
              className="input"
              disabled={!canWrite}
              value={task.assigneeUserId || ''}
              onChange={(e) =>
                patchTask({ assigneeUserId: e.target.value || null }).catch(console.error)
              }
            >
              <option value="">{t('taskAssigneeNone')}</option>
              {(members.length ? members : Object.values(memberById)).map((m) => (
                <option key={m.userId} value={m.userId}>
                  {memberDisplayName(m)}
                </option>
              ))}
            </select>
            {assignee ? (
              <span className="row" style={{ gap: 6, marginTop: 6, alignItems: 'center' }}>
                <MemberAvatar member={assignee} size={22} />
                <span className="muted" style={{ fontSize: 12 }}>
                  {memberDisplayName(assignee)}
                </span>
              </span>
            ) : null}
          </label>

          <label className="field">
            <span className="label">{t('taskDue')}</span>
            <input
              className="input"
              type="date"
              disabled={!canWrite}
              value={dueInputValue(task.dueAt)}
              onChange={(e) =>
                patchTask({ dueAt: dueAtFromDateInput(e.target.value) }).catch(console.error)
              }
            />
          </label>
        </div>

        <section className="stack">
          <h3 style={{ margin: 0 }}>{t('taskAttachments')}</h3>
          {attachments.length === 0 ? (
            <div
              className={`task-attach-zone${canWrite ? '' : ' is-readonly'}`}
              onDragOver={(e) => {
                if (!canWrite) return
                e.preventDefault()
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (!canWrite) return
                uploadFiles(e.dataTransfer.files).catch(console.error)
              }}
            >
              <Paperclip size={16} weight="regular" aria-hidden />
              <span className="muted">{t('taskAttachmentsEmpty')}</span>
              {canWrite ? (
                <button
                  type="button"
                  className="btn"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {t('taskAttachmentUpload')}
                </button>
              ) : null}
            </div>
          ) : (
            <ul className="task-attach-list">
              {attachments.map((a) => (
                <li key={a.id} className="task-attach-item">
                  <a href={a.url} target="_blank" rel="noreferrer">
                    {a.filename.replace(/^[a-z0-9]+-/i, '')}
                  </a>
                  <span className="muted" style={{ fontSize: 11 }}>
                    {Math.max(1, Math.round(a.sizeBytes / 1024))} KB
                  </span>
                  {canWrite ? (
                    <button
                      type="button"
                      className="btn icon-btn"
                      aria-label={t('taskAttachmentDelete')}
                      onClick={async () => {
                        await api(`/api/b/${slug}/tasks/${task.id}/attachments/${a.id}`, {
                          method: 'DELETE',
                        })
                        setAttachments((prev) => prev.filter((x) => x.id !== a.id))
                        onChanged()
                      }}
                    >
                      <Trash size={14} aria-hidden />
                    </button>
                  ) : null}
                </li>
              ))}
              {canWrite ? (
                <li>
                  <button
                    type="button"
                    className="btn"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                  >
                    {t('taskAttachmentUpload')}
                  </button>
                </li>
              ) : null}
            </ul>
          )}
          <input
            ref={fileRef}
            type="file"
            hidden
            onChange={(e) => {
              if (e.target.files?.length) {
                uploadFiles(e.target.files).catch(console.error)
                e.target.value = ''
              }
            }}
          />
          {canWrite && attachments.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>
              {t('taskAttachmentsHint')}
            </p>
          ) : null}
        </section>

        <section className="stack">
          <h3 style={{ margin: 0 }}>{t('taskChecklist')}</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {checklist.map((item) => (
              <li key={item.id} className="row" style={{ gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={item.done}
                  disabled={!canWrite}
                  onChange={async () => {
                    const r = await api<{ item: CheckItem }>(
                      `/api/b/${slug}/tasks/${task.id}/checklist/${item.id}`,
                      {
                        method: 'PATCH',
                        body: JSON.stringify({ done: !item.done }),
                      },
                    )
                    setChecklist((prev) => prev.map((x) => (x.id === item.id ? r.item : x)))
                    onChanged()
                  }}
                />
                <span style={{ textDecoration: item.done ? 'line-through' : undefined }}>
                  {item.title}
                </span>
              </li>
            ))}
          </ul>
          {canWrite ? (
            <form
              className="row"
              style={{ gap: 8 }}
              onSubmit={async (e) => {
                e.preventDefault()
                if (!checkTitle.trim()) return
                const r = await api<{ item: CheckItem }>(
                  `/api/b/${slug}/tasks/${task.id}/checklist`,
                  {
                    method: 'POST',
                    body: JSON.stringify({ title: checkTitle.trim() }),
                  },
                )
                setChecklist((prev) => [...prev, r.item])
                setCheckTitle('')
                onChanged()
              }}
            >
              <input
                className="input"
                style={{ flex: 1 }}
                value={checkTitle}
                onChange={(e) => setCheckTitle(e.target.value)}
                placeholder={t('taskChecklistPh')}
              />
              <button type="submit" className="btn">
                {t('add')}
              </button>
            </form>
          ) : null}
        </section>

        <section className="stack">
          <h3 style={{ margin: 0 }}>{t('taskComments')}</h3>
          <ul className="task-comment-list">
            {comments.map((c) => (
              <li key={c.id}>{c.body}</li>
            ))}
          </ul>
          {canWrite ? (
            <form
              className="row"
              style={{ gap: 8 }}
              onSubmit={async (e) => {
                e.preventDefault()
                if (!commentBody.trim()) return
                const r = await api<{ comment: Comment }>(
                  `/api/b/${slug}/tasks/${task.id}/comments`,
                  {
                    method: 'POST',
                    body: JSON.stringify({ body: commentBody.trim() }),
                  },
                )
                setComments((prev) => [...prev, r.comment])
                setCommentBody('')
                onChanged()
              }}
            >
              <input
                className="input"
                style={{ flex: 1 }}
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder={t('taskCommentPh')}
              />
              <button type="submit" className="btn">
                {t('add')}
              </button>
            </form>
          ) : null}
        </section>
      </div>
    </div>
  )
}
