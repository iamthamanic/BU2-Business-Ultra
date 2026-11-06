/**
 * connBrandLogos — colored brand marks for Settings → Verbindungen cards.
 * Inline SVGs (no external CDN). Location: apps/web/src/features/settings/connBrandLogos.tsx
 */
import type { ReactNode } from 'react'

const SIZES = { sm: 18, md: 22, lg: 28 } as const

type Size = keyof typeof SIZES

function Tile({
  id,
  bg,
  size,
  children,
}: {
  id: string
  bg: string
  size: Size
  children: ReactNode
}) {
  const px = SIZES[size]
  return (
    <span
      className="conn-brand-tile"
      data-ic={id}
      style={{ width: px + 14, height: px + 14, background: bg }}
      aria-hidden
    >
      <svg width={px} height={px} viewBox="0 0 24 24" fill="none">
        {children}
      </svg>
    </span>
  )
}

function GoogleMark({ size }: { size: Size }) {
  return (
    <Tile id="google" bg="#fff" size={size}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </Tile>
  )
}

function YoutubeMark({ size }: { size: Size }) {
  return (
    <Tile id="youtube" bg="#FF0000" size={size}>
      <path
        fill="#fff"
        d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-5.8zM9.75 15.5v-7l6.5 3.5-6.5 3.5z"
      />
    </Tile>
  )
}

function MicrosoftMark({ size }: { size: Size }) {
  return (
    <Tile id="microsoft" bg="#fff" size={size}>
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M13 1h10v10H13z" />
      <path fill="#00A4EF" d="M1 13h10v10H1z" />
      <path fill="#FFB900" d="M13 13h10v10H13z" />
    </Tile>
  )
}

function WhatsappMark({ size }: { size: Size }) {
  return (
    <Tile id="whatsapp" bg="#25D366" size={size}>
      <path
        fill="#fff"
        d="M12 2a9.9 9.9 0 0 0-8.5 15l-1.1 4 4.1-1.1A9.9 9.9 0 1 0 12 2zm5.7 14.1c-.2.7-1.3 1.2-2.1 1.4-.5.1-1.2.2-3.5-.7-2.8-1.2-4.6-4.1-4.7-4.3-.2-.2-1.3-1.7-1.3-3.3 0-1.5.8-2.3 1.1-2.6.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.8 2c.1.3.1.4 0 .6l-.4.6c-.2.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.2 1.3 2.5 1.5.3.1.5.1.7-.1l.9-1.1c.2-.2.4-.2.7-.1l1.9 1c.3.1.5.2.5.4 0 .2 0 .9-.2 1.6z"
      />
    </Tile>
  )
}

function InstagramMark({ size }: { size: Size }) {
  return (
    <Tile
      id="instagram"
      bg="linear-gradient(45deg,#f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)"
      size={size}
    >
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="#fff" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4.2" stroke="#fff" strokeWidth="1.8" />
      <circle cx="17.2" cy="6.8" r="1.2" fill="#fff" />
    </Tile>
  )
}

function FacebookMark({ size }: { size: Size }) {
  return (
    <Tile id="facebook" bg="#1877F2" size={size}>
      <path
        fill="#fff"
        d="M14.5 22v-8h2.7l.4-3.1h-3.1V9c0-.9.2-1.5 1.6-1.5H17.7V4.7C17.3 4.6 16.2 4.5 15 4.5c-2.7 0-4.5 1.6-4.5 4.6v2.6H8v3.1h2.5V22h4z"
      />
    </Tile>
  )
}

function TelegramMark({ size }: { size: Size }) {
  return (
    <Tile id="telegram" bg="#2AABEE" size={size}>
      <path
        fill="#fff"
        d="M9.6 14.8 9.4 18c.3 0 .5-.1.7-.3l1.7-1.6 3.5 2.6c.6.3 1.1.2 1.2-.6l2.2-10.4c.2-.9-.3-1.2-.9-1L4.3 10.7c-.9.3-.8.9-.2 1.1l3.7 1.2 8.6-5.4c.4-.3.8-.1.5.2l-7.3 6.9z"
      />
    </Tile>
  )
}

function EnvelopeMark({ size, id, bg }: { size: Size; id: string; bg: string }) {
  return (
    <Tile id={id} bg={bg} size={size}>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" stroke="#fff" strokeWidth="1.7" />
      <path d="m3.5 7 8.5 6.5L20.5 7" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round" />
    </Tile>
  )
}

function AdsMark({ size, id, bg }: { size: Size; id: string; bg: string }) {
  return (
    <Tile id={id} bg={bg} size={size}>
      <path
        fill="#fff"
        d="M4 18V6l9 6-9 6zm10.5-1.2V7.2L20 12l-5.5 4.8z"
      />
    </Tile>
  )
}

function MetricoolMark({ size }: { size: Size }) {
  return (
    <Tile id="metricool" bg="#6C5CE7" size={size}>
      <path
        fill="#fff"
        d="M6 17.5V6.5h2.4l3.6 7.2 3.6-7.2H18v11h-2.2V10.2L12.4 17.5h-1.8L7.2 10.2v7.3H6z"
      />
    </Tile>
  )
}

function OpenSeoMark({ size }: { size: Size }) {
  return (
    <Tile id="openseo" bg="#0EA5E9" size={size}>
      <circle cx="11" cy="11" r="6" stroke="#fff" strokeWidth="1.8" />
      <path d="m16 16 4.5 4.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </Tile>
  )
}

function BankMark({ size }: { size: Size }) {
  return (
    <Tile id="finapi" bg="#0F766E" size={size}>
      <path
        fill="#fff"
        d="M3 9.5 12 4l9 5.5v1.5H3V9.5zm1.5 3h2.5V18H4.5v-5.5zm5 0H12V18H9.5v-5.5zm5 0h2.5V18H14.5v-5.5zM3 19.5h18V21H3v-1.5z"
      />
    </Tile>
  )
}

function ChartMark({ size }: { size: Size }) {
  return (
    <Tile id="direct_ads" bg="#F59E0B" size={size}>
      <path
        fill="#fff"
        d="M5 18V11h3v7H5zm5.5 0V7h3v11h-3zm5.5 0V4h3v14h-3z"
      />
    </Tile>
  )
}

const LOGOS: Record<string, (size: Size) => ReactNode> = {
  google: (s) => <GoogleMark size={s} />,
  youtube: (s) => <YoutubeMark size={s} />,
  google_ads: (s) => <AdsMark size={s} id="google_ads" bg="#4285F4" />,
  meta_ads: (s) => <FacebookMark size={s} />,
  tiktok_ads: (s) => <AdsMark size={s} id="tiktok_ads" bg="#111" />,
  chatgpt_ads: (s) => <AdsMark size={s} id="chatgpt_ads" bg="#10A37F" />,
  microsoft: (s) => <MicrosoftMark size={s} />,
  imap: (s) => <EnvelopeMark size={s} id="imap" bg="#7C3AED" />,
  whatsapp: (s) => <WhatsappMark size={s} />,
  instagram: (s) => <InstagramMark size={s} />,
  facebook: (s) => <FacebookMark size={s} />,
  telegram: (s) => <TelegramMark size={s} />,
  unipile: (s) => <TelegramMark size={s} />,
  metricool: (s) => <MetricoolMark size={s} />,
  brevo: (s) => <EnvelopeMark size={s} id="brevo" bg="#0B996E" />,
  openseo: (s) => <OpenSeoMark size={s} />,
  direct_ads: (s) => <ChartMark size={s} />,
  finapi: (s) => <BankMark size={s} />,
  finance: (s) => <BankMark size={s} />,
}

/** Colored brand tile — prefer over generic Phosphor for connection chrome. */
export function ConnBrandLogo({ id, size = 'md' }: { id: string; size?: Size }) {
  const render = LOGOS[id]
  if (render) return <>{render(size)}</>
  return <EnvelopeMark size={size} id={id} bg="#334155" />
}
