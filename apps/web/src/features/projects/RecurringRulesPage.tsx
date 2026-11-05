/**
 * RecurringRulesPage — recurrence rules + tick.
 * Location: apps/web/src/features/projects/RecurringRulesPage.tsx
 */
import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Plus } from '@phosphor-icons/react'
import { CrmEmptyPreview } from '../../components/CrmEmptyPreview'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import type { ProjectsOutletContext } from './ProjectsShell'
import { ProjectsScopeToggle } from './ProjectsScopeToggle'
import type { BuRecurrenceRule } from './projectTypes'

export function RecurringRulesPage() {
  const ctx = useOutletContext<ProjectsOutletContext>()
  const slug = ctx?.slug || ''
  const canWrite = ctx?.canWrite ?? false
  const { t } = useI18n()
  const [rules, setRules] = useState<BuRecurrenceRule[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [freq, setFreq] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [projectId, setProjectId] = useState('')
  const [tickMsg, setTickMsg] = useState('')
  const [formOpen, setFormOpen] = useState(false)

  async function refresh() {
    if (!slug) return
    setLoading(true)
    try {
      const r = await api<{ rules: BuRecurrenceRule[]; tick?: { created: number } }>(
        `/api/b/${slug}/recurrence`,
      )
      setRules(r.rules)
      if (r.tick && r.tick.created > 0) {
        setTickMsg(t('recurrenceTickCreated').replace('{n}', String(r.tick.created)))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh().catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const empty = rules.length === 0

  return (
    <div className="stack mkt-shell product-shell crm-shell">
      <header className="product-page-head">
        <div>
          <h1 className="section-title product-page-title" style={{ marginTop: 0 }}>
            {t('projectsRecurring')}
          </h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            {t('projectsRecurringLede')}
          </p>
          <div style={{ marginTop: 10 }}>
            <ProjectsScopeToggle slug={slug} active="recurring" />
          </div>
        </div>
        <div className="product-page-actions">
          {canWrite ? (
            <>
              <button
                type="button"
                className="btn"
                onClick={async () => {
                  const r = await api<{ created: number }>(`/api/b/${slug}/recurrence/tick`, {
                    method: 'POST',
                  })
                  setTickMsg(t('recurrenceTickCreated').replace('{n}', String(r.created ?? 0)))
                  await refresh()
                }}
              >
                {t('recurrenceTick')}
              </button>
              <button type="button" className="btn primary" onClick={() => setFormOpen(true)}>
                <Plus size={14} weight="bold" aria-hidden />
                {t('recurrenceCreate')}
              </button>
            </>
          ) : null}
        </div>
      </header>

      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
        {t('recurrenceDevHint')}
      </p>
      {tickMsg ? <p className="chip">{tickMsg}</p> : null}

      {empty ? (
        <CrmEmptyPreview
          canWrite={canWrite && !loading}
          ctaLabel={t('recurrenceCreate')}
          hint={t('recurrenceEmpty')}
          onCta={() => setFormOpen(true)}
        />
      ) : (
        <div className="panel funnel-table-wrap">
          <table className="table funnel-grid-table product-table">
            <thead>
              <tr>
                <th>{t('name')}</th>
                <th>{t('recurrenceFreq')}</th>
                <th>{t('recurrenceNext')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="product-table-row">
                  <td>
                    <strong>{rule.title}</strong>
                    {rule.pausedAt ? (
                      <span className="muted"> · {t('recurrencePaused')}</span>
                    ) : null}
                  </td>
                  <td className="muted">{rule.freq}</td>
                  <td className="muted">{new Date(rule.nextAt).toLocaleString()}</td>
                  <td>
                    {canWrite ? (
                      <button
                        type="button"
                        className="btn"
                        onClick={async () => {
                          await api(`/api/b/${slug}/recurrence/${rule.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ paused: !rule.pausedAt }),
                          })
                          await refresh()
                        }}
                      >
                        {rule.pausedAt ? t('recurrenceResume') : t('recurrencePause')}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen ? (
        <div className="bu-modal-overlay" role="dialog" aria-modal="true">
          <form
            className="bu-modal panel crm-modal"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!title.trim()) return
              await api(`/api/b/${slug}/recurrence`, {
                method: 'POST',
                body: JSON.stringify({
                  title: title.trim(),
                  freq,
                  projectId: projectId || null,
                  startsAt: new Date().toISOString(),
                }),
              })
              setTitle('')
              setFormOpen(false)
              await refresh()
            }}
          >
            <header className="bu-modal-head">
              <h2 className="section-title" style={{ margin: 0, fontSize: '1.1rem' }}>
                {t('recurrenceCreate')}
              </h2>
              <button type="button" className="btn" onClick={() => setFormOpen(false)}>
                {t('cancel')}
              </button>
            </header>
            <div className="crm-modal-body stack">
              <label className="field">
                <span className="label">{t('taskTitle')}</span>
                <input
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                />
              </label>
              <label className="field">
                <span className="label">{t('recurrenceFreq')}</span>
                <select
                  className="input"
                  value={freq}
                  onChange={(e) => setFreq(e.target.value as typeof freq)}
                >
                  <option value="daily">daily</option>
                  <option value="weekly">weekly</option>
                  <option value="monthly">monthly</option>
                </select>
              </label>
              <label className="field">
                <span className="label">{t('projects')}</span>
                <select
                  className="input"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  <option value="">—</option>
                  {(ctx.projects || []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <footer className="bu-modal-actions">
              <button type="button" className="btn" onClick={() => setFormOpen(false)}>
                {t('cancel')}
              </button>
              <button type="submit" className="btn primary">
                {t('save')}
              </button>
            </footer>
          </form>
        </div>
      ) : null}
    </div>
  )
}
