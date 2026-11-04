/**
 * connProviderIcons — Phosphor brand glyphs for messaging connect cards.
 * Location: apps/web/src/features/settings/connProviderIcons.tsx
 */
import type { Icon } from '@phosphor-icons/react'
import {
  EnvelopeSimple,
  FacebookLogo,
  GoogleLogo,
  InstagramLogo,
  TelegramLogo,
  WhatsappLogo,
  WindowsLogo,
} from '@phosphor-icons/react'

const ICONS: Record<string, Icon> = {
  google: GoogleLogo,
  microsoft: WindowsLogo,
  imap: EnvelopeSimple,
  whatsapp: WhatsappLogo,
  instagram: InstagramLogo,
  facebook: FacebookLogo,
  telegram: TelegramLogo,
  unipile: TelegramLogo,
}

export function ConnProviderIcon({ id, size = 22 }: { id: string; size?: number }) {
  const Icon = ICONS[id] || EnvelopeSimple
  return <Icon className="conn-provider-icon" size={size} weight="duotone" aria-hidden />
}
