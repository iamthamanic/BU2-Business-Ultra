/**
 * Styleguide PDF export — full brand-book chapters via jsPDF (.pdf download).
 * Location: apps/web/src/features/marketing/styleguideExport.ts
 */
import { jsPDF } from 'jspdf'
import type { ResolvedStyleguide } from './styleguideDefaults'

export type StyleguidePdfLabels = {
  title: string
  kicker: string
  toc: string
  tocBody: string
  company: string
  logo: string
  colors: string
  type: string
  typeDisplay: string
  typeBody: string
  typeMono: string
  surfaces: string
  icons: string
  rules: string
  dos: string
  donts: string
}

type TocEntry = { pages: string; title: string }

function slugify(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'brand'
  )
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '').trim()
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return [61, 139, 253]
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ]
}

function wrapLines(doc: jsPDF, text: string, maxWidth: number, fontSize: number): string[] {
  doc.setFontSize(fontSize)
  return doc.splitTextToSize(text || '', maxWidth) as string[]
}

async function loadLogoDataUrl(logoPath?: string | null): Promise<string | null> {
  if (!logoPath) return null
  try {
    const url =
      logoPath.startsWith('http') || logoPath.startsWith('data:') || logoPath.startsWith('blob:')
        ? logoPath
        : new URL(logoPath, window.location.origin).href
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || '') || null)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function logoFormat(dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' {
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'JPEG'
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP'
  return 'PNG'
}

export async function exportStyleguidePdf(opts: {
  brandName: string
  year: number
  doc: ResolvedStyleguide
  labels: StyleguidePdfLabels
  logoPath?: string | null
}): Promise<void> {
  const { brandName, year, doc: sg, labels, logoPath } = opts
  const logoData = await loadLogoDataUrl(logoPath)

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 16
  const contentW = pageW - margin * 2
  const footerH = 16
  let y = margin

  const ink: [number, number, number] = [15, 23, 42]
  const muted: [number, number, number] = [100, 116, 139]
  const line: [number, number, number] = [226, 232, 240]
  const accent: [number, number, number] = [61, 139, 253]
  const good: [number, number, number] = [22, 163, 74]
  const bad: [number, number, number] = [220, 38, 38]
  const paper2: [number, number, number] = [248, 250, 252]

  const tocEntries: TocEntry[] = [
    { pages: '02', title: labels.toc },
    { pages: '03', title: labels.company },
    { pages: '04–05', title: labels.logo },
    { pages: '06–07', title: labels.colors },
    { pages: '08–09', title: labels.type },
    { pages: '10', title: labels.surfaces },
    { pages: '11', title: labels.icons },
    { pages: '12', title: labels.rules },
  ]

  function ensureSpace(need: number) {
    if (y + need <= pageH - footerH) return
    pdf.addPage()
    y = margin
  }

  function rule() {
    ensureSpace(6)
    pdf.setDrawColor(...line)
    pdf.setLineWidth(0.25)
    pdf.line(margin, y, pageW - margin, y)
    y += 6
  }

  function sectionHead(num: string, title: string, subtitle?: string) {
    ensureSpace(18)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(...accent)
    pdf.text(num, margin, y + 4)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(14)
    pdf.setTextColor(...ink)
    pdf.text(title, margin + 12, y + 4)
    y += 8
    if (subtitle) {
      const lines = wrapLines(pdf, subtitle, contentW, 9)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.setTextColor(...muted)
      pdf.text(lines, margin, y)
      y += lines.length * 4.2 + 4
    } else {
      y += 2
    }
  }

  function body(text: string, dim = false) {
    const lines = wrapLines(pdf, text, contentW, 10)
    ensureSpace(lines.length * 4.8 + 3)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.setTextColor(...(dim ? muted : ink))
    pdf.text(lines, margin, y)
    y += lines.length * 4.8 + 3
  }

  function drawLogoBox(
    x: number,
    top: number,
    w: number,
    h: number,
    bg: [number, number, number],
    border: [number, number, number],
    caption: string,
    captionColor: [number, number, number],
  ) {
    pdf.setFillColor(...bg)
    pdf.setDrawColor(...border)
    pdf.setLineWidth(0.3)
    pdf.roundedRect(x, top, w, h, 2, 2, 'FD')
    const mark = 18
    const mx = x + (w - mark) / 2
    const my = top + 8
    if (logoData) {
      try {
        pdf.addImage(logoData, logoFormat(logoData), mx, my, mark, mark, undefined, 'FAST')
      } catch {
        drawInitialsMark(mx, my, mark)
      }
    } else {
      drawInitialsMark(mx, my, mark)
    }
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(...captionColor)
    const cap = wrapLines(pdf, caption, w - 6, 7)
    pdf.text(cap, x + w / 2, top + h - 6, { align: 'center' })
  }

  function drawInitialsMark(x: number, top: number, size: number) {
    pdf.setFillColor(10, 14, 19)
    pdf.roundedRect(x, top, size, size, 2, 2, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7)
    pdf.setTextColor(255, 255, 255)
    pdf.text(brandName.slice(0, 2).toUpperCase(), x + size / 2, top + size / 2 + 2.2, {
      align: 'center',
    })
  }

  // ——— Cover ———
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(...muted)
  pdf.text(`${labels.kicker.toUpperCase()}  ·  ${year}`, margin, y)
  y += 10

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(26)
  pdf.setTextColor(...ink)
  pdf.text(labels.title, margin, y)
  y += 10

  const ledeLines = wrapLines(pdf, sg.lede, contentW, 11)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(11)
  pdf.setTextColor(...muted)
  pdf.text(ledeLines, margin, y)
  y += ledeLines.length * 5.2 + 8

  ensureSpace(22)
  if (logoData) {
    try {
      pdf.setFillColor(10, 14, 19)
      pdf.roundedRect(margin, y, 16, 16, 2, 2, 'F')
      pdf.addImage(logoData, logoFormat(logoData), margin + 2, y + 2, 12, 12, undefined, 'FAST')
    } catch {
      drawInitialsMark(margin, y, 16)
    }
  } else {
    drawInitialsMark(margin, y, 16)
  }
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.setTextColor(...ink)
  pdf.text(brandName, margin + 20, y + 6)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(...muted)
  pdf.text(sg.heroMeta, margin + 20, y + 12)
  y += 24

  // ——— 02 TOC ———
  rule()
  sectionHead('02', labels.toc, labels.tocBody)
  for (const entry of tocEntries.slice(1)) {
    ensureSpace(8)
    pdf.setDrawColor(...line)
    pdf.setFillColor(...paper2)
    pdf.roundedRect(margin, y - 3.5, contentW, 8, 1, 1, 'FD')
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(...muted)
    pdf.text(entry.pages, margin + 3, y + 1.2)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(...ink)
    pdf.text(entry.title, margin + 18, y + 1.2)
    y += 10
  }
  y += 2

  // ——— 03 Company ———
  rule()
  sectionHead('03', labels.company, sg.companySub)
  body(sg.companyBody1)
  body(sg.companyBody2, true)

  // ——— 04–05 Logo ———
  rule()
  sectionHead('04–05', labels.logo, sg.logoSub)
  ensureSpace(52)
  const stageW = (contentW - 8) / 3
  const stageH = 42
  const stageY = y
  drawLogoBox(
    margin,
    stageY,
    stageW,
    stageH,
    [7, 10, 14],
    [36, 48, 64],
    sg.logoNoteDark,
    [148, 163, 184],
  )
  drawLogoBox(
    margin + stageW + 4,
    stageY,
    stageW,
    stageH,
    [244, 247, 251],
    [214, 222, 232],
    sg.logoNoteLight,
    [51, 65, 85],
  )
  // Clear-space stage
  {
    const x = margin + (stageW + 4) * 2
    pdf.setFillColor(...paper2)
    pdf.setDrawColor(...line)
    pdf.roundedRect(x, stageY, stageW, stageH, 2, 2, 'FD')
    pdf.setDrawColor(...accent)
    pdf.setLineDashPattern([1.2, 1.2], 0)
    pdf.roundedRect(x + 8, stageY + 6, stageW - 16, 24, 1.5, 1.5, 'S')
    pdf.setLineDashPattern([], 0)
    const mark = 14
    const mx = x + (stageW - mark) / 2
    const my = stageY + 11
    if (logoData) {
      try {
        pdf.addImage(logoData, logoFormat(logoData), mx, my, mark, mark, undefined, 'FAST')
      } catch {
        drawInitialsMark(mx, my, mark)
      }
    } else {
      drawInitialsMark(mx, my, mark)
    }
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(6.5)
    pdf.setTextColor(...muted)
    const cap = wrapLines(pdf, 'Clear Space', stageW - 6, 6.5)
    pdf.text(cap, x + stageW / 2, stageY + stageH - 5, { align: 'center' })
  }
  y = stageY + stageH + 6
  body(sg.logoClearSpace, true)

  // ——— 06–07 Colors ———
  rule()
  sectionHead('06–07', labels.colors, sg.colorsSub)
  const colGap = 4
  const colW = (contentW - colGap) / 2
  const swatchH = 18
  let colX = margin
  let rowStartY = y

  for (let i = 0; i < sg.colors.length; i++) {
    const c = sg.colors[i]!
    if (i > 0 && i % 2 === 0) {
      y = rowStartY + swatchH + 4
      rowStartY = y
      colX = margin
    } else if (i % 2 === 1) {
      colX = margin + colW + colGap
      y = rowStartY
    }

    ensureSpace(swatchH + 6)
    const rgb = hexToRgb(c.hex)
    pdf.setDrawColor(...line)
    pdf.setFillColor(255, 255, 255)
    pdf.roundedRect(colX, y, colW, swatchH, 1.5, 1.5, 'FD')
    pdf.setFillColor(...rgb)
    pdf.rect(colX, y, 11, swatchH, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.setTextColor(...ink)
    pdf.text(c.hex.toUpperCase(), colX + 14, y + 6.5)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(...muted)
    pdf.text(c.role, colX + 14, y + 11.5)
    if (c.cmyk) {
      pdf.setFontSize(7)
      pdf.text(`CMYK ${c.cmyk}`, colX + 14, y + 15.5)
    }

    if (i % 2 === 1 || i === sg.colors.length - 1) {
      y = rowStartY + swatchH + 4
    }
  }
  y += 2

  // ——— 08–09 Type ———
  rule()
  sectionHead('08–09', labels.type, sg.typeSub)
  ensureSpace(40)
  const typeCardW = (contentW - 8) / 3
  const typeH = 34
  const types = [
    { label: labels.typeDisplay, value: sg.typeDisplay, sample: 'Aa Bb Cc 1234567890' },
    { label: labels.typeBody, value: sg.typeBody, sample: sg.typeBodySample },
    { label: labels.typeMono, value: sg.typeMono, sample: 'HEX · CMYK · 0x3D8BFD' },
  ]
  types.forEach((t, i) => {
    const x = margin + i * (typeCardW + 4)
    pdf.setDrawColor(...line)
    pdf.setFillColor(...paper2)
    pdf.roundedRect(x, y, typeCardW, typeH, 1.5, 1.5, 'FD')
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(...muted)
    pdf.text(t.label, x + 3.5, y + 5)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.setTextColor(...ink)
    pdf.text(t.value, x + 3.5, y + 12)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(...muted)
    const sample = wrapLines(pdf, t.sample, typeCardW - 7, 7)
    pdf.text(sample.slice(0, 3), x + 3.5, y + 18)
  })
  y += typeH + 6

  // ——— 10 Surfaces ———
  rule()
  sectionHead('10', labels.surfaces, sg.surfacesSub)
  ensureSpace(24)
  const surfaces: { hex: string; label: string }[] = [
    { hex: '#0a0e13', label: '--bg' },
    { hex: '#10161e', label: '--panel' },
    { hex: '#151c26', label: '--panel2' },
    { hex: '#243041', label: '--border' },
  ]
  const surfW = (contentW - 9) / 4
  surfaces.forEach((s, i) => {
    const x = margin + i * (surfW + 3)
    const rgb = hexToRgb(s.hex)
    pdf.setFillColor(...rgb)
    pdf.setDrawColor(...line)
    pdf.roundedRect(x, y, surfW, 18, 1.5, 1.5, 'FD')
    if (s.label === '--border') {
      pdf.setDrawColor(36, 48, 65)
      pdf.setLineWidth(1.8)
      pdf.roundedRect(x + 3, y + 3, surfW - 6, 12, 1, 1, 'S')
      pdf.setLineWidth(0.25)
    }
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(148, 163, 184)
    pdf.text(s.label, x + 3, y + 15)
  })
  y += 24

  // ——— 11 Icons ———
  rule()
  sectionHead('11', labels.icons, sg.iconsSub)
  ensureSpace(22)
  const iconNames = ['Book', 'Palette', 'Type', 'Grid', 'Image', 'Alert']
  const iconCell = 14
  const iconGap = 4
  iconNames.forEach((name, i) => {
    const x = margin + i * (iconCell + iconGap)
    pdf.setDrawColor(...line)
    pdf.setFillColor(...paper2)
    pdf.roundedRect(x, y, iconCell, iconCell, 2, 2, 'FD')
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(6)
    pdf.setTextColor(...ink)
    pdf.text(String(i + 1), x + iconCell / 2, y + 8.5, { align: 'center' })
    pdf.setTextColor(...muted)
    pdf.setFontSize(5.5)
    pdf.text(name, x + iconCell / 2, y + iconCell + 3.5, { align: 'center' })
  })
  y += iconCell + 10
  body('Icon set: Phosphor Icons · weight regular · 12–22px in UI.', true)

  // ——— 12 Rules ———
  rule()
  sectionHead('12', labels.rules, sg.rulesSub)

  function measureBullets(items: string[], maxW: number): number {
    let h = 10
    for (const item of items) {
      h += wrapLines(pdf, item, maxW, 8).length * 3.8 + 2.5
    }
    return h + 4
  }

  const half = (contentW - 6) / 2
  const doH = measureBullets(sg.dos, half - 10)
  const dontH = measureBullets(sg.donts, half - 10)
  const boxH = Math.max(doH, dontH)
  ensureSpace(boxH + 4)
  const rulesTop = y

  pdf.setFillColor(240, 253, 244)
  pdf.setDrawColor(187, 247, 208)
  pdf.roundedRect(margin, rulesTop, half, boxH, 2, 2, 'FD')
  pdf.setFillColor(254, 242, 242)
  pdf.setDrawColor(254, 202, 202)
  pdf.roundedRect(margin + half + 6, rulesTop, half, boxH, 2, 2, 'FD')

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(...good)
  pdf.text(labels.dos, margin + 4, rulesTop + 6)
  pdf.setTextColor(...bad)
  pdf.text(labels.donts, margin + half + 10, rulesTop + 6)

  let doY = rulesTop + 12
  let dontY = rulesTop + 12
  for (const item of sg.dos) {
    const lines = wrapLines(pdf, item, half - 10, 8)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(...ink)
    pdf.text(lines, margin + 4, doY)
    doY += lines.length * 3.8 + 2.5
  }
  for (const item of sg.donts) {
    const lines = wrapLines(pdf, item, half - 10, 8)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(...ink)
    pdf.text(lines, margin + half + 10, dontY)
    dontY += lines.length * 3.8 + 2.5
  }
  y = rulesTop + boxH + 4

  // Footer
  const pages = pdf.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(...muted)
    pdf.text(`${brandName} — ${labels.title}`, margin, pageH - 8)
    pdf.text(`${p} / ${pages}`, pageW - margin, pageH - 8, { align: 'right' })
    pdf.setDrawColor(...accent)
    pdf.setLineWidth(0.4)
    pdf.line(margin, pageH - 12, pageW - margin, pageH - 12)
  }

  pdf.save(`styleguide-${slugify(brandName)}.pdf`)
}
