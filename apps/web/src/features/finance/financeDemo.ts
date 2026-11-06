/**
 * Demo fixtures for Finance UI (prototype parity — not live bank data).
 * Location: apps/web/src/features/finance/financeDemo.ts
 */

export type FinanceTx = {
  id: string
  date: string
  name: string
  desc: string
  category: string
  project: string
  status: 'Bezahlt' | 'Überfällig' | 'Geplant'
  kind: 'income' | 'expense'
  source: string
  amount: number
  recurring: boolean
}

export const FINANCE_DEMO_AS_OF = '06.11.2026'

export const financeOverview = {
  freeAvailable: 18420,
  balance: 25920,
  obligations: -4300,
  reserves: -3200,
  liquidityOutlook: 8400,
  reserveProgress: { current: 3200, target: 5000 },
  nextPayment: { when: '09.11. · 1.500 €' },
  openIncoming: 2150,
  revenue: 21480,
  costs: 15140,
  result: 6340,
  revenueDeltaPct: 12.8,
  topCostShare: 'Dienstleistungen',
}

export const financeAlerts = [
  {
    id: 'overdue',
    tone: 'red' as const,
    title: '1 Zahlung ist überfällig',
    detail: '2.150 € · seit 04.11. ausstehend',
    go: 'transactions' as const,
  },
  {
    id: 'software',
    tone: 'warn' as const,
    title: 'Softwarekosten steigen',
    detail: '+24 % gegenüber dem Vergleichszeitraum',
    go: 'analysis' as const,
  },
  {
    id: 'tax',
    tone: 'blue' as const,
    title: 'Steuerrücklage überprüfen',
    detail: '3.200 € manuell reserviert · kein Steuerbescheid',
    go: 'settings' as const,
  },
]

export const financeTransactions: FinanceTx[] = [
  {
    id: '1',
    date: '06.11.2026',
    name: 'Firma Dornhain',
    desc: 'Projektauftrag',
    category: 'Dienstleistung',
    project: 'Dornhain',
    status: 'Bezahlt',
    kind: 'income',
    source: 'Bank-Import',
    amount: 3400,
    recurring: false,
  },
  {
    id: '2',
    date: '05.11.2026',
    name: 'Metricool',
    desc: 'Jahreslizenz',
    category: 'Software & Tools',
    project: 'Marketing',
    status: 'Bezahlt',
    kind: 'expense',
    source: 'Bank-Import',
    amount: -870,
    recurring: true,
  },
  {
    id: '3',
    date: '05.11.2026',
    name: 'Tavern Lab',
    desc: 'Noch offen · Fällig am 04.11.',
    category: 'Dienstleistung',
    project: 'Kunden',
    status: 'Überfällig',
    kind: 'income',
    source: 'Forderung',
    amount: 2150,
    recurring: false,
  },
  {
    id: '4',
    date: '04.11.2026',
    name: 'Kampagnenproduktion',
    desc: 'Video-Produktion',
    category: 'Marketing',
    project: 'Marketing',
    status: 'Bezahlt',
    kind: 'expense',
    source: 'Bank-Import',
    amount: -1450,
    recurring: false,
  },
  {
    id: '5',
    date: '03.11.2026',
    name: 'Studio Nord',
    desc: 'Produktpaket',
    category: 'Umsatz',
    project: 'Produkt',
    status: 'Bezahlt',
    kind: 'income',
    source: 'Bank-Import',
    amount: 5100,
    recurring: false,
  },
  {
    id: '6',
    date: '02.11.2026',
    name: 'CloudHosting',
    desc: 'Hosting · monatlich',
    category: 'Software & Tools',
    project: 'Betrieb',
    status: 'Bezahlt',
    kind: 'expense',
    source: 'Bank-Import',
    amount: -299,
    recurring: true,
  },
  {
    id: '7',
    date: '01.11.2026',
    name: 'Luisa Weber',
    desc: 'Workshop',
    category: 'Umsatz',
    project: 'Training',
    status: 'Bezahlt',
    kind: 'income',
    source: 'Bank-Import',
    amount: 1980,
    recurring: false,
  },
  {
    id: '8',
    date: '09.11.2026',
    name: 'Agenturproduktion',
    desc: 'Geplante Ausgabe',
    category: 'Marketing',
    project: 'Marketing',
    status: 'Geplant',
    kind: 'expense',
    source: 'Planung',
    amount: -1500,
    recurring: false,
  },
  {
    id: '9',
    date: '20.11.2026',
    name: 'Rechenzentrum',
    desc: 'Geplante Ausgabe',
    category: 'Infrastruktur',
    project: 'Betrieb',
    status: 'Geplant',
    kind: 'expense',
    source: 'Planung',
    amount: -2800,
    recurring: false,
  },
]

export const financeRecurring = [
  { name: 'CloudHosting', detail: 'Monatlich · Nächste Zahlung 01.12.', amount: 299 },
  { name: 'Metricool', detail: 'Jährlich · Nächste Zahlung 05.11.2027', amount: 870 },
]

export const financeAnalysis = {
  cost: [9400, 10700, 11520, 12300, 13840, 15140],
  revenue: [14000, 15800, 15400, 17840, 19040, 21480],
  result: [4600, 5100, 3880, 5540, 5200, 6340],
  categories: [
    { name: 'Externe Leistungen', amount: 5600, pct: 81, color: '#3d8bfd' },
    { name: 'Marketing', amount: 3800, pct: 55, color: '#7c9ed7' },
    { name: 'Software & Tools', amount: 2500, pct: 36, color: '#6593a9' },
    { name: 'Sonstiges', amount: 3240, pct: 46, color: '#aab4c8' },
  ],
  marginPct: 29.5,
  topDriverPct: 37,
}

export const financeLiquidityFlows = [
  { date: '09 NOV', title: 'Agenturproduktion', detail: 'Ausgabe · terminiert', amount: -1500 },
  { date: '15 NOV', title: 'Tavern Lab', detail: 'Überfällige Forderung · Eingang unsicher', amount: 2150 },
  { date: '20 NOV', title: 'Rechenzentrum', detail: 'Ausgabe · terminiert', amount: -2800 },
]

export const financeProfitability = {
  customers: [
    ['Firma Dornhain', 8400, 3200],
    ['Studio Nord', 5500, 1800],
    ['Tavern Lab', 4200, 2650],
    ['Andere Kunden', 3380, 2250],
  ] as [string, number, number][],
  products: [
    ['SagaTree Studio', 9300, 4120],
    ['SagaTree Plus', 7400, 3080],
    ['Workshops', 4780, 2700],
  ] as [string, number, number][],
  projects: [
    ['Dornhain Release', 8900, 3650],
    ['Launchkampagne', 6500, 2950],
    ['Produkt-Onboarding', 6080, 3300],
  ] as [string, number, number][],
  directCosts: 9900,
  contribution: 11580,
  breakEven: 16200,
}

export function formatEur(n: number, fraction = 0): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: fraction,
    minimumFractionDigits: fraction,
  }).format(n)
}
