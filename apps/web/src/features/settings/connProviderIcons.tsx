/**
 * connProviderIcons — Phosphor brand glyphs for connection cards / panels.
 * Location: apps/web/src/features/settings/connProviderIcons.tsx
 */
import type { Icon } from '@phosphor-icons/react'
import {
  Bank,
  ChartBar,
  EnvelopeSimple,
  FacebookLogo,
  GoogleLogo,
  InstagramLogo,
  MagnifyingGlass,
  Megaphone,
  SquaresFour,
  TelegramLogo,
  WhatsappLogo,
  WindowsLogo,
  YoutubeLogo,
} from '@phosphor-icons/react'

const ICONS: Record<string, Icon> = {
  google: GoogleLogo,
  youtube: YoutubeLogo,
  google_ads: Megaphone,
  meta_ads: FacebookLogo,
  tiktok_ads: Megaphone,
  chatgpt_ads: Megaphone,
  microsoft: WindowsLogo,
  imap: EnvelopeSimple,
  whatsapp: WhatsappLogo,
  instagram: InstagramLogo,
  facebook: FacebookLogo,
  telegram: TelegramLogo,
  unipile: TelegramLogo,
  metricool: SquaresFour,
  brevo: EnvelopeSimple,
  openseo: MagnifyingGlass,
  direct_ads: ChartBar,
  finapi: Bank,
  finance: Bank,
}

const TONES: Record<string, string> = {
  google: '#ea4335',
  youtube: '#ff0000',
  google_ads: '#4285f4',
  meta_ads: '#1877f2',
  tiktok_ads: '#69c9d0',
  chatgpt_ads: '#10a37f',
  microsoft: '#00a4ef',
  imap: '#a78bfa',
  whatsapp: '#25d366',
  instagram: '#e4405f',
  facebook: '#1877f2',
  telegram: '#2aabee',
  unipile: '#2aabee',
  metricool: '#7c5cff',
  brevo: '#0b996e',
  openseo: '#3d8bfd',
  direct_ads: '#f59e0b',
  finapi: '#22c55e',
  finance: '#22c55e',
}

export function ConnProviderIcon({ id, size = 22 }: { id: string; size?: number }) {
  const Glyph = ICONS[id] || EnvelopeSimple
  const tone = TONES[id]
  return (
    <Glyph
      className="conn-provider-icon"
      size={size}
      weight="duotone"
      aria-hidden
      style={tone ? { color: tone } : undefined}
    />
  )
}
