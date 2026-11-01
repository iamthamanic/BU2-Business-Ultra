import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'
import type { AuthUser } from '../../app/App'

export function VerifyPage({ onAuthed }: { onAuthed: (u: AuthUser) => void }) {
  const [params] = useSearchParams()
  const [error, setError] = useState('')

  useEffect(() => {
    const token = params.get('token')
    if (!token) {
      setError('missing token')
      return
    }
    api<{ user: AuthUser }>('/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
      .then((r) => onAuthed(r.user))
      .catch((e) => setError(String(e)))
  }, [params, onAuthed])

  return (
    <div className="login-page">
      <div className="login-card">{error || 'Verifying…'}</div>
    </div>
  )
}
