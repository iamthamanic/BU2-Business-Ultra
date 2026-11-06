/**
 * SettingsTeamTab — members list, invite, and Tools/SEO grants for editor/viewer.
 * Location: apps/web/src/features/settings/SettingsTeamTab.tsx
 */
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'

type Member = {
  id: string
  userId: string
  email: string
  displayName: string | null
  role: string
  grantSeoOpen?: boolean
  grantToolsUse?: boolean
  grantToolsManage?: boolean
}

type Props = { slug: string; onMembersChanged?: (count: number) => void }

export function SettingsTeamTab({ slug, onMembersChanged }: Props) {
  const { t } = useI18n()
  const [members, setMembers] = useState<Member[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'editor' | 'viewer'>('editor')
  const [inviteToken, setInviteToken] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)

  async function refresh() {
    const r = await api<{ members: Member[] }>(`/api/b/${slug}/members`)
    setMembers(r.members)
    onMembersChanged?.(r.members.length)
    setLoading(false)
  }

  useEffect(() => {
    refresh().catch((e) => {
      setMsg(String(e))
      setLoading(false)
    })
  }, [slug])

  async function invite() {
    if (!email.trim()) return
    try {
      const r = await api<{ acceptToken: string }>(`/api/b/${slug}/invites`, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), role }),
      })
      setInviteToken(r.acceptToken)
      setMsg(t('inviteCreated'))
      setEmail('')
      await refresh()
    } catch (e) {
      setMsg(String(e))
    }
  }

  async function removeMember(userId: string) {
    if (!confirm(t('removeMemberConfirm'))) return
    try {
      await api(`/api/b/${slug}/members/${userId}`, { method: 'DELETE' })
      setMsg(t('memberRemoved'))
      await refresh()
    } catch (e) {
      setMsg(String(e))
    }
  }

  async function setGrant(
    userId: string,
    patch: { grantToolsUse?: boolean; grantToolsManage?: boolean; grantSeoOpen?: boolean },
  ) {
    setBusyUserId(userId)
    setMsg('')
    try {
      await api(`/api/b/${slug}/members/${userId}/grants`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
      await refresh()
    } catch (e) {
      setMsg(String(e))
    } finally {
      setBusyUserId(null)
    }
  }

  if (loading) return <p className="muted">{t('loading')}</p>

  return (
    <section className="panel stack">
      <div className="co-card-head">
        <div>
          <h3 className="co-card-title">{t('team')}</h3>
          <p className="muted co-card-hint">{t('teamHint')}</p>
        </div>
      </div>

      {members.length ? (
        <div className="co-member-list">
          {members.map((m) => {
            const grantsEditable = m.role === 'editor' || m.role === 'viewer'
            const busy = busyUserId === m.userId
            return (
              <div key={m.id} className="co-member-row co-member-row--grants">
                <div className="co-member-main">
                  <span className="co-member-email">
                    {m.displayName ? `${m.displayName} · ${m.email}` : m.email}
                  </span>
                  <span className="badge">{m.role}</span>
                  {m.role !== 'owner' ? (
                    <button className="btn" type="button" onClick={() => removeMember(m.userId)}>
                      {t('remove')}
                    </button>
                  ) : null}
                </div>
                {grantsEditable ? (
                  <div className="co-member-grants" role="group" aria-label={t('memberGrants')}>
                    <label className="co-grant-check">
                      <input
                        type="checkbox"
                        checked={Boolean(m.grantToolsUse) || Boolean(m.grantToolsManage)}
                        disabled={busy || Boolean(m.grantToolsManage)}
                        onChange={(e) =>
                          void setGrant(m.userId, { grantToolsUse: e.target.checked })
                        }
                      />
                      <span>{t('grantToolsUse')}</span>
                    </label>
                    <label className="co-grant-check">
                      <input
                        type="checkbox"
                        checked={Boolean(m.grantToolsManage)}
                        disabled={busy}
                        onChange={(e) =>
                          void setGrant(m.userId, { grantToolsManage: e.target.checked })
                        }
                      />
                      <span>{t('grantToolsManage')}</span>
                    </label>
                    <label className="co-grant-check">
                      <input
                        type="checkbox"
                        checked={Boolean(m.grantSeoOpen)}
                        disabled={busy}
                        onChange={(e) =>
                          void setGrant(m.userId, { grantSeoOpen: e.target.checked })
                        }
                      />
                      <span>{t('grantSeoOpen')}</span>
                    </label>
                  </div>
                ) : (
                  <p className="muted co-member-grants-note">{t('grantsImplicitOwnerAdmin')}</p>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <p className="muted">{t('noMembers')}</p>
      )}

      <div className="co-connect-box stack">
        <div className="co-connect-label">{t('invite')}</div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <input
            className="input"
            style={{ flex: 1, minWidth: 180 }}
            type="email"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <select
            className="input"
            style={{ maxWidth: 140 }}
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
          >
            <option value="admin">admin</option>
            <option value="editor">editor</option>
            <option value="viewer">viewer</option>
          </select>
          <button className="btn primary" type="button" onClick={invite}>
            {t('invite')}
          </button>
        </div>
        {inviteToken ? (
          <p className="kpi muted" style={{ margin: 0 }}>
            {t('acceptToken')}: {inviteToken}
          </p>
        ) : null}
      </div>
      {msg ? <p className="muted">{msg}</p> : null}
    </section>
  )
}
