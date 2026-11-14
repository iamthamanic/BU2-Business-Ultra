/**
 * Map inbox channel / connection provider → ConnBrandLogo id + display label key.
 * Location: apps/web/src/features/inbox/inboxChannel.ts
 */

export function inboxLogoId(channel: string | null | undefined, provider?: string | null): string {
  const ch = (channel || '').toLowerCase()
  const p = (provider || '').toLowerCase()
  if (p === 'microsoft' || p === 'outlook') return 'microsoft'
  if (p === 'google' || ch === 'email') return 'google'
  if (ch === 'whatsapp' || p === 'whatsapp') return 'whatsapp'
  if (ch === 'instagram' || p === 'instagram') return 'instagram'
  if (ch === 'telegram' || ch === 'telegram_user' || p === 'telegram' || p === 'unipile') {
    return 'telegram'
  }
  if (p === 'facebook' || ch === 'facebook') return 'facebook'
  if (p) return p
  return 'imap'
}

export type InboxChannelLabelKey =
  | 'inboxChEmail'
  | 'inboxChWhatsapp'
  | 'inboxChInstagram'
  | 'inboxChTelegram'
  | 'inboxChTelegramUser'
  | 'inboxChUnknown'

export function inboxChannelLabelKey(channel: string | null | undefined): InboxChannelLabelKey {
  switch ((channel || '').toLowerCase()) {
    case 'email':
      return 'inboxChEmail'
    case 'whatsapp':
      return 'inboxChWhatsapp'
    case 'instagram':
      return 'inboxChInstagram'
    case 'telegram':
      return 'inboxChTelegram'
    case 'telegram_user':
      return 'inboxChTelegramUser'
    default:
      return 'inboxChUnknown'
  }
}
