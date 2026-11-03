/**
 * customerJourney — Legacy-style phase × lane matrix model + presets.
 * Location: apps/web/src/features/product/customerJourney.ts
 */

export type LifecycleStage =
  | 'awareness'
  | 'consideration'
  | 'conversion'
  | 'delivery'
  | 'advocacy'

export type JourneyLaneKey =
  | 'actions'
  | 'touchpoints'
  | 'emotions'
  | 'metrics'
  | 'owners'
  | 'blueprint'
  | 'insights'

export type JourneyLaneGroup = 'Kunde' | 'Messung' | 'Organisation' | 'Optimierung'

export type JourneyPhase = {
  id: string
  title: string
  lifecycle: LifecycleStage
}

/** Cell key: `${phaseId}|${lane}` → chip labels */
export type JourneyMap = {
  phases: JourneyPhase[]
  items: Record<string, string[]>
}

export type LaneMeta = {
  key: JourneyLaneKey
  group: JourneyLaneGroup
  label: string
  tip: string
}

export type LanePreset = {
  id: string
  label: string
  group?: string
  stages?: LifecycleStage[]
}

export const LANE_GROUPS: JourneyLaneGroup[] = ['Kunde', 'Messung', 'Organisation', 'Optimierung']

export const LANE_META: LaneMeta[] = [
  {
    key: 'actions',
    group: 'Kunde',
    label: 'Aktionen & Bedürfnisse',
    tip: 'Was tut die Persona in dieser Phase?',
  },
  {
    key: 'touchpoints',
    group: 'Kunde',
    label: 'Touchpoints / Kanäle',
    tip: 'Wo trifft sie auf uns?',
  },
  {
    key: 'emotions',
    group: 'Kunde',
    label: 'Emotionen & Erfahrung',
    tip: 'Wie fühlt sich die Persona?',
  },
  {
    key: 'metrics',
    group: 'Messung',
    label: 'Messpunkte / KPIs',
    tip: 'Woran erkennen wir Erfolg?',
  },
  {
    key: 'owners',
    group: 'Organisation',
    label: 'Verantwortlich',
    tip: 'Wer intern ist zuständig?',
  },
  {
    key: 'blueprint',
    group: 'Organisation',
    label: 'Interne Prozesse',
    tip: 'Was muss hinter der Bühne passieren?',
  },
  {
    key: 'insights',
    group: 'Optimierung',
    label: 'Pains / Insights / Maßnahmen',
    tip: 'Was hakt? Nächste Schritte?',
  },
]

export const LIFECYCLE_META: Record<
  LifecycleStage,
  { label: string; tip: string }
> = {
  awareness: { label: 'Awareness', tip: 'Bedarf erkennen' },
  consideration: { label: 'Consideration', tip: 'Optionen vergleichen' },
  conversion: { label: 'Conversion', tip: 'Abschluss / Buchung' },
  delivery: { label: 'Delivery', tip: 'Leistung erbringen' },
  advocacy: { label: 'Advocacy', tip: 'Nachsorge / Empfehlung' },
}

const S_AW: LifecycleStage[] = ['awareness']
const S_CO: LifecycleStage[] = ['consideration']
const S_CV: LifecycleStage[] = ['conversion']
const S_DE: LifecycleStage[] = ['delivery']
const S_AD: LifecycleStage[] = ['advocacy']
const S_EARLY: LifecycleStage[] = ['awareness', 'consideration']
const S_MID: LifecycleStage[] = ['consideration', 'conversion']
const S_LATE: LifecycleStage[] = ['delivery', 'advocacy']
const S_ALL: LifecycleStage[] = [
  'awareness',
  'consideration',
  'conversion',
  'delivery',
  'advocacy',
]

export const LANE_PRESETS: Record<JourneyLaneKey, LanePreset[]> = {
  actions: [
    { id: 'act-need', label: 'Bedarf erkennen', stages: S_AW },
    { id: 'act-search', label: 'Suchen / recherchieren', stages: S_EARLY },
    { id: 'act-compare', label: 'Optionen vergleichen', stages: S_CO },
    { id: 'act-ask', label: 'Empfehlung einholen', stages: S_CO },
    { id: 'act-inquire', label: 'Anfrage / Demo / Termin', stages: S_CV },
    { id: 'act-decide', label: 'Entscheiden / kaufen', stages: S_CV },
    { id: 'act-onboard', label: 'Onboarding / einrichten', stages: S_DE },
    { id: 'act-use', label: 'Nutzen / anwenden', stages: S_DE },
    { id: 'act-support', label: 'Support kontaktieren', stages: S_LATE },
    { id: 'act-review', label: 'Bewerten / Feedback geben', stages: S_AD },
    { id: 'act-refer', label: 'Weiterempfehlen', stages: S_AD },
  ],
  touchpoints: [
    { id: 'organic.google', label: 'Organic · Google', stages: S_EARLY },
    { id: 'organic.instagram', label: 'Organic · Instagram', stages: S_EARLY },
    { id: 'organic.linkedin', label: 'Organic · LinkedIn', stages: S_EARLY },
    { id: 'paid.google', label: 'Paid · Google Ads', stages: S_EARLY },
    { id: 'paid.meta', label: 'Paid · Meta Ads', stages: S_EARLY },
    { id: 'tp-web', label: 'Website / Landingpage', stages: S_ALL },
    { id: 'tp-email', label: 'E-Mail', stages: [...S_MID, ...S_AD] },
    { id: 'tp-phone', label: 'Telefon / Hotline', stages: [...S_MID, ...S_DE] },
    { id: 'tp-chat', label: 'Live-Chat / Chatbot', stages: [...S_MID, ...S_LATE] },
    { id: 'tp-field', label: 'Außendienst / Termin', stages: S_MID },
  ],
  emotions: [
    { id: 'emo-joy', label: 'Freude / Begeisterung', stages: S_ALL },
    { id: 'emo-trust', label: 'Vertrauen', stages: S_ALL },
    { id: 'emo-anticipation', label: 'Vorfreude / Erwartung', stages: S_EARLY },
    { id: 'emo-doubt', label: 'Unsicherheit / Zweifel', stages: S_EARLY },
    { id: 'emo-confusion', label: 'Verwirrung', stages: S_MID },
    { id: 'emo-anger', label: 'Frustration / Ärger', stages: S_LATE },
    { id: 'emo-relief', label: 'Erleichterung', stages: S_LATE },
  ],
  metrics: [
    { id: 'reach', label: 'Reichweite / Impressionen', stages: S_AW },
    { id: 'ctr', label: 'CTR / Engagement', stages: S_EARLY },
    { id: 'cvr', label: 'Conversion-Rate', stages: S_CV },
    { id: 'cac', label: 'CAC / CPL', stages: S_CV },
    { id: 'csat', label: 'CSAT', stages: S_LATE },
    { id: 'nps', label: 'NPS', stages: S_AD },
    { id: 'retention', label: 'Retention / Wiederkauf', stages: S_AD },
  ],
  owners: [
    { id: 'own-marketing', label: 'Marketing', stages: S_EARLY },
    { id: 'own-sales', label: 'Sales / Vertrieb', stages: S_MID },
    { id: 'own-cs', label: 'Customer Success', stages: S_LATE },
    { id: 'own-support', label: 'Support / Service', stages: S_LATE },
    { id: 'own-ops', label: 'Operations / Fulfilment', stages: [...S_CV, ...S_DE] },
    { id: 'own-product', label: 'Produkt / Product', stages: S_DE },
  ],
  blueprint: [
    { id: 'bp-crm', label: 'Lead erfassen (CRM)', stages: S_EARLY },
    { id: 'bp-offer', label: 'Angebot / Pricing', stages: S_CV },
    { id: 'bp-billing', label: 'Billing / Zahlung', stages: S_CV },
    { id: 'bp-fulfill', label: 'Fulfilment / Lieferung', stages: S_DE },
    { id: 'bp-onboard', label: 'Onboarding-Workflow', stages: S_DE },
    { id: 'bp-triage', label: 'Ticket-Routing / Triage', stages: S_LATE },
  ],
  insights: [
    { id: 'pain-info', label: 'Info fehlt / unklar', stages: S_EARLY },
    { id: 'pain-price', label: 'Preis / Wert unklar', stages: S_MID },
    { id: 'pain-wait', label: 'Wartezeit zu lang', stages: S_LATE },
    { id: 'fix-simplify', label: 'Prozess vereinfachen', stages: S_CV },
    { id: 'fix-proactive', label: 'Proaktiv kommunizieren', stages: S_LATE },
    { id: 'fix-assign', label: 'Owner klar zuweisen', stages: S_ALL },
  ],
}

export function defaultJourneyMap(): JourneyMap {
  return {
    phases: [
      { id: 'ph_aw', title: 'Bedarf', lifecycle: 'awareness' },
      { id: 'ph_co', title: 'Recherche', lifecycle: 'consideration' },
      { id: 'ph_cv', title: 'Buchung', lifecycle: 'conversion' },
      { id: 'ph_de', title: 'Durchführung', lifecycle: 'delivery' },
      { id: 'ph_ad', title: 'Nachbetreuung', lifecycle: 'advocacy' },
    ],
    items: {},
  }
}

export function cellKey(phaseId: string, lane: JourneyLaneKey): string {
  return `${phaseId}|${lane}`
}

export function getCellLabels(map: JourneyMap, phaseId: string, lane: JourneyLaneKey): string[] {
  return map.items[cellKey(phaseId, lane)] || []
}

export function setCellLabels(
  map: JourneyMap,
  phaseId: string,
  lane: JourneyLaneKey,
  labels: string[],
): JourneyMap {
  const key = cellKey(phaseId, lane)
  const next = { ...map.items }
  const cleaned = labels.map((l) => l.trim()).filter(Boolean)
  if (cleaned.length === 0) delete next[key]
  else next[key] = cleaned
  return { ...map, items: next }
}

export function presetsForLane(
  lane: JourneyLaneKey,
  lifecycle: LifecycleStage,
  selected: string[],
): LanePreset[] {
  const presets = LANE_PRESETS[lane] || []
  const selectedSet = new Set(selected)
  const inStage = presets.filter((p) => !p.stages?.length || p.stages.includes(lifecycle))
  const extras = presets.filter(
    (p) => selectedSet.has(p.label) && !inStage.some((x) => x.id === p.id),
  )
  return [...inStage, ...extras]
}

export function normalizeJourneyMap(raw: unknown): JourneyMap {
  const base = defaultJourneyMap()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Partial<JourneyMap>
  const phases =
    Array.isArray(o.phases) && o.phases.length >= 5
      ? o.phases.map((p, i) => ({
          id: String(p?.id || base.phases[i]!.id),
          title: String(p?.title || base.phases[i]!.title),
          lifecycle: (p?.lifecycle || base.phases[i]!.lifecycle) as LifecycleStage,
        }))
      : base.phases
  const items: Record<string, string[]> = {}
  if (o.items && typeof o.items === 'object') {
    for (const [k, v] of Object.entries(o.items)) {
      if (Array.isArray(v)) items[k] = v.map(String).filter(Boolean)
    }
  }
  return { phases, items }
}
