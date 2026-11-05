/**
 * ChecklistPanel — Dark-Ops checklist with progress (Tasks modal).
 * Location: apps/web/src/components/checklist/ChecklistPanel.tsx
 */
import { useMemo, useState } from 'react'
import { CheckCircle, ListChecks, Plus } from '@phosphor-icons/react'
import { useI18n } from '../../lib/i18n'

export type ChecklistItem = {
  id: string
  title: string
  done: boolean
}

type Props = {
  items: ChecklistItem[]
  canWrite: boolean
  title: string
  emptyLabel: string
  placeholder: string
  onToggle: (id: string, done: boolean) => Promise<void>
  onAdd: (title: string) => Promise<void>
  /** Hide outer title chrome when parent already provides a mode toggle. */
  embedded?: boolean
}

export function ChecklistPanel({
  items,
  canWrite,
  title,
  emptyLabel,
  placeholder,
  onToggle,
  onAdd,
  embedded = false,
}: Props) {
  const { t } = useI18n()
  const [draft, setDraft] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const doneCount = useMemo(() => items.filter((i) => i.done).length, [items])
  const pct = items.length === 0 ? 0 : Math.round((doneCount / items.length) * 100)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const titleText = draft.trim()
    if (!titleText || adding) return
    setAdding(true)
    try {
      await onAdd(titleText)
      setDraft('')
    } finally {
      setAdding(false)
    }
  }

  return (
    <section className={`checklist-panel${embedded ? ' is-embedded' : ''}`}>
      {embedded ? (
        <div className="checklist-embedded-progress">
          <div
            className="checklist-progress"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={title}
          >
            <span className="checklist-progress-bar" style={{ width: `${pct}%` }} />
          </div>
          <span className="muted checklist-panel-count">
            {doneCount}/{items.length}
          </span>
        </div>
      ) : (
        <header className="checklist-panel-head">
          <div className="checklist-panel-title-row">
            <ListChecks size={16} weight="duotone" className="checklist-panel-ic" aria-hidden />
            <h3 className="checklist-panel-title">{title}</h3>
            <span className="muted checklist-panel-count">
              {doneCount}/{items.length}
            </span>
          </div>
          <div
            className="checklist-progress"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={title}
          >
            <span className="checklist-progress-bar" style={{ width: `${pct}%` }} />
          </div>
        </header>
      )}

      {items.length === 0 ? (
        <div className="customer-empty-block checklist-empty">
          <CheckCircle size={22} weight="regular" aria-hidden />
          <p className="muted" style={{ margin: 0 }}>
            {emptyLabel}
          </p>
        </div>
      ) : (
        <ul className="checklist-list">
          {items.map((item) => {
            const busy = busyId === item.id
            return (
              <li
                key={item.id}
                className={`checklist-item${item.done ? ' is-done' : ''}${busy ? ' is-busy' : ''}`}
              >
                <label className="checklist-item-main">
                  <input
                    type="checkbox"
                    className="checklist-check"
                    checked={item.done}
                    disabled={!canWrite || busy}
                    onChange={async () => {
                      setBusyId(item.id)
                      try {
                        await onToggle(item.id, !item.done)
                      } finally {
                        setBusyId(null)
                      }
                    }}
                  />
                  <span className="checklist-item-title">{item.title}</span>
                </label>
              </li>
            )
          })}
        </ul>
      )}

      {canWrite ? (
        <form className="checklist-add" onSubmit={(e) => void submit(e)}>
          <input
            className="input checklist-add-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            disabled={adding}
            aria-label={placeholder}
          />
          <button type="submit" className="btn primary" disabled={adding || !draft.trim()}>
            <Plus size={14} weight="bold" aria-hidden />
            {adding ? t('loading') : t('add')}
          </button>
        </form>
      ) : null}
    </section>
  )
}
