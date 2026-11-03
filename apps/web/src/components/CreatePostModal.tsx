/**
 * CreatePostModal — Metricool-parity create-post UI shell (Dark-Ops).
 * Orchestrates platform bar, compose, presets, notes, preview, schedule menu.
 * Local state only — no media upload / draft API / publish.
 * Location: apps/web/src/components/CreatePostModal.tsx
 */
import { useEffect, useId, useRef, useState } from 'react'
import { X } from '@phosphor-icons/react'
import { useI18n } from '../lib/i18n'
import type { MessageKey } from '../i18n/messages'
import { CreatePostCompose } from './create-post/CreatePostCompose'
import { CreatePostNotes } from './create-post/CreatePostNotes'
import { CreatePostPlatformBar } from './create-post/CreatePostPlatformBar'
import { CreatePostPresets } from './create-post/CreatePostPresets'
import { CreatePostPreview } from './create-post/CreatePostPreview'
import { CreatePostScheduleMenu } from './create-post/CreatePostScheduleMenu'
import { isCorePlatform } from './create-post/formats'
import {
  defaultFormats,
  defaultGlobalPresets,
  defaultPlatformPresets,
  emptyTexts,
  type CorePlatformId,
  type GlobalPresets,
  type PlatformId,
  type PlatformPresetState,
  type PostFormat,
} from './create-post/types'

type Props = {
  open: boolean
  onClose: () => void
  brandLabel?: string
}

function defaultScheduleLocal(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

function initials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'BU'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
}

function platName(id: PlatformId, t: (k: MessageKey) => string): string {
  if (isCorePlatform(id)) return t(`ch_${id}`)
  const map: Record<string, MessageKey> = {
    x: 'createPostNetX',
    threads: 'createPostNetThreads',
    bluesky: 'createPostNetBluesky',
    gbp: 'createPostNetGbp',
    pinterest: 'createPostNetPinterest',
  }
  return t(map[id] || 'createPostNetX')
}

export function CreatePostModal({ open, onClose, brandLabel = 'Business Ultra' }: Props) {
  const { t } = useI18n()
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  const [selected, setSelected] = useState<PlatformId[]>(['facebook', 'instagram', 'linkedin'])
  const [formats, setFormats] = useState(() => defaultFormats())
  const [texts, setTexts] = useState(() => emptyTexts())
  const [masterText, setMasterText] = useState('')
  const [editPerPlatform, setEditPerPlatform] = useState(false)
  const [previewPlatform, setPreviewPlatform] = useState<PlatformId>('facebook')
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'desktop'>('mobile')
  const [notesOpen, setNotesOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [global, setGlobal] = useState<GlobalPresets>(() => defaultGlobalPresets())
  const [platformPresets, setPlatformPresets] = useState<PlatformPresetState>(() =>
    defaultPlatformPresets(),
  )
  const [scheduleAt, setScheduleAt] = useState(defaultScheduleLocal)

  useEffect(() => {
    if (!open) return
    setSelected(['facebook', 'instagram', 'linkedin'])
    setFormats(defaultFormats())
    setTexts(emptyTexts())
    setMasterText('')
    setEditPerPlatform(false)
    setPreviewPlatform('facebook')
    setPreviewDevice('mobile')
    setNotesOpen(false)
    setNotes('')
    setGlobal(defaultGlobalPresets())
    setPlatformPresets(defaultPlatformPresets())
    setScheduleAt(defaultScheduleLocal())
    const tmr = window.setTimeout(() => textRef.current?.focus(), 0)
    return () => window.clearTimeout(tmr)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  useEffect(() => {
    if (!selected.includes(previewPlatform) && selected[0]) {
      setPreviewPlatform(selected[0])
    }
  }, [selected, previewPlatform])

  if (!open) return null

  function togglePlatform(id: PlatformId) {
    setSelected((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev
        return prev.filter((p) => p !== id)
      }
      return [...prev, id]
    })
  }

  function setFormat(id: CorePlatformId, fmt: PostFormat) {
    setFormats((f) => ({ ...f, [id]: fmt }))
  }

  function activeText(): string {
    if (editPerPlatform) return texts[previewPlatform] || ''
    return masterText
  }

  function onChangeText(v: string) {
    if (editPerPlatform) {
      setTexts((prev) => ({ ...prev, [previewPlatform]: v }))
      return
    }
    setMasterText(v)
    setTexts((prev) => {
      const next = { ...prev }
      for (const id of selected) next[id] = v
      return next
    })
  }

  function togglePerPlatform() {
    setEditPerPlatform((on) => {
      if (!on) {
        setTexts((prev) => {
          const next = { ...prev }
          for (const id of selected) {
            if (!next[id]) next[id] = masterText
          }
          return next
        })
      } else {
        setMasterText(texts[previewPlatform] || masterText)
      }
      return !on
    })
  }

  const text = activeText()
  const errors: string[] = []
  if (selected.length === 0) errors.push(t('createPostErrNoPlatform'))
  for (const id of selected) {
    const body = editPerPlatform ? texts[id] : masterText
    if (!body.trim()) {
      errors.push(t('createPostErrEmpty').replace('{ch}', platName(id, t)))
    }
    errors.push(t('createPostErrMedia').replace('{ch}', platName(id, t)))
  }

  const brandInit = initials(brandLabel)

  return (
    <div
      className="bu-modal-overlay create-post-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className={`bu-modal panel create-post-modal${notesOpen ? ' has-notes' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="create-post-head">
          <div className="create-post-head-main">
            <h2 id={titleId} className="section-title create-post-title">
              {t('createPostTitle')}
            </h2>
            <span className="hdr-chip create-post-brand-chip">
              <span className="create-post-brand-av" aria-hidden>
                {brandInit}
              </span>
              <strong>{brandLabel}</strong>
            </span>
          </div>
          <button
            type="button"
            className="btn icon-btn"
            onClick={onClose}
            aria-label={t('closeMenu')}
          >
            <X size={16} weight="bold" aria-hidden />
          </button>
        </header>

        <div className="create-post-body">
          <div className="create-post-editor">
            <CreatePostPlatformBar
              selected={selected}
              formats={formats}
              notesOpen={notesOpen}
              onTogglePlatform={togglePlatform}
              onSetFormat={setFormat}
              onToggleNotes={() => setNotesOpen((v) => !v)}
            />

            <CreatePostCompose
              text={text}
              editPerPlatform={editPerPlatform}
              activePlatformLabel={platName(previewPlatform, t)}
              textRef={textRef}
              onChangeText={onChangeText}
              onTogglePerPlatform={togglePerPlatform}
            />

            <CreatePostPresets
              selected={selected}
              global={global}
              platform={platformPresets}
              onGlobal={(patch) => setGlobal((g) => ({ ...g, ...patch }))}
              onPlatform={(patch) => setPlatformPresets((p) => ({ ...p, ...patch }))}
            />

            {errors.length > 0 ? (
              <div className="create-post-errors" role="status">
                <strong className="create-post-errors-title">
                  {t('createPostErrors').replace('{n}', String(errors.length))}
                </strong>
                <ul className="create-post-errors-list">
                  {errors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {notesOpen ? (
            <CreatePostNotes
              open={notesOpen}
              notes={notes}
              onChange={setNotes}
              onClose={() => setNotesOpen(false)}
            />
          ) : (
            <CreatePostPreview
              brandLabel={brandLabel}
              brandInit={brandInit}
              selected={selected}
              previewPlatform={previewPlatform}
              formats={formats}
              text={text}
              previewDevice={previewDevice}
              onPreviewPlatform={setPreviewPlatform}
              onDevice={setPreviewDevice}
            />
          )}
        </div>

        <CreatePostScheduleMenu
          scheduleAt={scheduleAt}
          onScheduleAt={setScheduleAt}
          onAction={() => onClose()}
          onCancel={onClose}
        />
      </div>
    </div>
  )
}
