/**
 * CatalogPage — Katalog SoR UI (products/offers) nested under Product.
 * Route: `/co/:slug/product/katalog`. API remains `/api/b/:slug/catalog`.
 * Location: apps/web/src/features/catalog/CatalogPage.tsx
 */
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'

type Product = {
  id: string
  name: string
  sku?: string | null
  currency: string
  netPriceCents: number
  taxRateBps: number
  active: boolean
}

export function CatalogPage() {
  const { slug } = useParams()
  const { t } = useI18n()
  const [products, setProducts] = useState<Product[]>([])
  const [name, setName] = useState('')
  const [price, setPrice] = useState('0')

  async function refresh() {
    const r = await api<{ products: Product[] }>(`/api/b/${slug}/catalog`)
    setProducts(r.products)
  }

  useEffect(() => { refresh().catch(console.error) }, [slug])

  async function create() {
    await api(`/api/b/${slug}/catalog`, {
      method: 'POST',
      body: JSON.stringify({
        name,
        currency: 'EUR',
        netPriceCents: Math.round(parseFloat(price || '0') * 100),
        taxRateBps: 1900,
        active: true,
      }),
    })
    setName('')
    setPrice('0')
    await refresh()
  }

  async function archive(id: string) {
    await api(`/api/b/${slug}/catalog/${id}`, { method: 'DELETE' })
    await refresh()
  }

  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>{t('catalog')}</h1>
      <p className="muted">Source of truth for products/offers (Catalog SoR).</p>
      <div className="panel stack">
        <div className="grid-2">
          <label><span className="label">{t('name')}</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label><span className="label">Net EUR</span><input className="input" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
        </div>
        <button className="btn primary" onClick={create}>{t('save')}</button>
      </div>
      <div className="panel">
        <table className="table">
          <thead><tr><th>Name</th><th>SKU</th><th>Net</th><th></th></tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.sku ?? '—'}</td>
                <td className="kpi">{(p.netPriceCents / 100).toFixed(2)} {p.currency}</td>
                <td><button className="btn danger" onClick={() => archive(p.id)}>Archive</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
