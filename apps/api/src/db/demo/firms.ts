/**
 * Demo firm definitions — S / M / L depth, all German content.
 * Location: apps/api/src/db/demo/firms.ts
 */

export type DemoDepth = 'S' | 'M' | 'L'

export type DemoFirm = {
  slug: string
  name: string
  depth: DemoDepth
  /** Short industry blurb for notes / drafts. */
  blurb: string
}

export const DEMO_FIRMS: DemoFirm[] = [
  {
    slug: 'wendy-spirit',
    name: 'Wendy Spirit Pferdemädchen',
    depth: 'S',
    blurb: 'Reitunterricht, Pferdepflege und kleine Events rund ums Pferd.',
  },
  {
    slug: 'physiopraxis-hammer',
    name: 'Physiopraxis Hammer',
    depth: 'M',
    blurb: 'Physiotherapie-Praxis mit Kassensitz und Selbstzahlern.',
  },
  {
    slug: 'sagatree-vtt',
    name: 'SagaTree VTT',
    depth: 'L',
    blurb: 'Virtuelles Tabletop und SaaS für Pen-&-Paper-Gruppen.',
  },
]

export const DEMO_MARKER = 'bu2-demo-seed'
