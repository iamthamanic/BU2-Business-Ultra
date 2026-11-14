/**
 * EmailComposerModal — full-screen-ish Dark-Ops email reply (rich editor + templates + placeholders).
 * Opens from inbox composer when channel is email. Location: apps/web/src/features/inbox/EmailComposerModal.tsx
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PaperPlaneTilt } from '@phosphor-icons/react'
import { useI18n } from '../../lib/i18n'
import { EmailEditor, emailPlainText, type EmailEditorHandle } from './EmailEditor'
import {
  EMAIL_PLACEHOLDERS,
  EMAIL_TEMPLATES,
  fillPlaceholders,
  type PlaceholderValues,
} from './emailTemplates'

export type EmailComposerContext = {
  subject: string
  toEmail: string | null
  toName: string | null
  fromAccount: string | null
  companyName: string
  assigneeName: string | null
}

export type EmailComposerHistoryItem = {
  id: string
  direction: string
  body: string
  when: string
  who: string
}

type Props = {
  open: boolean
  busy?: boolean
  error?: string | null
  context: EmailComposerContext
  history?: EmailComposerHistoryItem[]
  initialHtml?: string
  onClose: () => void
  onSend: (plain: string, html: string) => void
}

export function EmailComposerModal({
  open,
  busy = false,
  error,
  context,
  history = [],
  initialHtml = '',
  onClose,
  onSend,
}: Props) {
  const { t, locale } = useI18n()
  const en = locale === 'en'
  const editorRef = useRef<EmailEditorHandle>(null)
  const [html, setHtml] = useState(initialHtml)
  const [rail, setRail] = useState<'templates' | 'placeholders'>('templates')

  useEffect(() => {
    if (open) setHtml(initialHtml)
  }, [open, initialHtml])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  const values: PlaceholderValues = useMemo(
    () => ({
      'kontakt.name': context.toName || context.toEmail || (en ? 'there' : 'dort'),
      'kontakt.email': context.toEmail || '',
      unternehmen: context.companyName || '',
      betreff: context.subject || '',
      konto: context.fromAccount || '',
      zugewiesen: context.assigneeName || (en ? 'Team' : 'Team'),
      heute: new Date().toLocaleDateString(en ? 'en-GB' : 'de-DE', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    }),
    [context, en],
  )

  const plain = emailPlainText(html)
  const canSend = plain.length > 0 && !busy

  if (!open) return null

  return createPortal(
    <div
      className="bu-modal-overlay inbox-email-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inbox-email-composer-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div
        className="bu-modal panel inbox-email-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="bu-modal-head inbox-email-modal-head">
          <div className="inbox-email-modal-titles">
            <h2 id="inbox-email-composer-title" className="section-title">
              {t('inboxEmailComposeTitle')}
            </h2>
            <p className="inbox-email-modal-subject muted" title={context.subject}>
              {t('inboxHeaderSubject')}: {context.subject || '—'}
            </p>
          </div>
        </header>

        <div className="inbox-email-meta-row">
          <span className="inbox-email-chip">
            <span className="muted">{t('inboxEmailTo')}</span>
            <strong>{context.toEmail || context.toName || '—'}</strong>
          </span>
          <span className="inbox-email-chip">
            <span className="muted">{t('inboxEmailFrom')}</span>
            <strong>{context.fromAccount || '—'}</strong>
          </span>
        </div>

        <div className="inbox-email-layout">
          <aside className="inbox-email-rail" aria-label={t('inboxEmailRail')}>
            <div className="inbox-email-rail-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                className={`btn inbox-email-rail-tab${rail === 'templates' ? ' is-on' : ''}`}
                aria-selected={rail === 'templates'}
                onClick={() => setRail('templates')}
              >
                {t('inboxEmailTemplates')}
              </button>
              <button
                type="button"
                role="tab"
                className={`btn inbox-email-rail-tab${rail === 'placeholders' ? ' is-on' : ''}`}
                aria-selected={rail === 'placeholders'}
                onClick={() => setRail('placeholders')}
              >
                {t('inboxEmailPlaceholders')}
              </button>
            </div>
            {rail === 'templates' ? (
              <ul className="inbox-email-rail-list">
                {EMAIL_TEMPLATES.map((tpl) => (
                  <li key={tpl.id}>
                    <button
                      type="button"
                      className="inbox-email-rail-item"
                      disabled={busy}
                      onClick={() => {
                        const filled = fillPlaceholders(tpl.html, values)
                        setHtml(filled)
                        editorRef.current?.focus()
                      }}
                    >
                      {en ? tpl.titleEn : tpl.titleDe}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="inbox-email-rail-list">
                {EMAIL_PLACEHOLDERS.map((ph) => (
                  <li key={ph.key}>
                    <button
                      type="button"
                      className="inbox-email-rail-item"
                      disabled={busy}
                      title={`{{${ph.key}}}`}
                      onClick={() => {
                        const filled = values[ph.key]
                        const snippet =
                          filled != null && filled !== ''
                            ? escapeText(filled)
                            : `{{${ph.key}}}`
                        editorRef.current?.insertHtml(snippet)
                      }}
                    >
                      <span>{en ? ph.labelEn : ph.labelDe}</span>
                      <code className="muted">{`{{${ph.key}}}`}</code>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <div className="inbox-email-main">
            {history.length > 0 ? (
              <section className="inbox-email-history" aria-label={t('inboxEmailHistory')}>
                <header className="inbox-email-history-head">{t('inboxEmailHistory')}</header>
                <ul className="inbox-email-history-list">
                  {history.map((m) => (
                    <li
                      key={m.id}
                      className={`inbox-email-history-item inbox-email-history-item--${m.direction}`}
                    >
                      <div className="inbox-email-history-meta">
                        <span className="inbox-email-history-who">{m.who}</span>
                        {m.when ? (
                          <span className="muted inbox-email-history-when">{m.when}</span>
                        ) : null}
                      </div>
                      <p className="inbox-email-history-body">{m.body}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <EmailEditor
              ref={editorRef}
              value={html}
              onChange={setHtml}
              disabled={busy}
              autoFocus
              placeholder={t('inboxReplyPh')}
            />
            {error ? (
              <p className="error" style={{ margin: '8px 0 0', fontSize: 12 }}>
                {error}
              </p>
            ) : null}
          </div>
        </div>

        <footer className="bu-modal-actions inbox-email-modal-actions">
          <button type="button" className="btn" disabled={busy} onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!canSend}
            onClick={() => onSend(plain, html)}
          >
            <PaperPlaneTilt size={14} weight="bold" aria-hidden />
            {busy ? t('loading') : t('inboxSend')}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}

function escapeText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
