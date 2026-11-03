/**
 * CreatePostScheduleMenu — Split Planen button + action menu (UI closes / noop).
 * Location: apps/web/src/components/create-post/CreatePostScheduleMenu.tsx
 */
import { useEffect, useRef, useState } from 'react'
import { CaretDown, Check } from '@phosphor-icons/react'
import { useI18n } from '../../lib/i18n'
import type { MessageKey } from '../../i18n/messages'

type Action =
  | 'draft'
  | 'library'
  | 'review'
  | 'schedule'
  | 'now'
  | 'recurring'

const ACTIONS: Action[] = ['draft', 'library', 'review', 'schedule', 'now', 'recurring']

const ACTION_LABEL: Record<Action, MessageKey> = {
  draft: 'createPostActDraft',
  library: 'createPostActLibrary',
  review: 'createPostActReview',
  schedule: 'createPostSchedule',
  now: 'createPostActNow',
  recurring: 'createPostActRecurring',
}

type Props = {
  scheduleAt: string
  onScheduleAt: (v: string) => void
  onAction: (a: Action) => void
  onCancel: () => void
}

export function CreatePostScheduleMenu({
  scheduleAt,
  onScheduleAt,
  onAction,
  onCancel,
}: Props) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<Action>('schedule')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function label(a: Action): string {
    return t(ACTION_LABEL[a])
  }

  return (
    <footer className="create-post-foot">
      <button type="button" className="btn" onClick={onCancel}>
        {t('dateRangeCancel')}
      </button>
      <div className="create-post-foot-right" ref={rootRef}>
        <input
          type="datetime-local"
          className="input create-post-when"
          value={scheduleAt}
          onChange={(e) => onScheduleAt(e.target.value)}
          aria-label={t('createPostWhen')}
        />
        <div className="create-post-split">
          <button type="button" className="btn primary" onClick={() => onAction(picked)}>
            {label(picked)}
          </button>
          <button
            type="button"
            className="btn primary create-post-split-caret"
            aria-expanded={open}
            aria-label={t('createPostScheduleMenu')}
            onClick={() => setOpen((v) => !v)}
          >
            <CaretDown size={12} weight="bold" aria-hidden />
          </button>
          {open ? (
            <div className="create-post-split-menu panel" role="menu">
              {ACTIONS.map((a) => (
                <button
                  key={a}
                  type="button"
                  role="menuitem"
                  className={`create-post-split-opt${picked === a ? ' is-active' : ''}`}
                  onClick={() => {
                    setPicked(a)
                    setOpen(false)
                    onAction(a)
                  }}
                >
                  <span>{label(a)}</span>
                  {picked === a ? <Check size={14} weight="bold" aria-hidden /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </footer>
  )
}
