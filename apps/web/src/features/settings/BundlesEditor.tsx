/**
 * Create/list permission bundles for Settings → Team.
 * Location: apps/web/src/features/settings/BundlesEditor.tsx
 */
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'

type Bundle = {
  id: string
  name: string
  isSystem: boolean
  permissions: string[]
}

export function BundlesEditor({
  slug,
  bundles,
  onChanged,
}: {
  slug: string
  bundles: Bundle[]
  onChanged: () => void
}) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [catalog, setCatalog] = useState<string[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api<{ permissions: string[] }>(`/api/b/${slug}/permissions/catalog`)
      .then((r) => setCatalog(r.permissions))
      .catch(() => setCatalog([]))
  }, [slug])

  async function createBundle() {
    setBusy(true)
    try {
      await api(`/api/b/${slug}/bundles`, {
        method: 'POST',
        body: JSON.stringify({ name, permissions: selected }),
      })
      setName('')
      setSelected([])
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card stack gap-sm">
      <h3>{t('bundles')}</h3>
      <ul>
        {bundles.map((b) => (
          <li key={b.id}>
            {b.name} ({b.permissions.length}) {b.isSystem ? '· system' : ''}
          </li>
        ))}
      </ul>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('bundleName')} />
      <div className="stack gap-xs" style={{ maxHeight: 200, overflow: 'auto' }}>
        {catalog.map((key) => (
          <label key={key} className="row gap-sm">
            <input
              type="checkbox"
              checked={selected.includes(key)}
              onChange={(e) => {
                setSelected((prev) =>
                  e.target.checked ? [...prev, key] : prev.filter((k) => k !== key),
                )
              }}
            />
            <code>{key}</code>
          </label>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy || !name || selected.length === 0}
        onClick={() => void createBundle()}
      >
        {t('createBundle')}
      </button>
    </div>
  )
}
