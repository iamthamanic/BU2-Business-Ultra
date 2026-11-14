/**
 * Team tab — invite members and assign permission bundles.
 * Location: apps/web/src/features/settings/SettingsTeamTab.tsx
 */
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { BundlesEditor } from './BundlesEditor'

type Member = {
  id: string
  userId: string
  email: string
  displayName: string | null
  isOwner: boolean
  status: string
  bundleIds: string[]
}

type Bundle = {
  id: string
  name: string
  isSystem: boolean
  permissions: string[]
}

export function SettingsTeamTab({ slug }: { slug: string }) {
  const { t } = useI18n()
  const [members, setMembers] = useState<Member[]>([])
  const [bundles, setBundles] = useState<Bundle[]>([])
  const [email, setEmail] = useState('')
  const [inviteBundles, setInviteBundles] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [acceptToken, setAcceptToken] = useState('')

  async function reload() {
    const [m, b] = await Promise.all([
      api<{ members: Member[] }>(`/api/b/${slug}/members`),
      api<{ bundles: Bundle[] }>(`/api/b/${slug}/bundles`),
    ])
    setMembers(m.members)
    setBundles(b.bundles)
  }

  useEffect(() => {
    void reload().catch((e) => setMsg(String(e)))
  }, [slug])

  async function invite() {
    setBusy(true)
    setMsg('')
    try {
      const r = await api<{ acceptToken: string }>(`/api/b/${slug}/invites`, {
        method: 'POST',
        body: JSON.stringify({ email, bundleIds: inviteBundles }),
      })
      setAcceptToken(r.acceptToken)
      setEmail('')
      await reload()
      setMsg(t('inviteCreated'))
    } catch (e) {
      setMsg(String(e))
    } finally {
      setBusy(false)
    }
  }

  async function setMemberBundles(userId: string, bundleIds: string[]) {
    setBusy(true)
    try {
      await api(`/api/b/${slug}/members/${userId}/bundles`, {
        method: 'PUT',
        body: JSON.stringify({ userId, bundleIds }),
      })
      await reload()
    } catch (e) {
      setMsg(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack gap-md">
      <h2>{t('team')}</h2>
      {msg ? <p className="muted">{msg}</p> : null}
      {acceptToken ? (
        <p className="muted">
          Token: <code>{acceptToken}</code>
        </p>
      ) : null}

      <div className="stack gap-sm">
        {members.map((m) => (
          <div key={m.id} className="card row" style={{ justifyContent: 'space-between' }}>
            <div>
              <strong>{m.displayName || m.email}</strong>
              <div className="muted">{m.email}</div>
              {m.isOwner ? <span className="badge">{t('owner')}</span> : null}
            </div>
            {!m.isOwner ? (
              <div className="stack gap-xs">
                {bundles.map((b) => {
                  const checked = m.bundleIds.includes(b.id)
                  return (
                    <label key={b.id} className="row gap-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={busy}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...m.bundleIds, b.id]
                            : m.bundleIds.filter((id) => id !== b.id)
                          void setMemberBundles(m.userId, next)
                        }}
                      />
                      <span>{b.name}</span>
                    </label>
                  )
                })}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="card stack gap-sm">
        <h3>{t('invite')}</h3>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
        />
        <div className="stack gap-xs">
          {bundles.map((b) => (
            <label key={b.id} className="row gap-sm">
              <input
                type="checkbox"
                checked={inviteBundles.includes(b.id)}
                onChange={(e) => {
                  setInviteBundles((prev) =>
                    e.target.checked ? [...prev, b.id] : prev.filter((id) => id !== b.id),
                  )
                }}
              />
              <span>{b.name}</span>
            </label>
          ))}
        </div>
        <button type="button" className="btn btn-primary" disabled={busy || !email} onClick={() => void invite()}>
          {t('invite')}
        </button>
      </div>

      <BundlesEditor slug={slug} bundles={bundles} onChanged={() => void reload()} />
    </div>
  )
}
