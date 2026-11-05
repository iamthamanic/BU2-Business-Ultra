/**
 * useNoteComposer — shared add-note state for Kunden / Tasks.
 * Location: apps/web/src/components/notes/useNoteComposer.ts
 */
import { useCallback, useState } from 'react'
import { notePlainText } from './NoteEditor'

type Options = {
  onSubmit: (htmlBody: string) => Promise<void>
}

export function useNoteComposer({ onSubmit }: Options) {
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = notePlainText(body).length > 0 && !busy

  const reset = useCallback(() => {
    setBody('')
    setError(null)
  }, [])

  const submit = useCallback(async () => {
    const plain = notePlainText(body)
    if (!plain || busy) return
    setBusy(true)
    setError(null)
    try {
      await onSubmit(body.trim() || plain)
      setBody('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'error')
    } finally {
      setBusy(false)
    }
  }, [body, busy, onSubmit])

  return { body, setBody, busy, error, canSubmit, submit, reset }
}
