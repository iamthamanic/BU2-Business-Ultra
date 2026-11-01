/**
 * CmbPage — CostMyBusiness models / snapshots UI nested under Product.
 * Route: `/co/:slug/product/costmybusiness`. API remains `/api/b/:slug/cmb`.
 * Location: apps/web/src/features/cmb/CmbPage.tsx
 */
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'

export function CmbPage() {
  const { slug } = useParams()
  const { t } = useI18n()
  const [models, setModels] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [snap, setSnap] = useState<any>(null)

  async function refresh() {
    const [m, tpl] = await Promise.all([
      api<{ models: any[] }>(`/api/b/${slug}/cmb/models`),
      api<{ templates: any[] }>(`/api/b/${slug}/cmb/templates`),
    ])
    setModels(m.models)
    setTemplates(tpl.templates)
  }

  useEffect(() => { refresh().catch(console.error) }, [slug])

  async function createFrom(template?: string) {
    await api(`/api/b/${slug}/cmb/models`, {
      method: 'POST',
      body: JSON.stringify({
        name: template ? `Template ${template}` : 'Simple Product',
        useSimpleFixture: !template || template === 'simple',
        template: template && template !== 'simple' ? template : undefined,
      }),
    })
    await refresh()
  }

  async function calculate(id: string) {
    const r = await api<{ snapshot: any }>(`/api/b/${slug}/cmb/models/${id}/calculate`, {
      method: 'POST',
      body: '{}',
    })
    setSnap(r.snapshot)
  }

  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>{t('cmb')}</h1>
      <p className="muted">Internal net-basis simulation · immutable snapshots · not legal tax advice</p>
      <div className="row">
        {templates.map((tpl) => (
          <button key={tpl.key} className="btn" onClick={() => createFrom(tpl.key)}>{t('templates')}: {tpl.key}</button>
        ))}
      </div>
      <div className="panel">
        <table className="table">
          <thead><tr><th>Name</th><th></th></tr></thead>
          <tbody>
            {models.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td><button className="btn" onClick={() => calculate(m.id)}>{t('calculate')}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {snap && (
        <div className="panel grid-2">
          <div><div className="muted">Revenue</div><div className="kpi">{snap.revenueNet}</div></div>
          <div><div className="muted">Cost</div><div className="kpi">{snap.costNet}</div></div>
          <div><div className="muted">Contribution</div><div className="kpi">{snap.contributionNet}</div></div>
          <div><div className="muted">Volume</div><div className="kpi">{snap.volume}</div></div>
        </div>
      )}
    </div>
  )
}
