/**
 * Realistic DE content packs per demo firm (contacts, products, projects, marketing).
 * Location: apps/api/src/db/demo/firmCatalog.ts
 */
import type { DemoFirm } from './firms.js'

export type CatalogContact = {
  displayName: string
  kind: 'person' | 'org'
  isCustomer: boolean
  isPartner: boolean
  partnerCategory?: string
  email: string
  phone: string
  city: string
  relationStatus: string
  note: string
  tags: string[]
}

export type CatalogProduct = {
  name: string
  description: string
  market: 'b2b' | 'b2c'
  sellingPriceCents: number
  costs: { dept: string; label: string; amountCents: number; note?: string }[]
  persona: {
    name: string
    role: string
    ageGroup: string
    pains: string[]
    jobToBeDone: string
    vocabulary: string
  }
  journeyItems: Record<string, string[]>
}

export type CatalogProject = {
  name: string
  description: string
  tasks: { title: string; description: string; priority: string; status: string; daysDue: number }[]
}

export type CatalogMarketing = {
  drafts: {
    title: string
    masterText: string
    variants: { network: string; text: string }[]
  }[]
  ads: { provider: string; name: string; budgetDailyCents: number; objective: string; status: string }[]
  brevo: { name: string; subject: string; html: string; status: string }[]
}

function journeyPhases() {
  return [
    { id: 'p-aware', title: 'Aufmerksamkeit', lifecycle: 'awareness' as const },
    { id: 'p-consider', title: 'Abwägen', lifecycle: 'consideration' as const },
    { id: 'p-convert', title: 'Kauf', lifecycle: 'conversion' as const },
    { id: 'p-deliver', title: 'Erfüllung', lifecycle: 'delivery' as const },
    { id: 'p-advocate', title: 'Weiterempfehlen', lifecycle: 'advocacy' as const },
  ]
}

export function buildJourneyMap(items: Record<string, string[]>) {
  return { phases: journeyPhases(), items }
}

const WENDY: {
  contacts: CatalogContact[]
  products: CatalogProduct[]
  projects: CatalogProject[]
  marketing: CatalogMarketing
} = {
  contacts: [
    {
      displayName: 'Lisa Reiter',
      kind: 'person',
      isCustomer: true,
      isPartner: false,
      email: 'lisa.reiter@familie-reiter.de',
      phone: '+49 170 4412001',
      city: 'Freising',
      relationStatus: 'active',
      note: 'Stammkundin, Tochter Mia (8) reitet seit 2024. Bevorzugt Samstagvormittag.',
      tags: ['Stammkunde', 'Kind'],
    },
    {
      displayName: 'Hof Stallmeister GmbH',
      kind: 'org',
      isCustomer: false,
      isPartner: true,
      partnerCategory: 'Lieferant',
      email: 'einkauf@hof-stallmeister.de',
      phone: '+49 8161 998877',
      city: 'Moosburg',
      relationStatus: 'active',
      note: 'Liefert Heu und Einstreu. Monatliche Sammelrechnung.',
      tags: ['Lieferant'],
    },
    {
      displayName: 'Tom Berger',
      kind: 'person',
      isCustomer: true,
      isPartner: false,
      email: 'tom.berger@web.de',
      phone: '+49 172 8899001',
      city: 'Erding',
      relationStatus: 'lead',
      note: 'Interessiert an Pony-Geburtstag im April. Noch kein Vertrag.',
      tags: ['Lead', 'Event'],
    },
  ],
  products: [
    {
      name: 'Reitstunde Einzel (45 Min.)',
      description:
        'Individuelle Reitstunde für Anfänger und Fortgeschrittene auf dem Schulpferd. Inklusive Sattelzeug, Helmpflicht, max. 1 Reitschüler:in. Ziel: sicherer Sitz, Hilfengebung und Vertrauen zum Pferd.',
      market: 'b2c',
      sellingPriceCents: 4800,
      costs: [
        { dept: 'operations', label: 'Pferdehaltung anteilig', amountCents: 1200 },
        { dept: 'operations', label: 'Trainer:in Honorar', amountCents: 1800 },
        { dept: 'overhead', label: 'Versicherung / Hof', amountCents: 350 },
        { dept: 'marketing', label: 'Social Ads anteilig', amountCents: 200 },
      ],
      persona: {
        name: 'Elternteil mit reitbegeistertem Kind',
        role: 'Privatkunde · Freizeit',
        ageGroup: '35-44',
        pains: ['Unsichere Trainerwahl', 'Angst vor Verletzung', 'Undurchsichtige Preise'],
        jobToBeDone: 'Kind sicher und mit Freude an den Reitsport heranführen.',
        vocabulary: 'Probestunde, Schulpferd, Helmpflicht, Hallenboden',
      },
      journeyItems: {
        'p-aware|actions': ['Instagram Reels ansehen', 'Freunde fragen'],
        'p-aware|touchpoints': ['Instagram', 'Google Maps'],
        'p-consider|actions': ['Probestunde buchen', 'Hof besichtigen'],
        'p-convert|actions': ['10er-Karte kaufen'],
        'p-deliver|actions': ['Regelmäßig kommen'],
        'p-advocate|actions': ['Empfehlung in Elternchat'],
      },
    },
    {
      name: 'Pony-Geburtstag (2 Std.)',
      description:
        'Kindergeburtstag auf dem Hof: Begrüßungsrunde, Ponyführen, kleines Turnier, Kakao & Kuchen-Platz. Bis 8 Kinder, inkl. Aufsicht durch zwei Betreuer:innen.',
      market: 'b2c',
      sellingPriceCents: 24900,
      costs: [
        { dept: 'operations', label: 'Betreuung 2 Personen', amountCents: 9000 },
        { dept: 'operations', label: 'Material / Preise', amountCents: 2500 },
        { dept: 'sales', label: 'Koordination / Briefing', amountCents: 1500 },
      ],
      persona: {
        name: 'Organisierende Mutter / Vater',
        role: 'Event-Bucher',
        ageGroup: '30-44',
        pains: ['Wetter-Risiko', 'Kindersicherheit', 'Preis-Leistung'],
        jobToBeDone: 'Unvergesslichen, sicheren Geburtstag ohne Stress organisieren.',
        vocabulary: 'Ponyführen, Wetterplan B, Allergien, Fotoerlaubnis',
      },
      journeyItems: {
        'p-aware|touchpoints': ['WhatsApp Empfehlung', 'Website'],
        'p-consider|actions': ['Termin anfragen', 'Paket vergleichen'],
        'p-convert|actions': ['Anzahlung überweisen'],
        'p-deliver|emotions': ['Begeisterung der Kinder'],
        'p-advocate|actions': ['Story markieren'],
      },
    },
  ],
  projects: [
    {
      name: 'Frühjahrs-Turnier Hof Wendy',
      description: 'Kleines Freundschaftsturnier für Schulpferdereiter:innen inkl. Sponsoren und Catering.',
      tasks: [
        {
          title: 'Nennungsformular finalisieren',
          description: 'PDF + Online-Formular, Startgeld 15 €.',
          priority: 'high',
          status: 'open',
          daysDue: -5,
        },
        {
          title: 'Helferplan veröffentlichen',
          description: 'Parcours, Richter, Einlass, Kuchenbuffet.',
          priority: 'medium',
          status: 'in_progress',
          daysDue: -10,
        },
        {
          title: 'Sponsoren Stallmeister ansprechen',
          description: 'Hof Stallmeister für Heu-Sachspende + Banner am Einlass.',
          priority: 'medium',
          status: 'done',
          daysDue: 3,
        },
        {
          title: 'Parcours-Plan skizzieren',
          description: 'Halle A, 8 Hindernisse, Sicherheitsabstände.',
          priority: 'high',
          status: 'open',
          daysDue: -8,
        },
        {
          title: 'Haftungsausschluss Eltern drucken',
          description: '50 Exemplare, Klemmbrett am Einlass.',
          priority: 'low',
          status: 'open',
          daysDue: -12,
        },
      ],
    },
    {
      name: 'Stall-Frühjahrsputz & Safety',
      description: 'Boxen, Paddock, Erste-Hilfe und Brandschutz-Check vor Saisonstart.',
      tasks: [
        {
          title: 'Feuerlöscher prüfen lassen',
          description: 'Termin mit Firma Brandschutz Süd.',
          priority: 'high',
          status: 'open',
          daysDue: -4,
        },
        {
          title: 'Verbandskasten Stall auffüllen',
          description: 'Liste aus letzter Begehung abarbeiten.',
          priority: 'medium',
          status: 'open',
          daysDue: -3,
        },
        {
          title: 'Paddock-Zaun Torseite reparieren',
          description: 'Zwei Pfosten + Litze, Material bei Stallmeister bestellen.',
          priority: 'high',
          status: 'in_progress',
          daysDue: -2,
        },
      ],
    },
  ],
  marketing: {
    drafts: [
      {
        title: 'Probestunde Kampagne',
        masterText:
          'Erster Ritt mit Herzklopfen? 🐴 Probestunde bei Wendy Spirit — sicher, geduldig, auf Schulpferden. Jetzt Termin sichern.',
        variants: [
          {
            network: 'instagram',
            text: 'Probestunde frei 🐴 Schreib uns „RITT“ per DM oder Mail an info@wendy-spirit.example',
          },
          {
            network: 'facebook',
            text: 'Offene Probestunden am Wochenende — ideal für Kids & Wiedereinsteiger:innen.',
          },
          {
            network: 'tiktok',
            text: 'POV: dein Kind reitet zum ersten Mal und strahlt. #Reiten #Pferde',
          },
        ],
      },
      {
        title: 'Turnier Save-the-Date',
        masterText:
          'Frühjahrs-Turnier auf dem Hof: Freundschaftswertung, Kuchenbuffet, Startgeld 15 €. Nennungen ab sofort.',
        variants: [
          {
            network: 'instagram',
            text: 'Save the Date 🏆 Frühjahrs-Turnier — Nennung in Bio / DM.',
          },
          {
            network: 'facebook',
            text: 'Freundschaftsturnier für Schulpferdereiter:innen — Helfer:innen willkommen!',
          },
        ],
      },
    ],
    ads: [
      {
        provider: 'meta_ads',
        name: 'Meta · Probestunde Freising 20km',
        budgetDailyCents: 2500,
        objective: 'leads',
        status: 'active',
      },
    ],
    brevo: [
      {
        name: 'Newsletter März · Turnier',
        subject: 'Save the Date: Frühjahrs-Turnier am Hof',
        html: '<p>Liebe Reiterfamilie, unser Freundschaftsturnier steht an…</p>',
        status: 'draft',
      },
    ],
  },
}

const PHYSIO: typeof WENDY = {
  contacts: [
    {
      displayName: 'Maria Hoffmann',
      kind: 'person',
      isCustomer: true,
      isPartner: false,
      email: 'maria.hoffmann@gmx.de',
      phone: '+49 171 2200345',
      city: 'Augsburg',
      relationStatus: 'active',
      note: 'Kassenpatientin, Rezept KG 6×. Nächster Termin Di 10:00.',
      tags: ['Kasse', 'KG'],
    },
    {
      displayName: 'Dr. med. Jonas Keller',
      kind: 'person',
      isCustomer: false,
      isPartner: true,
      partnerCategory: 'Zuweiser',
      email: 'praxis@keller-orthopaedie.de',
      phone: '+49 821 445566',
      city: 'Augsburg',
      relationStatus: 'active',
      note: 'Orthopäde, regelmäßig Rezept-Zuweisungen.',
      tags: ['Zuweiser'],
    },
    {
      displayName: 'Sportverein SV Lech',
      kind: 'org',
      isCustomer: true,
      isPartner: false,
      email: 'gesundheit@sv-lech.de',
      phone: '+49 821 778899',
      city: 'Neusäß',
      relationStatus: 'active',
      note: 'Kooperationsvertrag Präventionskurs Rückenfit.',
      tags: ['B2B', 'Prävention'],
    },
    {
      displayName: 'Stefan Vogt',
      kind: 'person',
      isCustomer: true,
      isPartner: false,
      email: 'stefan.vogt@outlook.de',
      phone: '+49 176 9988123',
      city: 'Friedberg',
      relationStatus: 'active',
      note: 'Selbstzahler Manuelle Therapie, monatlich.',
      tags: ['Selbstzahler'],
    },
    {
      displayName: 'MedSupply Bayern',
      kind: 'org',
      isCustomer: false,
      isPartner: true,
      partnerCategory: 'Lieferant',
      email: 'order@medsupply-bayern.de',
      phone: '+49 89 1234567',
      city: 'München',
      relationStatus: 'active',
      note: 'Verbrauchsmaterial und Tape.',
      tags: ['Lieferant'],
    },
  ],
  products: [
    {
      name: 'Erstbefund Physiotherapie',
      description:
        'Ausführliche Anamnese, Befundung und Therapiezielvereinbarung (45–60 Min.). Grundlage für Rezeptbehandlung oder Selbstzahlerplan.',
      market: 'b2c',
      sellingPriceCents: 6900,
      costs: [
        { dept: 'operations', label: 'Therapeut:in Zeit', amountCents: 3200 },
        { dept: 'overhead', label: 'Raummiete anteilig', amountCents: 800 },
        { dept: 'support', label: 'Dokumentation / Software', amountCents: 250 },
      ],
      persona: {
        name: 'Schmerzpatient:in mit Rezept',
        role: 'Kassenpatient',
        ageGroup: '45-54',
        pains: ['Wartezeiten', 'Unklare Zuzahlung', 'Therapie ohne Plan'],
        jobToBeDone: 'Schnell schmerzfrei und alltagstauglich werden.',
        vocabulary: 'Rezept, Zuzahlung, Heilmittelkatalog, Hausaufgaben',
      },
      journeyItems: {
        'p-aware|touchpoints': ['Zuweiser', 'Google'],
        'p-consider|actions': ['Termin online', 'Telefon'],
        'p-convert|actions': ['Rezept einlösen'],
        'p-deliver|actions': ['Übungen zu Hause'],
        'p-advocate|actions': ['Arzt empfehlen'],
      },
    },
    {
      name: 'Krankengymnastik Einzel',
      description:
        'Behandlungseinheit nach Heilmittelverordnung. Fokus auf Mobilisation, Kräftigung und Alltagstransfer. Inkl. kurzer Heimübungsplan.',
      market: 'b2c',
      sellingPriceCents: 4200,
      costs: [
        { dept: 'operations', label: 'Therapeut:in', amountCents: 2400 },
        { dept: 'overhead', label: 'Raum / Desinfektion', amountCents: 400 },
      ],
      persona: {
        name: 'Aktive Rückenschmerz-Patient:in',
        role: 'Kasse / Rezept',
        ageGroup: '35-54',
        pains: ['Rückfall nach Pause', 'Zu wenig Erklärung'],
        jobToBeDone: 'Stabil und ohne Angst bewegen.',
        vocabulary: 'KG, Rezeptverlängerung, Trainingsplan',
      },
      journeyItems: {
        'p-aware|actions': ['Arztgespräch'],
        'p-convert|actions': ['Serie buchen'],
        'p-deliver|metrics': ['Schmerzskala', 'ROM'],
      },
    },
    {
      name: 'Präventionskurs Rückenfit (8×)',
      description:
        'Gruppenkurs (max. 8) zur Prävention chronischer Rückenschmerzen. §20-fähig, Teilnahmebescheinigung inklusive.',
      market: 'b2b',
      sellingPriceCents: 18900,
      costs: [
        { dept: 'operations', label: 'Kursleitung 8 Einheiten', amountCents: 7200 },
        { dept: 'marketing', label: 'Flyer / Partner SV Lech', amountCents: 900 },
        { dept: 'sales', label: 'Kassenzulassung Admin', amountCents: 600 },
      ],
      persona: {
        name: 'Betriebs-/Vereinsverantwortliche:r',
        role: 'B2B Einkäufer Gesundheit',
        ageGroup: '30-49',
        pains: ['Nachweis für Kasse', 'Teilnehmerbindung'],
        jobToBeDone: 'Prävention mit messbarer Teilnahme anbieten.',
        vocabulary: '§20, Teilnahmequote, Kurszertifikat',
      },
      journeyItems: {
        'p-aware|touchpoints': ['Verein', 'Arbeitgeber'],
        'p-consider|actions': ['Angebot vergleichen'],
        'p-convert|actions': ['Gruppenanmeldung'],
        'p-advocate|actions': ['Folgekurse'],
      },
    },
  ],
  projects: [
    {
      name: 'Praxis-Website Relaunch',
      description: 'Neue Website mit Online-Termin, Rezept-Upload und Team-Portraits.',
      tasks: [
        {
          title: 'Texte Indikationen final',
          description: 'KG, MT, Lymphdrainage, Prävention.',
          priority: 'high',
          status: 'open',
          daysDue: -4,
        },
        {
          title: 'Termin-Widget testen',
          description: 'Sandbox mit 3 Therapeut:innen.',
          priority: 'high',
          status: 'open',
          daysDue: -7,
        },
        {
          title: 'DSGVO-Hinweis Rezept-Upload',
          description: 'Mit Datenschutzbeauftragtem abstimmen.',
          priority: 'medium',
          status: 'open',
          daysDue: -12,
        },
      ],
    },
    {
      name: 'Kurs Rückenfit Q2',
      description: 'Durchführung und Abrechnung Präventionskurs mit SV Lech.',
      tasks: [
        {
          title: 'Teilnehmerliste exportieren',
          description: 'Für Kassenbescheinigung.',
          priority: 'medium',
          status: 'open',
          daysDue: -2,
        },
        {
          title: 'Raumplan aushängen',
          description: 'Dienstag 18:00 Gruppe A.',
          priority: 'low',
          status: 'done',
          daysDue: 5,
        },
        {
          title: 'Übungsblätter Woche 5–8 drucken',
          description: 'Heimprogramm A4, 20 Stück.',
          priority: 'medium',
          status: 'open',
          daysDue: -6,
        },
        {
          title: 'SV Lech Zwischenbericht senden',
          description: 'Anwesenheit + Drop-out Quote.',
          priority: 'high',
          status: 'in_progress',
          daysDue: -4,
        },
      ],
    },
    {
      name: 'QM & Hygiene Q1',
      description: 'Interne Audits, Gerätewartung, Dokumentenpflege für Praxisbegehung.',
      tasks: [
        {
          title: 'Ultraschallgerät Wartung buchen',
          description: 'Jahrescheck Hersteller.',
          priority: 'high',
          status: 'open',
          daysDue: -9,
        },
        {
          title: 'Desinfektionsprotokoll aktualisieren',
          description: 'Nach neuer RKI-Empfehlung.',
          priority: 'medium',
          status: 'open',
          daysDue: -7,
        },
        {
          title: 'Notfallkoffer kontrollieren',
          description: 'Ablaufdatum Medikamente / Pflaster.',
          priority: 'medium',
          status: 'done',
          daysDue: 2,
        },
      ],
    },
  ],
  marketing: {
    drafts: [
      {
        title: 'Rückenfit Start',
        masterText:
          'Neues Kursangebot: Rückenfit in 8 Wochen — alltagsnah, in kleiner Gruppe, §20-fähig. Jetzt Platz sichern in der Physiopraxis Hammer.',
        variants: [
          {
            network: 'instagram',
            text: 'Rückenfit startet 💪 Kleine Gruppe · klare Übungen · Bescheinigung für die Kasse.',
          },
          {
            network: 'facebook',
            text: 'Präventionskurs Rückenfit — Kooperation mit SV Lech. Anmeldung in der Praxis oder online.',
          },
          {
            network: 'linkedin',
            text: 'B2B: Wir bieten betriebliche Präventionskurse für Teams in der Region Augsburg.',
          },
        ],
      },
      {
        title: 'Team-Vorstellung Therapeutin',
        masterText: 'Neu im Team: Schwerpunkt Manuelle Therapie & Sportphysio. Termine ab sofort.',
        variants: [
          { network: 'instagram', text: 'Welcome im Team 👋 Manuelle Therapie & Sportphysio.' },
          { network: 'facebook', text: 'Neue Kapazitäten für Manuelle Therapie — Terminbuchung geöffnet.' },
        ],
      },
    ],
    ads: [
      {
        provider: 'google_ads',
        name: 'Google · Physiotherapie Augsburg',
        budgetDailyCents: 4500,
        objective: 'leads',
        status: 'active',
      },
      {
        provider: 'meta_ads',
        name: 'Meta · Rückenfit Kurs',
        budgetDailyCents: 3000,
        objective: 'conversions',
        status: 'paused',
      },
    ],
    brevo: [
      {
        name: 'Recall Rezeptende',
        subject: 'Dein Rezept läuft bald ab — Termin sichern',
        html: '<p>Hallo, dein aktuelles Rezept hat noch wenige Einheiten…</p>',
        status: 'draft',
      },
    ],
  },
}

const SAGA: typeof WENDY = {
  contacts: [
    {
      displayName: 'Anna Vogel',
      kind: 'person',
      isCustomer: true,
      isPartner: false,
      email: 'anna.vogel@posteo.de',
      phone: '+49 151 2233445',
      city: 'Berlin',
      relationStatus: 'active',
      note: 'SagaTree Pro, leitet 2 Gruppen. Feature-Wünsche: bessere Lichtsets.',
      tags: ['Pro', 'Power-User'],
    },
    {
      displayName: 'DiceForge Studio',
      kind: 'org',
      isCustomer: true,
      isPartner: true,
      partnerCategory: 'Creator',
      email: 'partners@diceforge.studio',
      phone: '+49 30 8877665',
      city: 'Berlin',
      relationStatus: 'active',
      note: 'Asset-Partner, Revenue-Share 70/30 auf Marketplace.',
      tags: ['Partner', 'Marketplace'],
    },
    {
      displayName: 'Markus Stein',
      kind: 'person',
      isCustomer: true,
      isPartner: false,
      email: 'markus.stein@gmail.com',
      phone: '+49 179 5566778',
      city: 'Hamburg',
      relationStatus: 'active',
      note: 'Studio-Abo Jahreszahlung. Nutzt Whiteboard stark.',
      tags: ['Studio'],
    },
    {
      displayName: 'HexGrid Spiele e.V.',
      kind: 'org',
      isCustomer: true,
      isPartner: false,
      email: 'vorstand@hexgrid-ev.de',
      phone: '+49 40 1122334',
      city: 'Hamburg',
      relationStatus: 'active',
      note: 'Vereinslizenz 12 Tische. Rechnung per Sammelmail.',
      tags: ['Verein', 'B2B'],
    },
    {
      displayName: 'CloudPay EU',
      kind: 'org',
      isCustomer: false,
      isPartner: true,
      partnerCategory: 'Zahlungsanbieter',
      email: 'ops@cloudpay.eu',
      phone: '+49 69 998877',
      city: 'Frankfurt',
      relationStatus: 'active',
      note: 'Payment Provider, Dispute-Rate beobachten.',
      tags: ['Partner', 'Finance'],
    },
    {
      displayName: 'Lea Hoffmann',
      kind: 'person',
      isCustomer: true,
      isPartner: false,
      email: 'lea.hoffmann@icloud.com',
      phone: '+49 160 4455667',
      city: 'Köln',
      relationStatus: 'lead',
      note: 'Trial läuft, Conversion-Call geplant.',
      tags: ['Trial'],
    },
    {
      displayName: 'Nordlicht Publishing',
      kind: 'org',
      isCustomer: false,
      isPartner: true,
      partnerCategory: 'Content',
      email: 'rights@nordlicht-publishing.de',
      phone: '+49 40 556677',
      city: 'Hamburg',
      relationStatus: 'active',
      note: 'Lizenz für offizielle Abenteuer-Module.',
      tags: ['Lizenz'],
    },
    {
      displayName: 'Jonas Petri',
      kind: 'person',
      isCustomer: true,
      isPartner: false,
      email: 'jonas.petri@outlook.com',
      phone: '+49 176 3344556',
      city: 'München',
      relationStatus: 'active',
      note: 'Churn-Risiko — Support-Ticket zu Sync-Bugs.',
      tags: ['Risk'],
    },
  ],
  products: [
    {
      name: 'SagaTree Pro (Monat)',
      description:
        'Cloud-VTT für Spielgruppen: Tokens, Fog of War, Audio, Szenenbibliotheken. Bis 6 Spieler:innen, Community-Support, monatlich kündbar.',
      market: 'b2c',
      sellingPriceCents: 1290,
      costs: [
        { dept: 'operations', label: 'Hosting / CDN', amountCents: 180 },
        { dept: 'support', label: 'Community Support anteilig', amountCents: 120 },
        { dept: 'marketing', label: 'Performance Ads CAC', amountCents: 250 },
        { dept: 'overhead', label: 'Payment Fees', amountCents: 40 },
      ],
      persona: {
        name: 'Hobby-Spielleiter:in',
        role: 'GM · Freizeit',
        ageGroup: '25-34',
        pains: ['Komplexe Tools', 'Spieler springen ab', 'Asset-Chaos'],
        jobToBeDone: 'Schnelle Sessions ohne Tech-Friction hosten.',
        vocabulary: 'Fog of War, Token, Initiative, Scene',
      },
      journeyItems: {
        'p-aware|touchpoints': ['YouTube', 'Reddit', 'Discord'],
        'p-consider|actions': ['14-Tage Trial'],
        'p-convert|actions': ['Abo checkout'],
        'p-deliver|actions': ['Erste Session'],
        'p-advocate|actions': ['Clip teilen'],
      },
    },
    {
      name: 'SagaTree Studio (Jahr)',
      description:
        'Für Creator und Vereine: unbegrenzte Tische, Asset-Upload, Branding, Prioritäts-Support, Jahresrechnung.',
      market: 'b2b',
      sellingPriceCents: 29900,
      costs: [
        { dept: 'operations', label: 'Storage / Compute', amountCents: 4200 },
        { dept: 'support', label: 'Priority Support', amountCents: 3500 },
        { dept: 'sales', label: 'Onboarding Call', amountCents: 1800 },
        { dept: 'marketing', label: 'Partner Co-Marketing', amountCents: 900 },
      ],
      persona: {
        name: 'Vereins- / Creator-Lead',
        role: 'Org Buyer',
        ageGroup: '30-44',
        pains: ['Lizenzmodelle unklar', 'Rechte an Assets', 'Rechnungswesen'],
        jobToBeDone: 'Stabilen digitalen Spieltisch für viele Gruppen betreiben.',
        vocabulary: 'Seat, Branding, SLA, Jahresrechnung',
      },
      journeyItems: {
        'p-aware|touchpoints': ['Partnerseite', 'Convention'],
        'p-consider|actions': ['Demo mit Sales'],
        'p-convert|actions': ['Jahresvertrag'],
        'p-deliver|actions': ['Admin-Onboarding'],
        'p-advocate|actions': ['Case Study'],
      },
    },
    {
      name: 'Asset-Pack Fantasy Commons',
      description:
        'Marketplace-Pack: 120 Tokens, 18 Maps, Lichtpresets. Einmalkauf, kommerzielle Nutzung in SagaTree erlaubt.',
      market: 'b2c',
      sellingPriceCents: 1900,
      costs: [
        { dept: 'operations', label: 'Partner Revenue Share', amountCents: 1140 },
        { dept: 'overhead', label: 'Payment / Store', amountCents: 60 },
      ],
      persona: {
        name: 'Asset-hungriger GM',
        role: 'Add-on Buyer',
        ageGroup: '18-34',
        pains: ['Qualität unequally', 'Lizenzunsicherheit'],
        jobToBeDone: 'Session optisch hochwertig machen ohne selbst zu malen.',
        vocabulary: 'Token, Map Pack, CC0 vs kommerziell',
      },
      journeyItems: {
        'p-aware|touchpoints': ['In-App Store'],
        'p-convert|actions': ['One-click purchase'],
        'p-advocate|actions': ['Review 5 Sterne'],
      },
    },
    {
      name: 'White-Label Club',
      description:
        'Eigenes Branding, Custom Domain, SSO-ready. Für große Vereine und Verlage. Setup-Projekt inklusive.',
      market: 'b2b',
      sellingPriceCents: 890000,
      costs: [
        { dept: 'operations', label: 'Dedicated infra', amountCents: 120000 },
        { dept: 'sales', label: 'Solution Engineering', amountCents: 80000 },
        { dept: 'support', label: 'Customer Success 3 Monate', amountCents: 45000 },
      ],
      persona: {
        name: 'Publisher Ops Lead',
        role: 'Enterprise Buyer',
        ageGroup: '35-54',
        pains: ['Markenkontrolle', 'Compliance', 'Uptime'],
        jobToBeDone: 'Eigene Marke digital bespielen ohne Tool-Flickenteppich.',
        vocabulary: 'SSO, SLA, Custom Domain, DPA',
      },
      journeyItems: {
        'p-aware|touchpoints': ['Sales Outreach'],
        'p-consider|actions': ['Security Review'],
        'p-convert|actions': ['MSA signieren'],
        'p-deliver|actions': ['Go-live Checklist'],
      },
    },
  ],
  projects: [
    {
      name: 'Release SagaTree 2.4',
      description: 'Fog-Performance, Lichtsets v2, Billing-Fixes, Mobile Touch-Polish.',
      tasks: [
        {
          title: 'Changelog DE/EN schreiben',
          description: 'Für In-App Banner und Discord.',
          priority: 'high',
          status: 'open',
          daysDue: -3,
        },
        {
          title: 'QA Lichtsets auf Low-End Laptops',
          description: 'Testmatrix Win/Mac, 3 Geräte.',
          priority: 'high',
          status: 'open',
          daysDue: -5,
        },
        {
          title: 'Stripe Webhook Retry prüfen',
          description: 'Incident #442 nachstellen.',
          priority: 'p0',
          status: 'open',
          daysDue: -1,
        },
        {
          title: 'Partner DiceForge vorab informieren',
          description: 'Breaking change bei Asset-Manifest.',
          priority: 'medium',
          status: 'done',
          daysDue: 4,
        },
      ],
    },
    {
      name: 'Convention Booth Spiel 2026',
      description: 'Messestand, Demo-Stations, Giveaways, Lead-Capture.',
      tasks: [
        {
          title: 'Standdesign freigeben',
          description: 'Banner + Tablet-Wallpaper.',
          priority: 'medium',
          status: 'open',
          daysDue: -14,
        },
        {
          title: 'Demo-Accounts provisionieren',
          description: '10 Tische, Seed-Content Fantasy.',
          priority: 'high',
          status: 'open',
          daysDue: -10,
        },
        {
          title: 'Giveaway-Budget freigeben',
          description: 'Dice Sets + 20 Trial-Codes.',
          priority: 'medium',
          status: 'in_progress',
          daysDue: -11,
        },
        {
          title: 'Lead-Form Metricool ↔ CRM testen',
          description: 'Webhook landet als Kontakt mit Tag Convention.',
          priority: 'high',
          status: 'open',
          daysDue: -9,
        },
      ],
    },
    {
      name: 'Churn Rescue Q1',
      description: 'Risiko-Accounts anrufen, Bugfixes priorisieren.',
      tasks: [
        {
          title: 'Jonas Petri Sync-Bug bestätigen',
          description: 'Logs + Repro an Engineering.',
          priority: 'high',
          status: 'open',
          daysDue: -2,
        },
        {
          title: 'Win-back Mail Sequenz',
          description: 'Brevo: 3 Mails / 14 Tage.',
          priority: 'medium',
          status: 'open',
          daysDue: -8,
        },
        {
          title: 'Anna Vogel Feature-Call Lichtsets',
          description: 'Power-User Feedback für 2.5 Backlog.',
          priority: 'medium',
          status: 'in_progress',
          daysDue: -5,
        },
        {
          title: 'NPS Detractors Liste exportieren',
          description: 'Score ≤6 der letzten 60 Tage.',
          priority: 'low',
          status: 'open',
          daysDue: -7,
        },
      ],
    },
  ],
  marketing: {
    drafts: [
      {
        title: '2.4 Launch Teaser',
        masterText:
          'SagaTree 2.4 kommt: schnellere Fog-Engine, neue Lichtsets, ruhigeres Billing. Warteliste für den Creator-Stream ist offen.',
        variants: [
          {
            network: 'instagram',
            text: '2.4 droppt bald ✨ Fog fühlt sich endlich butterweich an. #VTT #TTRPG',
          },
          {
            network: 'youtube',
            text: 'Trailer Script: Before/After Fog · 3 Lichtsets · CTA Trial',
          },
          {
            network: 'tiktok',
            text: 'POV: deine Spieler sehen endlich den Dungeon richtig.',
          },
          {
            network: 'linkedin',
            text: 'Product note: wir haben Fog-Performance auf Low-End Hardware priorisiert — weil Accessibility auch Hardware ist.',
          },
        ],
      },
      {
        title: 'Partner Spotlight DiceForge',
        masterText:
          'Neues Marketplace-Pack von DiceForge: Fantasy Commons. 120 Tokens, 18 Maps — ready for your next one-shot.',
        variants: [
          { network: 'instagram', text: 'Partner drop: DiceForge Fantasy Commons 🗺️' },
          { network: 'facebook', text: 'Marketplace Highlight — Fantasy Commons jetzt verfügbar.' },
          { network: 'x', text: 'New pack w/ @DiceForge — Fantasy Commons live in SagaTree.' },
        ],
      },
    ],
    ads: [
      {
        provider: 'google_ads',
        name: 'Google · VTT Alternative DE',
        budgetDailyCents: 12000,
        objective: 'conversions',
        status: 'active',
      },
      {
        provider: 'meta_ads',
        name: 'Meta · Trial Retargeting',
        budgetDailyCents: 8000,
        objective: 'conversions',
        status: 'active',
      },
      {
        provider: 'tiktok_ads',
        name: 'TikTok · One-Shot Hook',
        budgetDailyCents: 5000,
        objective: 'traffic',
        status: 'draft',
      },
      {
        provider: 'meta_ads',
        name: 'Meta · 2.4 Trailer Boost',
        budgetDailyCents: 15000,
        objective: 'video_views',
        status: 'paused',
      },
    ],
    brevo: [
      {
        name: 'Trial Day 3 Nudge',
        subject: 'Deine erste Session in 12 Minuten',
        html: '<p>3 Klicks zum fertigen Tisch — Template „One-Shot Forest“ vorausgewählt.</p>',
        status: 'active',
      },
      {
        name: 'Release 2.4 Announcement',
        subject: 'SagaTree 2.4 ist live',
        html: '<p>Fog, Licht, Billing — die Highlights…</p>',
        status: 'draft',
      },
    ],
  },
}

export function catalogFor(firm: DemoFirm) {
  if (firm.slug === 'wendy-spirit') return WENDY
  if (firm.slug === 'physiopraxis-hammer') return PHYSIO
  return SAGA
}

export function productCountForDepth(depth: string, available: number) {
  if (depth === 'S') return Math.min(2, available)
  if (depth === 'M') return Math.min(3, available)
  return available
}

export function contactCountForDepth(depth: string, available: number) {
  if (depth === 'S') return Math.min(3, available)
  if (depth === 'M') return Math.min(6, available)
  return available
}

/** Area-board tasks that make Marketing / Kunden / Produkt look alive. */
export function areaTasksFor(firm: DemoFirm): {
  area: 'marketing' | 'kunden' | 'produkt'
  title: string
  description: string
  priority: 'low' | 'medium' | 'high'
  status: 'open' | 'done'
  daysDue: number
}[] {
  if (firm.slug === 'wendy-spirit') {
    return [
      {
        area: 'marketing',
        title: 'Instagram Reel: Probestunde drehen',
        description: 'Clip mit Mia auf Schulpferd Luna — Caption + Hashtags vorbereiten.',
        priority: 'high',
        status: 'open',
        daysDue: -2,
      },
      {
        area: 'kunden',
        title: 'Lisa Reiter: 10er-Karte verlängern',
        description: 'WhatsApp-Erinnerung + Rechnung vorbereiten.',
        priority: 'medium',
        status: 'open',
        daysDue: -1,
      },
      {
        area: 'produkt',
        title: 'Paket Pony-Geburtstag kalkulieren',
        description: 'Kostenpositionen vs. 249 € Verkaufspreis gegenprüfen.',
        priority: 'medium',
        status: 'open',
        daysDue: -6,
      },
    ]
  }
  if (firm.slug === 'physiopraxis-hammer') {
    return [
      {
        area: 'marketing',
        title: 'Google Ads Suchbegriffe prüfen',
        description: 'Negativ-Keywords: „Massage Studio“, „Wellness“.',
        priority: 'high',
        status: 'open',
        daysDue: -3,
      },
      {
        area: 'kunden',
        title: 'Recall-Liste Rezeptende KW',
        description: '15 Patient:innen mit ≤2 Einheiten anrufen.',
        priority: 'high',
        status: 'open',
        daysDue: -1,
      },
      {
        area: 'kunden',
        title: 'SV Lech Gruppenvertrag pflegen',
        description: 'Teilnehmerliste Rückenfit Q2 abgleichen.',
        priority: 'medium',
        status: 'open',
        daysDue: -5,
      },
      {
        area: 'produkt',
        title: 'Kursbeschreibung Rückenfit aktualisieren',
        description: '§20-Formulierung + Kontraindikationen.',
        priority: 'medium',
        status: 'done',
        daysDue: 4,
      },
    ]
  }
  return [
    {
      area: 'marketing',
      title: '2.4 Trailer Cut freigeben',
      description: 'YouTube + TikTok Varianten, CTA Trial.',
      priority: 'high',
      status: 'open',
      daysDue: -2,
    },
    {
      area: 'marketing',
      title: 'Metricool Kalender KW befüllen',
      description: '3 Posts Launch, 1 Partner Spotlight DiceForge.',
      priority: 'medium',
      status: 'open',
      daysDue: -4,
    },
    {
      area: 'kunden',
      title: 'Churn-Call Jonas Petri',
      description: 'Sync-Bug Status + Goodwill-Monat anbieten.',
      priority: 'high',
      status: 'open',
      daysDue: -1,
    },
    {
      area: 'kunden',
      title: 'HexGrid e.V. White-Label Angebot',
      description: 'MSA-Draft + Domain/SSO Checkliste.',
      priority: 'medium',
      status: 'open',
      daysDue: -8,
    },
    {
      area: 'produkt',
      title: 'Fog-Performance Benchmark dokumentieren',
      description: 'Before/After Zahlen für Changelog.',
      priority: 'high',
      status: 'open',
      daysDue: -3,
    },
    {
      area: 'produkt',
      title: 'Billing Webhook Incident #442 schließen',
      description: 'Retry-Policy + Alerting.',
      priority: 'high',
      status: 'open',
      daysDue: -1,
    },
  ]
}
