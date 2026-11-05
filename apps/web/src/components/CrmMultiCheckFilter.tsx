/**
 * CrmMultiCheckFilter — searchable multi-select checkbox dropdown (Labels filter).
 * Location: apps/web/src/components/CrmMultiCheckFilter.tsx
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { CaretDown, MagnifyingGlass, Tag, X } from '@phosphor-icons/react'

export type CrmMultiCheckOption = {
  value: string
  label: string
  color?: string | null
}

type Props = {
  options: CrmMultiCheckOption[]
  value: string[]
  onChange: (next: string[]) => void
  placeholder: string
  searchPlaceholder: string
  emptyLabel: string
  clearLabel: string
  'aria-label'?: string
}

export function CrmMultiCheckFilter({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  clearLabel,
  'aria-label': ariaLabel,
}: Props) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  const selected = useMemo(() => new Set(value), [value])
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return options
    return options.filter(
      (o) => o.label.toLowerCase().includes(term) || o.value.toLowerCase().includes(term),
    )
  }, [options, q])

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

  function toggle(v: string) {
    if (selected.has(v)) onChange(value.filter((x) => x !== v))
    else onChange([...value, v])
  }

  const triggerLabel =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? options.find((o) => o.value === value[0])?.label || value[0]
        : `${placeholder} (${value.length})`

  return (
    <div ref={rootRef} className={`crm-multi-filter${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="crm-multi-filter-trigger input"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel || placeholder}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="crm-multi-filter-main">
          <Tag size={14} weight="duotone" className="crm-multi-filter-ic" aria-hidden />
          <span className="crm-multi-filter-label">{triggerLabel}</span>
        </span>
        <span className="crm-multi-filter-trailing">
          {value.length > 0 ? (
            <button
              type="button"
              className="crm-multi-filter-clear"
              aria-label={clearLabel}
              onClick={(e) => {
                e.stopPropagation()
                onChange([])
              }}
            >
              <X size={12} weight="bold" aria-hidden />
            </button>
          ) : null}
          <CaretDown className="crm-multi-filter-caret" size={14} weight="bold" aria-hidden />
        </span>
      </button>

      {open ? (
        <div id={listId} className="crm-multi-filter-menu" role="listbox" aria-multiselectable>
          <label className="crm-multi-filter-search">
            <MagnifyingGlass size={14} weight="regular" aria-hidden />
            <input
              className="input crm-multi-filter-search-input"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              autoComplete="off"
              autoFocus
            />
          </label>
          {filtered.length === 0 ? (
            <p className="muted crm-multi-filter-empty">{emptyLabel}</p>
          ) : (
            <ul className="crm-multi-filter-list">
              {filtered.map((o) => {
                const on = selected.has(o.value)
                return (
                  <li key={o.value}>
                    <label className={`crm-multi-filter-option${on ? ' is-on' : ''}`}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(o.value)}
                      />
                      <span
                        className="crm-multi-filter-swatch"
                        style={
                          o.color
                            ? { background: o.color }
                            : undefined
                        }
                        aria-hidden
                      />
                      <span className="crm-multi-filter-option-label">{o.label}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
