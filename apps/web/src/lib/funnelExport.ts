/**
 * funnelExport — shared Funnel export payload + CSV/JSON/XLS/PDF download helpers.
 * Location: apps/web/src/lib/funnelExport.ts
 */

export type FunnelExportKind = 'Organic' | 'Paid' | 'Custom'

export type FunnelExportPayload = {
  kind: FunnelExportKind
  channel: string
  from: string
  to: string
  filters: { label: string; value: string }[]
  kpis: { label: string; value: string }[]
  columns: { key: string; label: string }[]
  rows: Record<string, string | number | null>[]
}

export type FunnelExportFormat = 'csv' | 'json' | 'xls' | 'pdf'

/** Capitalize channel for filenames: instagram → Instagram, meta_ads → Meta_Ads */
export function capitalizeChannel(channel: string): string {
  return channel
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('_')
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

export function formatIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Map relative window chip → inclusive from/to (local calendar days). */
export function windowToDateRange(
  win: string,
  opts?: { dates?: string[] },
): { from: string; to: string } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const to = formatIsoDate(today)

  if (win === 'all') {
    const dates = (opts?.dates || []).filter((d) => d && d.length >= 10).sort()
    if (dates.length > 0) {
      return { from: dates[0]!.slice(0, 10), to: dates[dates.length - 1]!.slice(0, 10) }
    }
    return { from: 'all', to: 'all' }
  }

  const days =
    win === '24h' ? 1 : win === '7d' ? 7 : win === '30d' ? 30 : win === '90d' ? 90 : 30
  const from = new Date(today)
  from.setDate(from.getDate() - (days - 1))
  return { from: formatIsoDate(from), to }
}

export function buildFunnelFilename(payload: FunnelExportPayload): string {
  const ch = capitalizeChannel(payload.channel || 'channel')
  const from = sanitizePart(payload.from || 'from')
  const to = sanitizePart(payload.to || 'to')
  return `Funnel_${payload.kind}_${ch}_${from}_${to}`
}

function sanitizePart(s: string): string {
  return s.replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'x'
}

function cellStr(v: string | number | null | undefined): string {
  if (v == null) return ''
  return String(v)
}

function downloadBlob(filename: string, mime: string, data: BlobPart) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function metaRows(payload: FunnelExportPayload): string[][] {
  const rows: string[][] = [
    ['Kind', payload.kind],
    ['Channel', capitalizeChannel(payload.channel)],
    ['From', payload.from],
    ['To', payload.to],
    [],
  ]
  if (payload.filters.length) {
    rows.push(['Filters'])
    for (const f of payload.filters) rows.push([f.label, f.value])
    rows.push([])
  }
  if (payload.kpis.length) {
    rows.push(['KPIs'])
    for (const k of payload.kpis) rows.push([k.label, k.value])
    rows.push([])
  }
  return rows
}

function tableHeader(payload: FunnelExportPayload): string[] {
  return payload.columns.map((c) => c.label)
}

function tableBody(payload: FunnelExportPayload): string[][] {
  return payload.rows.map((row) => payload.columns.map((c) => cellStr(row[c.key])))
}

function escapeCsv(v: string): string {
  if (/[;"\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

function toCsv(payload: FunnelExportPayload): string {
  const lines: string[] = []
  for (const r of metaRows(payload)) {
    lines.push(r.map(escapeCsv).join(';'))
  }
  lines.push(tableHeader(payload).map(escapeCsv).join(';'))
  for (const r of tableBody(payload)) {
    lines.push(r.map(escapeCsv).join(';'))
  }
  return `\uFEFF${lines.join('\n')}`
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function toSpreadsheetMl(payload: FunnelExportPayload): string {
  const allRows: string[][] = [...metaRows(payload), tableHeader(payload), ...tableBody(payload)]
  const xmlRows = allRows
    .map((cells) => {
      const tds = cells
        .map((c) => `<Cell><Data ss:Type="String">${escapeXml(c)}</Data></Cell>`)
        .join('')
      return `<Row>${tds}</Row>`
    })
    .join('')
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Funnel">
  <Table>${xmlRows}</Table>
 </Worksheet>
</Workbook>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function toPrintHtml(payload: FunnelExportPayload, title: string): string {
  const meta = metaRows(payload)
    .filter((r) => r.length > 0)
    .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
    .join('')
  const head = tableHeader(payload)
    .map((h) => `<th>${escapeHtml(h)}</th>`)
    .join('')
  const body = tableBody(payload)
    .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
    .join('')
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body{font:12px/1.4 system-ui,sans-serif;color:#111;margin:24px}
  h1{font-size:16px;margin:0 0 12px}
  table{border-collapse:collapse;width:100%;margin:0 0 16px}
  th,td{border:1px solid #ccc;padding:4px 6px;text-align:left;vertical-align:top}
  th{background:#f3f4f6;font-size:11px}
  .meta td{border:0;padding:2px 6px 2px 0}
  @media print{body{margin:8mm}}
</style></head><body>
<h1>${escapeHtml(title)}</h1>
<table class="meta">${meta}</table>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
<script>window.onload=function(){setTimeout(function(){window.print()},50)}</script>
</body></html>`
}

export function exportFunnel(payload: FunnelExportPayload, format: FunnelExportFormat) {
  const base = buildFunnelFilename(payload)
  if (format === 'csv') {
    downloadBlob(`${base}.csv`, 'text/csv;charset=utf-8', toCsv(payload))
    return
  }
  if (format === 'json') {
    downloadBlob(
      `${base}.json`,
      'application/json;charset=utf-8',
      JSON.stringify(payload, null, 2),
    )
    return
  }
  if (format === 'xls') {
    downloadBlob(
      `${base}.xls`,
      'application/vnd.ms-excel;charset=utf-8',
      toSpreadsheetMl(payload),
    )
    return
  }
  // pdf → print-ready HTML (Save as PDF)
  const html = toPrintHtml(payload, base)
  const w = window.open('', '_blank', 'noopener,noreferrer')
  if (!w) {
    downloadBlob(`${base}.html`, 'text/html;charset=utf-8', html)
    return
  }
  w.document.open()
  w.document.write(html)
  w.document.close()
}
