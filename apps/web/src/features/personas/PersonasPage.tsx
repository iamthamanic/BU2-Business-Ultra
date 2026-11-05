/**
 * PersonasPage — Marketing persona library + product-style Customer Journey matrix.
 * Location: apps/web/src/features/personas/PersonasPage.tsx
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Package, Plus, UserFocus } from '@phosphor-icons/react'
import { CustomerJourneyGrid } from '../../components/product/CustomerJourneyGrid'
import { api } from '../../lib/api'
import { companyRoutes } from '../../lib/companyPaths'
import { useI18n } from '../../lib/i18n'
import {
  defaultJourneyMap,
  normalizeJourneyMap,
  type JourneyMap,
} from '../product/customerJourney'
import type { BuProduct } from '../product/productTypes'
import { initials } from '../product/productTypes'
import { PersonaCreateModal } from './PersonaCreateModal'

type Persona = {
  id: string
  name: string
  summary: string | null
  goals: string[] | null
  pains: string[] | null
  channels: string[] | null
  journey: unknown
}

type LinkedProduct = Pick<BuProduct, 'id' | 'name' | 'coverPath' | 'personaIds'>

function journeyFilledCount(journey: unknown): number {
  const map = normalizeJourneyMap(journey)
  return Object.values(map.items).filter((labels) => labels.length > 0).length
}

export function PersonasPage() {
  const { slug = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { t } = useI18n()
  const routes = companyRoutes(slug)
  const [rows, setRows] = useState<Persona[]>([])
  const [products, setProducts] = useState<LinkedProduct[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const deepPersonaId = searchParams.get('persona')

  const selected = useMemo(
    () => rows.find((p) => p.id === selectedId) || null,
    [rows, selectedId],
  )

  const productsByPersona = useMemo(() => {
    const map = new Map<string, LinkedProduct[]>()
    for (const p of products) {
      for (const pid of p.personaIds || []) {
        const list = map.get(pid) || []
        list.push(p)
        map.set(pid, list)
      }
    }
    return map
  }, [products])

  async function refresh() {
    const [personaRes, productRes] = await Promise.all([
      api<{ personas: Persona[] }>(`/api/b/${slug}/personas`),
      api<{ products: BuProduct[] }>(`/api/b/${slug}/products`).catch(() => ({
        products: [] as BuProduct[],
      })),
    ])
    setRows(personaRes.personas)
    setProducts(
      productRes.products.map((p) => ({
        id: p.id,
        name: p.name,
        coverPath: p.coverPath,
        personaIds: p.personaIds || [],
      })),
    )
    return personaRes.personas
  }

  useEffect(() => {
    if (!slug) return
    refresh()
      .then((list) => {
        const want = deepPersonaId || selectedId
        if (want && list.some((p) => p.id === want)) {
          setSelectedId(want)
          return
        }
        if (list[0]) setSelectedId(list[0].id)
      })
      .catch((e) => {
        console.error(e)
        setErr(e instanceof Error ? e.message : t('saveFailed'))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, deepPersonaId])

  function selectPersona(id: string) {
    setSelectedId(id)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('persona', id)
        return next
      },
      { replace: true },
    )
  }

  async function createPersona(body: { name: string; summary?: string }) {
    setBusy(true)
    setErr('')
    try {
      const r = await api<{ persona: Persona }>(`/api/b/${slug}/personas`, {
        method: 'POST',
        body: JSON.stringify({
          name: body.name,
          summary: body.summary,
          goals: [],
          pains: [],
          channels: [],
          journey: defaultJourneyMap(),
        }),
      })
      await refresh()
      if (r.persona?.id) selectPersona(r.persona.id)
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('saveFailed'))
      throw e
    } finally {
      setBusy(false)
    }
  }

  async function saveJourneyMap(map: JourneyMap) {
    if (!selected) return
    setRows((prev) =>
      prev.map((p) => (p.id === selected.id ? { ...p, journey: map } : p)),
    )
    await api(`/api/b/${slug}/personas/${selected.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: selected.name,
        summary: selected.summary,
        goals: selected.goals ?? [],
        pains: selected.pains ?? [],
        channels: selected.channels ?? [],
        journey: map,
      }),
    })
  }

  const linkedForSelected = selected ? productsByPersona.get(selected.id) || [] : []
  const coverForJourney = linkedForSelected[0]?.coverPath || null

  return (
    <div className="stack funnel-page personas-page">
      <header className="product-page-head">
        <div>
          <h1 className="section-title product-page-title">{t('personas')}</h1>
          <p className="muted product-page-lede">{t('personasLede')}</p>
        </div>
        <div className="product-page-actions">
          <span className="personas-count-chip" title={t('personas')}>
            <UserFocus size={14} weight="bold" aria-hidden />
            {rows.length}
          </span>
          <button
            type="button"
            className="btn primary"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={14} weight="bold" aria-hidden />
            {t('personaCreate')}
          </button>
        </div>
      </header>

      {err ? (
        <p className="error" role="alert">
          {err}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <div className="panel product-empty personas-empty">
          <UserFocus size={28} weight="duotone" aria-hidden />
          <p className="muted">{t('productNoPersonas')}</p>
          <p className="muted personas-empty-hint">{t('personaEmptyHint')}</p>
          <button
            type="button"
            className="btn primary"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={14} weight="bold" aria-hidden />
            {t('personaCreate')}
          </button>
        </div>
      ) : (
        <div className="product-card-grid persona-card-grid">
          {rows.map((p) => {
            const linked = productsByPersona.get(p.id) || []
            const filled = journeyFilledCount(p.journey)
            const active = selected?.id === p.id
            return (
              <button
                key={p.id}
                type="button"
                className={`panel product-card persona-card${active ? ' is-active' : ''}`}
                aria-pressed={active}
                onClick={() => selectPersona(p.id)}
              >
                <div className="product-card-top">
                  <span className="product-card-av persona-card-av" aria-hidden>
                    {initials(p.name)}
                  </span>
                  <div className="persona-card-head-text">
                    <strong className="product-card-name">{p.name}</strong>
                    <span className="muted persona-card-fill">
                      {t('personaJourneyFill').replace('{n}', String(filled))}
                    </span>
                  </div>
                </div>
                <p className="muted product-card-desc">
                  {p.summary?.trim() || t('personaNoSummary')}
                </p>
                <div className="persona-card-products">
                  {linked.length === 0 ? (
                    <span className="muted persona-card-products-empty">
                      <Package size={12} weight="bold" aria-hidden />
                      {t('personaNoProducts')}
                    </span>
                  ) : (
                    linked.slice(0, 4).map((prod) => (
                      <span key={prod.id} className="persona-product-chip" title={prod.name}>
                        {prod.coverPath ? (
                          <img src={prod.coverPath} alt="" />
                        ) : (
                          <span className="persona-product-chip-av" aria-hidden>
                            {initials(prod.name)}
                          </span>
                        )}
                        <span className="persona-product-chip-name">{prod.name}</span>
                      </span>
                    ))
                  )}
                  {linked.length > 4 ? (
                    <span className="persona-product-more">+{linked.length - 4}</span>
                  ) : null}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {selected ? (
        <section className="panel personas-journey-panel" aria-label={t('personaJourney')}>
          <header className="personas-journey-head">
            <div>
              <h2 className="crm-section-title" style={{ margin: 0 }}>
                {selected.name}
              </h2>
              <p className="muted personas-journey-sub">{t('personaJourneyHint')}</p>
            </div>
            <Link className="btn" to={routes.product}>
              <Package size={14} weight="bold" aria-hidden />
              {t('personaLinkInProduct')}
            </Link>
          </header>
          <CustomerJourneyGrid
            value={normalizeJourneyMap(selected.journey)}
            onChange={(map) => {
              void saveJourneyMap(map).catch((e) => {
                console.error(e)
                setErr(e instanceof Error ? e.message : t('saveFailed'))
              })
            }}
            productName={selected.name}
            productCover={coverForJourney}
          />
        </section>
      ) : null}

      <PersonaCreateModal
        open={createOpen}
        busy={busy}
        onClose={() => setCreateOpen(false)}
        onSave={createPersona}
      />
    </div>
  )
}
