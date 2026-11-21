/**
 * Contact relation-status label + icon (shared by Kontakte list and detail).
 * Location: apps/web/src/features/customers/customerStatus.tsx
 */
import { Handshake, SealCheck, UserPlus } from '@phosphor-icons/react'
import type { MessageKey } from '../../i18n/messages'

export function statusLabel(s: string, t: (k: MessageKey) => string): string {
  if (s === 'prospect') return t('customerStatusProspect')
  if (s === 'customer') return t('customerStatusCustomer')
  return t('customerStatusLead')
}

export function statusIcon(s: string) {
  if (s === 'prospect') return <Handshake size={12} weight="regular" aria-hidden />
  if (s === 'customer') return <SealCheck size={12} weight="regular" aria-hidden />
  return <UserPlus size={12} weight="regular" aria-hidden />
}
