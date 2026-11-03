/**
 * mktTabIcons — Phosphor glyphs for Marketing chrome tabs (L1/L2/L3/surface).
 * Matches Legacy intent: funnel/persona/route + channel brand marks.
 * Brand/accent colors live in dark-ops.css via MktTab `dataIc` → `[data-ic]` / `--mkt-ic`.
 * Location: apps/web/src/components/mktTabIcons.ts
 */
import type { Icon } from '@phosphor-icons/react'
import {
  BookOpen,
  Browser,
  CurrencyCircleDollar,
  EnvelopeSimple,
  FacebookLogo,
  FileText,
  Funnel,
  Globe,
  GoogleLogo,
  InstagramLogo,
  Leaf,
  LinkedinLogo,
  MagnifyingGlass,
  MetaLogo,
  OpenAiLogo,
  Path,
  SlidersHorizontal,
  Sparkle,
  TiktokLogo,
  WindowsLogo,
  YoutubeLogo,
} from '@phosphor-icons/react'

/** L1: Funnel | Persona Journey | Styleguide */
export const MKT_L1_ICONS = {
  funnel: Funnel,
  personas: Path,
  styleguide: BookOpen,
} as const satisfies Record<string, Icon>

/** L2: Organic | Paid | Custom */
export const MKT_L2_ICONS = {
  organic: Leaf,
  paid: CurrencyCircleDollar,
  custom: SlidersHorizontal,
} as const satisfies Record<string, Icon>

/** L3 organic channels + Website */
export const MKT_ORGANIC_ICONS = {
  instagram: InstagramLogo,
  facebook: FacebookLogo,
  tiktok: TiktokLogo,
  linkedin: LinkedinLogo,
  youtube: YoutubeLogo,
  website: Globe,
} as const satisfies Record<string, Icon>

/** L3 paid providers */
export const MKT_PAID_ICONS = {
  meta: MetaLogo,
  google: GoogleLogo,
  tiktok: TiktokLogo,
  linkedin: LinkedinLogo,
  chatgpt: OpenAiLogo,
  microsoft: WindowsLogo,
} as const satisfies Record<string, Icon>

/** L3 custom channels */
export const MKT_CUSTOM_ICONS = {
  email: EnvelopeSimple,
  offline: FileText,
} as const satisfies Record<string, Icon>

/** Website surface: SEO | GEO */
export const MKT_SURFACE_ICONS = {
  seo: MagnifyingGlass,
  geo: Sparkle,
  website: Browser,
} as const satisfies Record<string, Icon>
