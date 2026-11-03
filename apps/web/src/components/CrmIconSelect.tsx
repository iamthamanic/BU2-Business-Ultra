/**
 * CrmIconSelect — Dark-Ops listbox with leading icon/tone (native select can't).
 * Location: apps/web/src/components/CrmIconSelect.tsx
 */
import { CaretDown } from '@phosphor-icons/react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

export type CrmIconSelectOption = {
  value: string
  label: string
  icon?: ReactNode
  tone?: string
}

type Props = {
  name: string
  value: string
  options: CrmIconSelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
  'aria-label'?: string
}

export function CrmIconSelect({
  name,
  value,
  options,
  onChange,
  disabled,
  'aria-label': ariaLabel,
}: Props) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value) || options[0]

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className={`crm-icon-select${open ? ' is-open' : ''}`}>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        className="crm-icon-select-trigger input"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="crm-icon-select-main" data-tone={selected?.tone || undefined}>
          {selected?.icon ? <span className="crm-icon-select-ic">{selected.icon}</span> : null}
          <span className="crm-icon-select-label">{selected?.label}</span>
        </span>
        <CaretDown className="crm-icon-select-caret" size={14} weight="bold" aria-hidden />
      </button>
      {open ? (
        <ul id={listId} className="crm-icon-select-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((o) => {
            const on = o.value === value
            return (
              <li key={o.value || '__empty'} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  className={`crm-icon-select-option${on ? ' is-on' : ''}`}
                  data-tone={o.tone || undefined}
                  onClick={() => {
                    onChange(o.value)
                    setOpen(false)
                  }}
                >
                  {o.icon ? <span className="crm-icon-select-ic">{o.icon}</span> : null}
                  <span className="crm-icon-select-label">{o.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
