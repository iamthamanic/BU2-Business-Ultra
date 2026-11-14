/**
 * EmailEditor — Proton/Notion-inspired rich toolbar for inbox email replies (contenteditable).
 * Reuses note sanitizer patterns; adds link, lists, headings, quote. Location: …/inbox/EmailEditor.tsx
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import {
  ListBullets,
  ListNumbers,
  LinkSimple,
  Quotes,
  TextB,
  TextH,
  TextItalic,
  TextUnderline,
  TextT,
} from '@phosphor-icons/react'
import { useI18n } from '../../lib/i18n'

const ALLOWED = new Set([
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
  'A',
  'H2',
  'H3',
  'BLOCKQUOTE',
])

export function sanitizeEmailHtml(html: string): string {
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
    if (!ALLOWED.has(tag)) return kids
    if (tag === 'BR') return '<br>'
    if (tag === 'A') {
      const href = (el.getAttribute('href') || '').trim()
      if (!/^https?:\/\//i.test(href) && !/^mailto:/i.test(href)) return kids
      return `<a href="${href.replace(/"/g, '')}" target="_blank" rel="noopener noreferrer">${kids}</a>`
    }
    if (tag === 'SPAN') {
      const color = (el.style.color || '').trim()
      if (color && /^#([0-9a-f]{3,8})$/i.test(color)) {
        return `<span style="color:${color}">${kids}</span>`
      }
      return kids
    }
    return `<${tag.toLowerCase()}>${kids}</${tag.toLowerCase()}>`
  }
  return Array.from(doc.body.childNodes).map(walk).join('')
}

export function emailPlainText(html: string): string {
  if (!html) return ''
  if (typeof DOMParser === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const lines: string[] = []
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent || '').replace(/\u00a0/g, ' ')
      if (t) lines.push(t)
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as HTMLElement
    const tag = el.tagName
    if (tag === 'BR') {
      lines.push('\n')
      return
    }
    if (tag === 'LI') {
      lines.push('• ')
      Array.from(el.childNodes).forEach(walk)
      lines.push('\n')
      return
    }
    if (['P', 'DIV', 'H2', 'H3', 'BLOCKQUOTE'].includes(tag)) {
      Array.from(el.childNodes).forEach(walk)
      lines.push('\n')
      return
    }
    Array.from(el.childNodes).forEach(walk)
  }
  Array.from(doc.body.childNodes).forEach(walk)
  return lines.join('').replace(/\n{3,}/g, '\n\n').trim()
}

export type EmailEditorHandle = {
  insertHtml: (snippet: string) => void
  focus: () => void
}

type Fmt = {
  bold: boolean
  italic: boolean
  underline: boolean
  ul: boolean
  ol: boolean
}

const EMPTY: Fmt = { bold: false, italic: false, underline: false, ul: false, ol: false }

type Props = {
  value: string
  onChange: (html: string) => void
  disabled?: boolean
  placeholder?: string
  autoFocus?: boolean
}

export const EmailEditor = forwardRef<EmailEditorHandle, Props>(function EmailEditor(
  { value, onChange, disabled, placeholder, autoFocus },
  ref,
) {
  const { t } = useI18n()
  const elRef = useRef<HTMLDivElement>(null)
  const last = useRef<string | null>(null)
  const [fmt, setFmt] = useState<Fmt>(EMPTY)

  const syncFmt = useCallback(() => {
    if (!elRef.current || disabled) return
    try {
      setFmt({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        ul: document.queryCommandState('insertUnorderedList'),
        ol: document.queryCommandState('insertOrderedList'),
      })
    } catch {
      /* ignore */
    }
  }, [disabled])

  function emit() {
    const html = sanitizeEmailHtml(elRef.current?.innerHTML || '')
    last.current = html
    onChange(html)
    syncFmt()
  }

  function insertHtml(snippet: string) {
    if (disabled) return
    const el = elRef.current
    if (!el) return
    el.focus()
    document.execCommand('insertHTML', false, snippet)
    emit()
  }

  useImperativeHandle(ref, () => ({
    insertHtml,
    focus: () => elRef.current?.focus(),
  }))

  useEffect(() => {
    const el = elRef.current
    if (!el) return
    if (value === last.current) return
    if (el.innerHTML !== value) el.innerHTML = value || ''
    last.current = value
  }, [value])

  useEffect(() => {
    if (!autoFocus) return
    const el = elRef.current
    if (!el) return
    const id = requestAnimationFrame(() => {
      el.focus()
      const sel = window.getSelection()
      if (!sel) return
      const range = document.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
      sel.removeAllRanges()
      sel.addRange(range)
    })
    return () => cancelAnimationFrame(id)
  }, [autoFocus])

  useEffect(() => {
    const onSel = () => syncFmt()
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [syncFmt])

  function run(cmd: string, arg?: string) {
    if (disabled) return
    elRef.current?.focus()
    document.execCommand(cmd, false, arg)
    emit()
  }

  function insertLink() {
    const url = window.prompt(t('inboxEmailLinkPrompt'), 'https://')
    if (!url) return
    const href = url.trim()
    if (!/^https?:\/\//i.test(href) && !/^mailto:/i.test(href)) return
    run('createLink', href)
  }

  return (
    <div className={`inbox-email-editor${disabled ? ' is-disabled' : ''}`}>
      <div className="inbox-email-tools" role="toolbar" aria-label={t('inboxEmailFormat')}>
        <button
          type="button"
          className={`inbox-email-tool${fmt.bold ? ' is-on' : ''}`}
          disabled={disabled}
          aria-pressed={fmt.bold}
          title={t('customerNoteBold')}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run('bold')}
        >
          <TextB size={14} weight="bold" aria-hidden />
        </button>
        <button
          type="button"
          className={`inbox-email-tool${fmt.italic ? ' is-on' : ''}`}
          disabled={disabled}
          aria-pressed={fmt.italic}
          title={t('customerNoteItalic')}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run('italic')}
        >
          <TextItalic size={14} weight="bold" aria-hidden />
        </button>
        <button
          type="button"
          className={`inbox-email-tool${fmt.underline ? ' is-on' : ''}`}
          disabled={disabled}
          aria-pressed={fmt.underline}
          title={t('customerNoteUnderline')}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run('underline')}
        >
          <TextUnderline size={14} weight="bold" aria-hidden />
        </button>
        <span className="inbox-email-tools-sep" aria-hidden />
        <button
          type="button"
          className="inbox-email-tool"
          disabled={disabled}
          title={t('inboxEmailHeading')}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run('formatBlock', 'h2')}
        >
          <TextH size={14} weight="bold" aria-hidden />
        </button>
        <button
          type="button"
          className="inbox-email-tool"
          disabled={disabled}
          title={t('inboxEmailParagraph')}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run('formatBlock', 'p')}
        >
          <TextT size={14} weight="bold" aria-hidden />
        </button>
        <button
          type="button"
          className={`inbox-email-tool${fmt.ul ? ' is-on' : ''}`}
          disabled={disabled}
          aria-pressed={fmt.ul}
          title={t('customerNoteList')}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run('insertUnorderedList')}
        >
          <ListBullets size={14} weight="bold" aria-hidden />
        </button>
        <button
          type="button"
          className={`inbox-email-tool${fmt.ol ? ' is-on' : ''}`}
          disabled={disabled}
          aria-pressed={fmt.ol}
          title={t('inboxEmailOrderedList')}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run('insertOrderedList')}
        >
          <ListNumbers size={14} weight="bold" aria-hidden />
        </button>
        <button
          type="button"
          className="inbox-email-tool"
          disabled={disabled}
          title={t('inboxEmailQuote')}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run('formatBlock', 'blockquote')}
        >
          <Quotes size={14} weight="bold" aria-hidden />
        </button>
        <button
          type="button"
          className="inbox-email-tool"
          disabled={disabled}
          title={t('inboxEmailLink')}
          onMouseDown={(e) => e.preventDefault()}
          onClick={insertLink}
        >
          <LinkSimple size={14} weight="bold" aria-hidden />
        </button>
      </div>
      <div
        ref={elRef}
        className="inbox-email-rich"
        contentEditable={!disabled}
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder || t('inboxReplyPh')}
        data-placeholder={placeholder || t('inboxReplyPh')}
        suppressContentEditableWarning
        onInput={emit}
        onKeyUp={syncFmt}
        onMouseUp={syncFmt}
        onBlur={emit}
      />
    </div>
  )
})
