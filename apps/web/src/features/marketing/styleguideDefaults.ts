/**
 * Default brand styleguide document + merge helpers.
 * Location: apps/web/src/features/marketing/styleguideDefaults.ts
 */
import type { StyleguideColor, StyleguideDoc } from '@bu2/shared'

export const DEFAULT_COLORS: StyleguideColor[] = [
  { id: 'accent', hex: '#3d8bfd', role: 'Primary / Fokus', cmyk: '76 · 45 · 0 · 0' },
  { id: 'good', hex: '#22c55e', role: 'Aktiv / Erfolg', cmyk: '72 · 0 · 78 · 0' },
  { id: 'warn', hex: '#f59e0b', role: 'Hinweis', cmyk: '0 · 38 · 95 · 0' },
  { id: 'bad', hex: '#ef4444', role: 'Risiko / CTA-Signal', cmyk: '0 · 84 · 70 · 0' },
  { id: 'bg', hex: '#0a0e13', role: 'App-Hintergrund', cmyk: '75 · 55 · 40 · 80' },
  { id: 'panel', hex: '#10161e', role: 'Panel / Karte', cmyk: '72 · 50 · 35 · 72' },
]

export type ResolvedStyleguide = {
  version: 1
  lede: string
  heroMeta: string
  companySub: string
  companyBody1: string
  companyBody2: string
  logoSub: string
  logoClearSpace: string
  logoNoteDark: string
  logoNoteLight: string
  colorsSub: string
  colors: StyleguideColor[]
  typeSub: string
  typeDisplay: string
  typeBody: string
  typeMono: string
  typeBodySample: string
  surfacesSub: string
  iconsSub: string
  rulesSub: string
  dos: string[]
  donts: string[]
}

export function defaultStyleguide(brandName: string, locale: 'de' | 'en' = 'de'): ResolvedStyleguide {
  if (locale === 'en') {
    return {
      version: 1,
      lede: `Visual guardrails for ${brandName} — logo, colors, typography and surfaces in the Business Ultra Dark-Ops look.`,
      heroMeta: 'Primary · Dark-Ops surface',
      companySub: 'About us and our mission',
      companyBody1: `${brandName} stands for clear brand presence and operational excellence across marketing, product and customer work.`,
      companyBody2:
        'This guide keeps teams aligned: one logo language, one color system, one typographic hierarchy.',
      logoSub: 'Symbolism & variations',
      logoClearSpace: 'Clear space: keep at least the logo-mark height free around the mark.',
      logoNoteDark: 'Primary on dark panel',
      logoNoteLight: 'Contrast on light surface',
      colorsSub: 'Colors that carry meaning',
      colors: DEFAULT_COLORS,
      typeSub: 'Print & web',
      typeDisplay: 'Geist',
      typeBody: 'Geist',
      typeMono: 'Geist Mono',
      typeBodySample:
        'Geist carries hierarchy and readability on dark surfaces — generous x-height, calm forms.',
      surfacesSub: 'Backgrounds & elevation',
      iconsSub: 'Phosphor, regular weight, 12–22px',
      rulesSub: 'Absolute no-gos',
      dos: [
        'Use tokens (--accent, --good, --radius-*) consistently',
        'Use MktTabs for every tab strip — one segmented metaphor',
        'Place the logo with clear space and readable contrast',
      ],
      donts: [
        'Distort, recolor, or crowd the logo',
        'Mix pill statuses or foreign design systems',
        'Invent one-off hex values beside the token system',
      ],
    }
  }
  return {
    version: 1,
    lede: `Visuelle Leitplanken für ${brandName} — Logo, Farben, Typografie und Flächen im Business-Ultra Dark-Ops Look.`,
    heroMeta: 'Primärversion · Dark-Ops Oberfläche',
    companySub: 'Über uns und unsere Mission',
    companyBody1: `${brandName} steht für klare Markenführung und operative Exzellenz in Marketing, Produkt und Kundenarbeit.`,
    companyBody2:
      'Dieser Guide hält Teams auf Kurs: eine Logo-Sprache, ein Farbsystem, eine typografische Hierarchie.',
    logoSub: 'Symbolkraft & Variationen',
    logoClearSpace: 'Clear Space: mindestens die Höhe des Logomarks umlaufend freilassen.',
    logoNoteDark: 'Primär auf dunklem Panel',
    logoNoteLight: 'Kontrast auf heller Fläche',
    colorsSub: 'Farben, die Werte vermitteln',
    colors: DEFAULT_COLORS,
    typeSub: 'Print & Web',
    typeDisplay: 'Geist',
    typeBody: 'Geist',
    typeMono: 'Geist Mono',
    typeBodySample:
      'Geist trägt Hierarchie und Lesbarkeit auf dunklen Flächen — großzügige x-Höhe, ruhige Formen.',
    surfacesSub: 'Hintergründe & Elevation',
    iconsSub: 'Phosphor, regular weight, 12–22px',
    rulesSub: 'Ein absolutes No-Go vermeiden',
    dos: [
      'Tokens (--accent, --good, --radius-*) konsequent nutzen',
      'MktTabs für alle Tableisten — eine Segment-Metapher',
      'Logo mit Clear Space und lesbarem Kontrast platzieren',
    ],
    donts: [
      'Logo verzerren, einfärben oder Clear Space brechen',
      'Pill-Status oder fremde Design-Systeme mischen',
      'Einmalige Hex-Werte neben dem Token-System erfinden',
    ],
  }
}

function pickStr(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim() ? v : fallback
}

function pickArr(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return fallback
  const clean = v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
  return clean.length ? clean : fallback
}

function pickColors(v: unknown, fallback: StyleguideColor[]): StyleguideColor[] {
  if (!Array.isArray(v) || v.length === 0) return fallback
  const out: StyleguideColor[] = []
  for (const item of v) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const hex = typeof o.hex === 'string' ? o.hex : ''
    if (!/^#[0-9a-fA-F]{3,8}$/.test(hex)) continue
    out.push({
      id: typeof o.id === 'string' && o.id ? o.id : `c${out.length + 1}`,
      hex: hex.toLowerCase(),
      role: typeof o.role === 'string' && o.role ? o.role : 'Color',
      cmyk: typeof o.cmyk === 'string' ? o.cmyk : null,
    })
  }
  return out.length ? out : fallback
}

/** Merge saved doc with locale defaults (empty fields fall back). */
export function resolveStyleguide(
  raw: StyleguideDoc | Record<string, unknown> | null | undefined,
  brandName: string,
  locale: 'de' | 'en' = 'de',
): ResolvedStyleguide {
  const d = defaultStyleguide(brandName, locale)
  if (!raw || typeof raw !== 'object') return d
  const r = raw as Record<string, unknown>
  return {
    version: 1,
    lede: pickStr(r.lede, d.lede),
    heroMeta: pickStr(r.heroMeta, d.heroMeta),
    companySub: pickStr(r.companySub, d.companySub),
    companyBody1: pickStr(r.companyBody1, d.companyBody1),
    companyBody2: pickStr(r.companyBody2, d.companyBody2),
    logoSub: pickStr(r.logoSub, d.logoSub),
    logoClearSpace: pickStr(r.logoClearSpace, d.logoClearSpace),
    logoNoteDark: pickStr(r.logoNoteDark, d.logoNoteDark),
    logoNoteLight: pickStr(r.logoNoteLight, d.logoNoteLight),
    colorsSub: pickStr(r.colorsSub, d.colorsSub),
    colors: pickColors(r.colors, d.colors),
    typeSub: pickStr(r.typeSub, d.typeSub),
    typeDisplay: pickStr(r.typeDisplay, d.typeDisplay),
    typeBody: pickStr(r.typeBody, d.typeBody),
    typeMono: pickStr(r.typeMono, d.typeMono),
    typeBodySample: pickStr(r.typeBodySample, d.typeBodySample),
    surfacesSub: pickStr(r.surfacesSub, d.surfacesSub),
    iconsSub: pickStr(r.iconsSub, d.iconsSub),
    rulesSub: pickStr(r.rulesSub, d.rulesSub),
    dos: pickArr(r.dos, d.dos),
    donts: pickArr(r.donts, d.donts),
  }
}

export function toStyleguidePayload(doc: ResolvedStyleguide): StyleguideDoc {
  return {
    version: 1,
    lede: doc.lede,
    heroMeta: doc.heroMeta,
    companySub: doc.companySub,
    companyBody1: doc.companyBody1,
    companyBody2: doc.companyBody2,
    logoSub: doc.logoSub,
    logoClearSpace: doc.logoClearSpace,
    logoNoteDark: doc.logoNoteDark,
    logoNoteLight: doc.logoNoteLight,
    colorsSub: doc.colorsSub,
    colors: doc.colors,
    typeSub: doc.typeSub,
    typeDisplay: doc.typeDisplay,
    typeBody: doc.typeBody,
    typeMono: doc.typeMono,
    typeBodySample: doc.typeBodySample,
    surfacesSub: doc.surfacesSub,
    iconsSub: doc.iconsSub,
    rulesSub: doc.rulesSub,
    dos: doc.dos,
    donts: doc.donts,
  }
}
