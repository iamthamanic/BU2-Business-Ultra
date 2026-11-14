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

/** OpenAI / ChatGPT bloom (Simple Icons). */
function ChatGptMark({ size }: { size: Size }) {
  return (
    <Tile id="chatgpt_ads" bg="#10A37F" size={size}>
      <path
        fill="#fff"
        d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"
      />
    </Tile>
  )
}

/** Google Ads product mark — green disc + yellow/blue triangles (brand colors). */
function GoogleAdsMark({ size }: { size: Size }) {
  return (
    <Tile id="google_ads" bg="#FFF" size={size}>
      <path
        fill="#34A853"
        d="M3.9998 22.9291C1.7908 22.9291 0 21.1383 0 18.9293s1.7908-3.9998 3.9998-3.9998 3.9998 1.7908 3.9998 3.9998-1.7908 3.9998-3.9998 3.9998z"
      />
      <path
        fill="#4285F4"
        d="M23.4641 16.9287L15.4632 3.072C14.3586 1.1587 11.9121.5028 9.9988 1.6074S7.4295 5.1585 8.5341 7.0718l8.0009 13.8567c1.1046 1.9133 3.5511 2.5679 5.4644 1.4646 1.9134-1.1046 2.568-3.5511 1.4647-5.4644z"
      />
      <path
        fill="#FBBC04"
        d="M7.5137 4.8438L1.5645 15.1484A4.5 4.5 0 0 1 4 14.4297c2.5597-.0075 4.6248 2.1585 4.4941 4.7148l3.2168-5.5723-3.6094-6.25c-.4499-.7793-.6322-1.6394-.5878-2.4784z"
      />
    </Tile>
  )
}

function RedditMark({ size }: { size: Size }) {
  return (
    <Tile id="reddit_ads" bg="#FF4500" size={size}>
      <circle cx="12" cy="13" r="7" fill="#fff" />
      <circle cx="9.2" cy="12.5" r="1.2" fill="#FF4500" />
      <circle cx="14.8" cy="12.5" r="1.2" fill="#FF4500" />
      <path
        fill="#FF4500"
        d="M9.2 15.2c.8.9 2 1.4 2.8 1.4s2-.5 2.8-1.4"
        stroke="#FF4500"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="17.5" cy="8.2" r="1.3" fill="#fff" />
      <path d="M14.5 9.2c.6-.8 1.5-1.4 2.6-1.5" stroke="#fff" strokeWidth="1.2" />
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

function LinkedInMark({ size }: { size: Size }) {
  return (
    <Tile id="linkedin" bg="#0A66C2" size={size}>
      <path
        fill="#fff"
        d="M6.4 9.2h2.7v8.6H6.4V9.2zM7.75 5.2a1.55 1.55 0 1 1 0 3.1 1.55 1.55 0 0 1 0-3.1zM11.2 9.2h2.6v1.18h.04c.36-.68 1.24-1.4 2.56-1.4 2.74 0 3.25 1.8 3.25 4.14v4.68h-2.7v-4.15c0-.99-.02-2.26-1.38-2.26-1.38 0-1.59 1.08-1.59 2.19v4.22h-2.78V9.2z"
      />
    </Tile>
  )
}

/** X (Twitter) — current wordmark. */
function XMark({ size }: { size: Size }) {
  return (
    <Tile id="x" bg="#000" size={size}>
      <path
        fill="#fff"
        d="M16.9 4.5h2.4l-5.25 6 6.17 9H15.7l-3.8-4.96L7.5 19.5H5.1l5.62-6.42L4.8 4.5h4.64l3.43 4.54L16.9 4.5zm-.84 13.2h1.33L8.1 5.86H6.67l9.39 11.84z"
      />
    </Tile>
  )
}

/** TikTok — note glyph with cyan/magenta offset. */
function TikTokMark({ size, id = 'tiktok' }: { size: Size; id?: string }) {
  return (
    <Tile id={id} bg="#010101" size={size}>
      <path
        fill="#25F4EE"
        d="M14.2 3.5h2.1c.2 1.7 1.1 3.2 2.5 4.2v2.35c-1.15-.05-2.25-.45-3.2-1.15v5.55c0 3-2.4 5.45-5.4 5.45S4.8 17.45 4.8 14.45 7.2 9 10.2 9c.35 0 .7.04 1.05.1v2.45a3.1 3.1 0 0 0-1.05-.18c-1.7 0-3.05 1.35-3.05 3.05S8.5 17.5 10.2 17.5s3.05-1.35 3.05-3.05V3.5h.95z"
        transform="translate(0.6 0.45)"
      />
      <path
        fill="#FE2C55"
        d="M14.2 3.5h2.1c.2 1.7 1.1 3.2 2.5 4.2v2.35c-1.15-.05-2.25-.45-3.2-1.15v5.55c0 3-2.4 5.45-5.4 5.45S4.8 17.45 4.8 14.45 7.2 9 10.2 9c.35 0 .7.04 1.05.1v2.45a3.1 3.1 0 0 0-1.05-.18c-1.7 0-3.05 1.35-3.05 3.05S8.5 17.5 10.2 17.5s3.05-1.35 3.05-3.05V3.5h.95z"
        transform="translate(-0.55 -0.4)"
      />
      <path
        fill="#fff"
        d="M14.2 3.5h2.1c.2 1.7 1.1 3.2 2.5 4.2v2.35c-1.15-.05-2.25-.45-3.2-1.15v5.55c0 3-2.4 5.45-5.4 5.45S4.8 17.45 4.8 14.45 7.2 9 10.2 9c.35 0 .7.04 1.05.1v2.45a3.1 3.1 0 0 0-1.05-.18c-1.7 0-3.05 1.35-3.05 3.05S8.5 17.5 10.2 17.5s3.05-1.35 3.05-3.05V3.5h.95z"
      />
    </Tile>
  )
}

function PinterestMark({ size, id = 'pinterest' }: { size: Size; id?: string }) {
  return (
    <Tile id={id} bg="#E60023" size={size}>
      <path
        fill="#fff"
        d="M12 3.5c-4.7 0-8.5 3.7-8.5 8.3 0 3.5 2.15 6.5 5.2 7.7-.07-.65-.14-1.65.03-2.36.15-.65 1-4.2 1-4.2s-.25-.5-.25-1.25c0-1.17.68-2.04 1.52-2.04.72 0 1.07.54 1.07 1.18 0 .72-.46 1.8-.7 2.8-.2.84.42 1.52 1.24 1.52 1.49 0 2.5-1.92 2.5-4.2 0-1.73-1.17-3.03-3.3-3.03-2.4 0-3.9 1.78-3.9 3.77 0 .69.2 1.17.52 1.55.15.17.17.3.12.47l-.17.66c-.06.22-.18.27-.4.16-1.12-.46-1.65-1.7-1.65-3.08 0-2.29 1.94-5.04 5.78-5.04 3.1 0 5.14 2.24 5.14 4.65 0 3.18-1.77 5.57-4.39 5.57-.88 0-1.7-.47-1.98-1.01l-.54 2.1c-.2.74-.58 1.48-.93 2.05A8.6 8.6 0 0 0 12 20.3c4.7 0 8.5-3.7 8.5-8.3S16.7 3.5 12 3.5z"
      />
    </Tile>
  )
}

function StripeMark({ size }: { size: Size }) {
  return (
    <Tile id="stripe" bg="#635BFF" size={size}>
      <path
        fill="#fff"
        d="M12.6 9.15c-.7-.28-1.13-.47-1.13-.78 0-.3.28-.5.74-.5.87 0 1.76.34 2.5.9l.7-1.95A6.2 6.2 0 0 0 12.3 5.9c-2.2 0-3.66 1.15-3.66 3.07 0 2.12 2.75 2.66 2.75 4.04 0 .5-.4.66-.96.66-.85 0-1.9-.44-2.74-1.08L7 14.8c.98.58 2.1.96 3.3.96 2.3 0 3.88-1.14 3.88-3.12 0-2.36-2.78-2.76-2.78-4.04.01-.2.14-.45.2-.45z"
      />
    </Tile>
  )
}

const LOGOS: Record<string, (size: Size) => ReactNode> = {
  google: (s) => <GoogleMark size={s} />,
  youtube: (s) => <YoutubeMark size={s} />,
  google_ads: (s) => <GoogleAdsMark size={s} />,
  meta_ads: (s) => <FacebookMark size={s} />,
  tiktok_ads: (s) => <TikTokMark size={s} id="tiktok_ads" />,
  chatgpt_ads: (s) => <ChatGptMark size={s} />,
  reddit_ads: (s) => <RedditMark size={s} />,
  pinterest_ads: (s) => <PinterestMark size={s} id="pinterest_ads" />,
  microsoft_ads: (s) => <MicrosoftMark size={s} />,
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
  linkedin: (s) => <LinkedInMark size={s} />,
  x: (s) => <XMark size={s} />,
  tiktok: (s) => <TikTokMark size={s} />,
  pinterest: (s) => <PinterestMark size={s} />,
  datev: (s) => <BankMark size={s} />,
  lexoffice: (s) => <BankMark size={s} />,
  stripe: (s) => <StripeMark size={s} />,
}

/** Colored brand tile — prefer over generic Phosphor for connection chrome. */
export function ConnBrandLogo({ id, size = 'md' }: { id: string; size?: Size }) {
  const render = LOGOS[id]
  if (render) return <>{render(size)}</>
  return <EnvelopeMark size={size} id={id} bg="#334155" />
}
