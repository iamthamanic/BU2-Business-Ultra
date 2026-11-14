/**
 * emailTemplates — canned reply bodies + placeholder catalog for the email composer.
 * Location: apps/web/src/features/inbox/emailTemplates.ts
 */

export type EmailPlaceholder = {
  key: string
  labelDe: string
  labelEn: string
}

export type EmailTemplate = {
  id: string
  titleDe: string
  titleEn: string
  /** HTML with {{placeholders}} */
  html: string
}

export const EMAIL_PLACEHOLDERS: EmailPlaceholder[] = [
  { key: 'kontakt.name', labelDe: 'Kontaktname', labelEn: 'Contact name' },
  { key: 'kontakt.email', labelDe: 'Kontakt-E-Mail', labelEn: 'Contact email' },
  { key: 'unternehmen', labelDe: 'Unternehmen', labelEn: 'Company' },
  { key: 'betreff', labelDe: 'Betreff', labelEn: 'Subject' },
  { key: 'konto', labelDe: 'Absenderkonto', labelEn: 'From account' },
  { key: 'zugewiesen', labelDe: 'Zugewiesen an', labelEn: 'Assignee' },
  { key: 'heute', labelDe: 'Heutiges Datum', labelEn: 'Today’s date' },
]

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'trial',
    titleDe: 'Trial anbieten',
    titleEn: 'Offer trial',
    html: `<p>Hallo {{kontakt.name}},</p><p>vielen Dank für Ihre Anfrage zu <strong>{{betreff}}</strong>.</p><p>Wir können Ihnen einen <strong>14-Tage-Trial ohne Kreditkarte</strong> freischalten. Soll ich den Link an {{kontakt.email}} senden?</p><p>Freundliche Grüße<br>{{zugewiesen}}<br>{{unternehmen}}</p>`,
  },
  {
    id: 'pricing',
    titleDe: 'Preise kurz',
    titleEn: 'Pricing brief',
    html: `<p>Hallo {{kontakt.name}},</p><p>hier die Kurzfassung unserer Preise:</p><ul><li><strong>Pro</strong> — 12,90&nbsp;€ / Monat</li><li><strong>Studio</strong> — Jahresabo mit Rabatt</li></ul><p>Details schicke ich gerne passend zu Ihrem Use-Case.</p><p>Beste Grüße<br>{{zugewiesen}}</p>`,
  },
  {
    id: 'support-ack',
    titleDe: 'Support-Eingang',
    titleEn: 'Support received',
    html: `<p>Hallo {{kontakt.name}},</p><p>wir haben Ihre Nachricht erhalten und schauen uns das an. Ticket-Bezug: <em>{{betreff}}</em>.</p><p>Rückmeldung folgt in der Regel innerhalb eines Werktags.</p><p>{{unternehmen}} Support<br>{{zugewiesen}}</p>`,
  },
  {
    id: 'meeting',
    titleDe: 'Rückruf / Termin',
    titleEn: 'Callback / meeting',
    html: `<p>Hallo {{kontakt.name}},</p><p>gerne klären wir das kurz im Call. Passt Ihnen morgen Vormittag, oder haben Sie einen Wunschtermin?</p><p>Viele Grüße<br>{{zugewiesen}}<br>{{unternehmen}}</p>`,
  },
  {
    id: 'closing',
    titleDe: 'Abschluss / Danke',
    titleEn: 'Closing thanks',
    html: `<p>Hallo {{kontakt.name}},</p><p>super, dass wir das klären konnten. Bei weiteren Fragen einfach auf diese Mail antworten.</p><p>Alles Gute<br>{{zugewiesen}}</p>`,
  },
]

export type PlaceholderValues = Record<string, string>

export function fillPlaceholders(html: string, values: PlaceholderValues): string {
  return html.replace(/\{\{\s*([a-z0-9_.]+)\s*\}\}/gi, (_, key: string) => {
    const v = values[key]
    return v != null && v !== '' ? escapeHtml(v) : `{{${key}}}`
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
