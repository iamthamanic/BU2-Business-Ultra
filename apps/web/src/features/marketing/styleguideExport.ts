/**
 * Styleguide PDF export via print-ready HTML (Save as PDF).
 * Location: apps/web/src/features/marketing/styleguideExport.ts
 */
import type { ResolvedStyleguide } from './styleguideDefaults'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function exportStyleguidePdf(opts: {
  brandName: string
  year: number
  doc: ResolvedStyleguide
  labels: {
    title: string
    kicker: string
    company: string
    logo: string
    colors: string
    type: string
    surfaces: string
    rules: string
    dos: string
    donts: string
  }
}) {
  const { brandName, year, doc, labels } = opts
  const colors = doc.colors
    .map(
      (c) => `
      <div class="swatch">
        <div class="chip" style="background:${escapeHtml(c.hex)}"></div>
        <div>
          <strong>${escapeHtml(c.hex.toUpperCase())}</strong>
          <div class="muted">${escapeHtml(c.role)}</div>
          ${c.cmyk ? `<div class="muted">CMYK ${escapeHtml(c.cmyk)}</div>` : ''}
        </div>
      </div>`,
    )
    .join('')

  const dos = doc.dos.map((x) => `<li>${escapeHtml(x)}</li>`).join('')
  const donts = doc.donts.map((x) => `<li>${escapeHtml(x)}</li>`).join('')

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(labels.title)} — ${escapeHtml(brandName)}</title>
<style>
  :root{--ink:#0f172a;--muted:#64748b;--line:#e2e8f0;--paper:#fff;--accent:#3d8bfd;--good:#16a34a;--bad:#dc2626}
  *{box-sizing:border-box}
  body{margin:0;font:13px/1.5 "Geist",system-ui,-apple-system,sans-serif;color:var(--ink);background:#f1f5f9}
  .page{max-width:820px;margin:0 auto;padding:28px 32px 48px;background:var(--paper)}
  .kicker{display:flex;gap:8px;align-items:center;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:8px}
  h1{font-size:32px;letter-spacing:-.03em;margin:0 0 8px}
  .lede{font-size:14px;color:var(--muted);max-width:58ch;margin:0 0 18px}
  .brand{display:flex;align-items:center;gap:12px;padding-top:14px;border-top:1px solid var(--line)}
  .mark{width:40px;height:40px;border-radius:8px;background:#0a0e13;color:#fff;display:grid;place-items:center;font-weight:700;font-size:12px}
  section{margin-top:28px;padding-top:18px;border-top:1px solid var(--line);break-inside:avoid}
  h2{font-size:18px;margin:0 0 4px;letter-spacing:-.02em}
  .sub{margin:0 0 12px;color:var(--muted);font-size:12px}
  .prose p{margin:0 0 8px}
  .swatches{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .swatch{display:flex;gap:10px;align-items:stretch;border:1px solid var(--line);border-radius:8px;overflow:hidden}
  .chip{width:52px;flex-shrink:0}
  .swatch>div{padding:8px 10px}
  .muted{color:var(--muted);font-size:11px}
  .type-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
  .type-card{border:1px solid var(--line);border-radius:8px;padding:12px;min-height:110px}
  .type-card strong{display:block;font-size:20px;margin:6px 0}
  .rules{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .rule{border:1px solid var(--line);border-radius:8px;padding:12px}
  .rule.do{border-color:#bbf7d0;background:#f0fdf4}
  .rule.dont{border-color:#fecaca;background:#fef2f2}
  .rule h3{margin:0 0 8px;font-size:13px}
  .rule.do h3{color:var(--good)}
  .rule.dont h3{color:var(--bad)}
  ul{margin:0;padding-left:1.1em}
  .surfaces{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
  .surface{height:56px;border-radius:8px;border:1px solid var(--line);display:grid;place-items:end start;padding:6px 8px;font-size:10px;color:var(--muted);font-family:ui-monospace,monospace}
  @media print{
    body{background:#fff}
    .page{max-width:none;padding:12mm;box-shadow:none}
    section{break-inside:avoid}
  }
</style></head><body>
<div class="page">
  <div class="kicker"><span>${escapeHtml(labels.kicker)}</span><span>${year}</span></div>
  <h1>${escapeHtml(labels.title)}</h1>
  <p class="lede">${escapeHtml(doc.lede)}</p>
  <div class="brand">
    <div class="mark">${escapeHtml(brandName.slice(0, 2).toUpperCase())}</div>
    <div><strong>${escapeHtml(brandName)}</strong><div class="muted">${escapeHtml(doc.heroMeta)}</div></div>
  </div>

  <section>
    <h2>${escapeHtml(labels.company)}</h2>
    <p class="sub">${escapeHtml(doc.companySub)}</p>
    <div class="prose">
      <p>${escapeHtml(doc.companyBody1)}</p>
      <p class="muted">${escapeHtml(doc.companyBody2)}</p>
    </div>
  </section>

  <section>
    <h2>${escapeHtml(labels.logo)}</h2>
    <p class="sub">${escapeHtml(doc.logoSub)}</p>
    <p>${escapeHtml(doc.logoClearSpace)}</p>
    <p class="muted">${escapeHtml(doc.logoNoteDark)} · ${escapeHtml(doc.logoNoteLight)}</p>
  </section>

  <section>
    <h2>${escapeHtml(labels.colors)}</h2>
    <p class="sub">${escapeHtml(doc.colorsSub)}</p>
    <div class="swatches">${colors}</div>
  </section>

  <section>
    <h2>${escapeHtml(labels.type)}</h2>
    <p class="sub">${escapeHtml(doc.typeSub)}</p>
    <div class="type-grid">
      <div class="type-card"><span class="muted">Display</span><strong>${escapeHtml(doc.typeDisplay)}</strong></div>
      <div class="type-card"><span class="muted">Body</span><strong>${escapeHtml(doc.typeBody)}</strong><div class="muted">${escapeHtml(doc.typeBodySample)}</div></div>
      <div class="type-card"><span class="muted">Mono</span><strong>${escapeHtml(doc.typeMono)}</strong></div>
    </div>
  </section>

  <section>
    <h2>${escapeHtml(labels.surfaces)}</h2>
    <p class="sub">${escapeHtml(doc.surfacesSub)}</p>
    <div class="surfaces">
      <div class="surface" style="background:#0a0e13;color:#94a3b8">--bg</div>
      <div class="surface" style="background:#10161e;color:#94a3b8">--panel</div>
      <div class="surface" style="background:#151c26;color:#94a3b8">--panel2</div>
      <div class="surface" style="background:#151c26;box-shadow:inset 0 0 0 6px #243041">--border</div>
    </div>
  </section>

  <section>
    <h2>${escapeHtml(labels.rules)}</h2>
    <p class="sub">${escapeHtml(doc.rulesSub)}</p>
    <div class="rules">
      <div class="rule do"><h3>${escapeHtml(labels.dos)}</h3><ul>${dos}</ul></div>
      <div class="rule dont"><h3>${escapeHtml(labels.donts)}</h3><ul>${donts}</ul></div>
    </div>
  </section>
</div>
<script>window.onload=function(){setTimeout(function(){window.print()},80)}</script>
</body></html>`

  const w = window.open('', '_blank', 'noopener,noreferrer')
  if (!w) {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `styleguide-${brandName.replace(/\s+/g, '-').toLowerCase()}.html`
    a.click()
    URL.revokeObjectURL(url)
    return
  }
  w.document.open()
  w.document.write(html)
  w.document.close()
}
