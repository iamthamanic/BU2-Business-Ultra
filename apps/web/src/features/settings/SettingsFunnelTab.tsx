/**
 * SettingsFunnelTab — Surface → source matrix (Metricool brand vs Direct API).
 * Location: apps/web/src/features/settings/SettingsFunnelTab.tsx
 */
import { useEffect, useState } from 'react'
import { FUNNEL_SURFACES } from '@bu2/shared'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'

type Binding = {
  surface: string
  provider: string
  status: string
  integrationId: string | null
}

type Integ = { id: string; blogId: string; label: string }

type RowState = {
  surface: string
  provider: string
  integrationId: string
  directReady: boolean
  directProvider: string
}

type Props = { slug: string; onSaved: () => void }

export function SettingsFunnelTab({ slug, onSaved }: Props) {
  const { t } = useI18n()
  const [rows, setRows] = useState<RowState[]>([])
  const [integs, setIntegs] = useState<Integ[]>([])
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api<{ bindings: Binding[]; integrations: Integ[] }>(
      `/api/b/${slug}/settings/funnel-bindings`,
    )
      .then((r) => {
        if (cancelled) return
        const map = Object.fromEntries(r.bindings.map((b) => [b.surface, b]))
        const list = r.integrations ?? []
        setIntegs(list)
        const defaultInteg = list[0]?.id ?? ''
        setRows(
          FUNNEL_SURFACES.map((s) => {
            const directReady = !!s.directReady
            const directProvider = s.directProvider || 'direct'
            const b = map[s.key]
            const provider = b?.provider || (directReady ? directProvider : 'metricool')
            return {
              surface: s.key,
              provider,
              integrationId: b?.integrationId || defaultInteg,
              directReady,
              directProvider,
            }
          }),
        )
        setLoading(false)
      })
      .catch((e) => {
        if (!cancelled) {
          setMsg(String(e))
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  function setProvider(surface: string, provider: string) {
    setRows((prev) => prev.map((r) => (r.surface === surface ? { ...r, provider } : r)))
  }

  function setInteg(surface: string, integrationId: string) {
    setRows((prev) => prev.map((r) => (r.surface === surface ? { ...r, integrationId } : r)))
  }

  function allMetricool() {
    setRows((prev) => prev.map((r) => ({ ...r, provider: 'metricool' })))
  }

  async function save() {
    setMsg(t('saving'))
    try {
      await api(`/api/b/${slug}/settings/funnel-bindings`, {
        method: 'PUT',
        body: JSON.stringify({
          bindings: rows.map((r) => ({
            surface: r.surface,
            provider: r.provider,
            status: 'active',
            integrationId: r.provider === 'metricool' ? r.integrationId || null : null,
          })),
        }),
      })
      setMsg(t('saved'))
      onSaved()
    } catch (e) {
      setMsg(String(e))
    }
  }

  if (loading) return <p className="muted">{t('loading')}</p>

  let lastGroup = ''
  return (
    <section className="panel stack">
      <div className="co-card-head">
        <div>
          <h3 className="co-card-title">{t('funnelAssignment')}</h3>
          <p className="muted co-card-hint">{t('funnelMatrixHint')}</p>
        </div>
      </div>

      <div className="co-funnel-matrix">
        {rows.map((row) => {
          const meta = FUNNEL_SURFACES.find((s) => s.key === row.surface)!
          const showGroup = meta.group !== lastGroup
          lastGroup = meta.group
          return (
            <div key={row.surface}>
              {showGroup ? <div className="co-funnel-group">{meta.group}</div> : null}
              <div className="co-funnel-row">
                <div className="co-funnel-label">{meta.label}</div>
                <div className="co-funnel-source">
                  <label className="co-check">
                    <input
                      type="radio"
                      name={`p-${row.surface}`}
                      checked={row.provider === 'metricool'}
                      onChange={() => setProvider(row.surface, 'metricool')}
                    />{' '}
                    Metricool
                  </label>
                  <label
                    className="co-check"
                    style={row.directReady ? undefined : { opacity: 0.45 }}
                    title={row.directReady ? undefined : t('directNotReady')}
                  >
                    <input
                      type="radio"
                      name={`p-${row.surface}`}
                      checked={row.provider === row.directProvider}
                      disabled={!row.directReady}
                      onChange={() => setProvider(row.surface, row.directProvider)}
                    />{' '}
                    {meta.direct}
                  </label>
                </div>
                <select
                  className="input"
                  disabled={row.provider !== 'metricool'}
                  value={row.integrationId}
                  onChange={(e) => setInteg(row.surface, e.target.value)}
                  aria-label={`Brand ${meta.label}`}
                >
                  {!integs.length ? <option value="">—</option> : null}
                  {integs.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )
        })}
      </div>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button className="btn primary" type="button" onClick={save}>
          {t('save')}
        </button>
        <button className="btn" type="button" onClick={allMetricool}>
          {t('allMetricool')}
        </button>
        {msg ? <span className="muted">{msg}</span> : null}
      </div>
    </section>
  )
}
