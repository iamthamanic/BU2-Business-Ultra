/**
 * CustomerNoteEditor — rich note toolbar (bold/italic/underline/list/color) + sanitized HTML body.
 * Location: apps/web/src/features/customers/CustomerNoteEditor.tsx
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ListBullets,
  TextB,
  TextItalic,
  TextUnderline,
} from '@phosphor-icons/react'
import { useI18n } from '../../lib/i18n'
import type { MessageKey } from '../../i18n/messages'

const NOTE_COLORS: { id: string; value: string; labelKey: MessageKey }[] = [
  { id: 'text', value: '#e8eef5', labelKey: 'customerNoteColorText' },
  { id: 'accent', value: '#3d8bfd', labelKey: 'customerNoteColorAccent' },
  { id: 'good', value: '#22c55e', labelKey: 'customerNoteColorGood' },
  { id: 'warn', value: '#f59e0b', labelKey: 'customerNoteColorWarn' },
  { id: 'bad', value: '#ef4444', labelKey: 'customerNoteColorBad' },
  { id: 'dim', value: '#8b98a8', labelKey: 'customerNoteColorDim' },
]

type FmtState = {
  bold: boolean
  italic: boolean
  underline: boolean
  list: boolean
  colorId: string | null
}

const EMPTY_FMT: FmtState = {
  bold: false,
  italic: false,
  underline: false,
  list: false,
  colorId: null,
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace('#', '').trim()
  if (h.length === 3) {
    return {
      r: parseInt(h[0]! + h[0]!, 16),
      g: parseInt(h[1]! + h[1]!, 16),
      b: parseInt(h[2]! + h[2]!, 16),
    }
  }
  if (h.length === 6 || h.length === 8) {
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    }
  }
  return null
}

function parseCssColor(raw: string): { r: number; g: number; b: number } | null {
  const v = raw.trim().toLowerCase()
  if (!v || v === 'false' || v === 'null') return null
  if (v.startsWith('#')) return hexToRgb(v)
  const m = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (m) return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) }
  return null
}

function matchNoteColorId(raw: string): string | null {
  const rgb = parseCssColor(raw)
  if (!rgb) return null
  for (const c of NOTE_COLORS) {
    const target = hexToRgb(c.value)
    if (!target) continue
    if (target.r === rgb.r && target.g === rgb.g && target.b === rgb.b) return c.id
  }
  return null
}

const ALLOWED_TAGS = new Set([
  'B',
  'STRONG',
  'I',
  'EM',
  'U',
  'UL',
  'OL',
  'LI',
  'BR',
  'P',
  'DIV',
  'SPAN',
  'FONT',
])

function sanitizeColor(value: string): string | null {
  const v = value.trim().toLowerCase()
  if (/^#[0-9a-f]{3,8}$/.test(v)) return v
  if (/^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/.test(v)) return v
  return null
}

/** Strip unsafe tags/attrs; keep formatting tags + color only. */
export function sanitizeNoteHtml(html: string): string {
  if (!html) return ''
  if (typeof DOMParser === 'undefined') {
    return html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
  }
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || ''
    if (node.nodeType !== Node.ELEMENT_NODE) return ''
    const el = node as HTMLElement
    const tag = el.tagName.toUpperCase()
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'IFRAME') return ''
    const kids = Array.from(el.childNodes).map(walk).join('')
    if (!ALLOWED_TAGS.has(tag)) return kids
    if (tag === 'BR') return '<br>'
    if (tag === 'SPAN' || tag === 'FONT') {
      const raw =
        el.style.color ||
        el.getAttribute('color') ||
        ''
      const color = sanitizeColor(raw)
      if (!color) return kids
      return `<span style="color:${color}">${kids}</span>`
    }
    const open = tag.toLowerCase()
    return `<${open}>${kids}</${open}>`
  }
  return Array.from(doc.body.childNodes).map(walk).join('')
}

export function notePlainText(html: string): string {
  if (!html) return ''
  if (typeof DOMParser === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (doc.body.textContent || '').replace(/\u00a0/g, ' ').trim()
}

export function NoteBodyHtml({ body }: { body: string }) {
  const safe = sanitizeNoteHtml(body)
  if (!/<[a-z]/i.test(safe)) {
    return <p className="customer-note-body">{safe}</p>
  }
  return (
    <div
      className="customer-note-body customer-note-body--rich"
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  )
}

type Props = {
  value: string
  onChange: (html: string) => void
  disabled?: boolean
  placeholder?: string
  autoFocus?: boolean
  rows?: number
}

export function CustomerNoteEditor({
  value,
  onChange,
  disabled,
  placeholder,
  autoFocus,
  rows = 6,
}: Props) {
  const { t } = useI18n()
  const ref = useRef<HTMLDivElement>(null)
  // null = never synced; must differ from any real value so first mount seeds the DOM
  const lastEmitted = useRef<string | null>(null)
  const [fmt, setFmt] = useState<FmtState>(EMPTY_FMT)

  const syncFmt = useCallback(() => {
    const el = ref.current
    if (!el || disabled) {
      setFmt(EMPTY_FMT)
      return
    }
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) {
      return
    }
    try {
      setFmt({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        list: document.queryCommandState('insertUnorderedList'),
        colorId: matchNoteColorId(document.queryCommandValue('foreColor') || ''),
      })
    } catch {
      /* execCommand state can throw in some browsers */
    }
  }, [disabled])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (value === lastEmitted.current) return
    if (el.innerHTML !== value) el.innerHTML = value || ''
    lastEmitted.current = value
  }, [value])

  useEffect(() => {
    if (!autoFocus) return
    const el = ref.current
    if (!el) return
    // Defer focus until after value→DOM sync so caret lands after existing content
    const id = window.requestAnimationFrame(() => {
      el.focus()
      const sel = window.getSelection()
      if (!sel) return
      const range = document.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
      sel.removeAllRanges()
      sel.addRange(range)
      syncFmt()
    })
    return () => window.cancelAnimationFrame(id)
  }, [autoFocus, syncFmt])

  useEffect(() => {
    const onSel = () => syncFmt()
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [syncFmt])

  function emit() {
    const html = sanitizeNoteHtml(ref.current?.innerHTML || '')
    lastEmitted.current = html
    onChange(html)
    syncFmt()
  }

  function run(cmd: string, arg?: string) {
    if (disabled) return
    ref.current?.focus()
    document.execCommand(cmd, false, arg)
    emit()
  }

  const minHeight = Math.max(96, rows * 22)

  return (
    <div className={`customer-note-editor${disabled ? ' is-disabled' : ''}`}>
      <div className="customer-note-tools" role="toolbar" aria-label={t('customerNoteFormat')}>
        <button
          type="button"
          className={`customer-note-tool${fmt.bold ? ' is-on' : ''}`}
          disabled={disabled}
          aria-label={t('customerNoteBold')}
          aria-pressed={fmt.bold}
          title={t('customerNoteBold')}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run('bold')}
        >
          <TextB size={14} weight="bold" aria-hidden />
        </button>
        <button
          type="button"
          className={`customer-note-tool${fmt.italic ? ' is-on' : ''}`}
          disabled={disabled}
          aria-label={t('customerNoteItalic')}
          aria-pressed={fmt.italic}
          title={t('customerNoteItalic')}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run('italic')}
        >
          <TextItalic size={14} weight="bold" aria-hidden />
        </button>
        <button
          type="button"
          className={`customer-note-tool${fmt.underline ? ' is-on' : ''}`}
          disabled={disabled}
          aria-label={t('customerNoteUnderline')}
          aria-pressed={fmt.underline}
          title={t('customerNoteUnderline')}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run('underline')}
        >
          <TextUnderline size={14} weight="bold" aria-hidden />
        </button>
        <button
          type="button"
          className={`customer-note-tool${fmt.list ? ' is-on' : ''}`}
          disabled={disabled}
          aria-label={t('customerNoteList')}
          aria-pressed={fmt.list}
          title={t('customerNoteList')}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run('insertUnorderedList')}
        >
          <ListBullets size={14} weight="bold" aria-hidden />
        </button>
        <span className="customer-note-tools-sep" aria-hidden />
        <div className="customer-note-colors" role="group" aria-label={t('customerNoteColor')}>
          {NOTE_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`customer-note-color${fmt.colorId === c.id ? ' is-on' : ''}`}
              style={{ background: c.value }}
              disabled={disabled}
              aria-label={t(c.labelKey)}
              aria-pressed={fmt.colorId === c.id}
              title={t(c.labelKey)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => run('foreColor', c.value)}
            />
          ))}
        </div>
      </div>
      <div
        ref={ref}
        className="customer-note-input customer-note-rich"
        contentEditable={!disabled}
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder || t('customerNotePh')}
        data-placeholder={placeholder || t('customerNotePh')}
        suppressContentEditableWarning
        style={{ minHeight }}
        onInput={emit}
        onKeyUp={syncFmt}
        onMouseUp={syncFmt}
        onBlur={emit}
      />
    </div>
  )
}
