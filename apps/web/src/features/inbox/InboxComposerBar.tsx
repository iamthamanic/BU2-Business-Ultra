/**
 * InboxComposerBar — text reply + channel-capability actions (attach / voice).
 * Location: apps/web/src/features/inbox/InboxComposerBar.tsx
 */
import { useEffect, useRef, useState } from 'react'
import { Microphone, Paperclip, PaperPlaneTilt, Stop } from '@phosphor-icons/react'
import type { InboxMessageFormat } from '@bu2/shared'

export type ComposerAttachment = {
  format: 'image' | 'file' | 'audio' | 'voice'
  filename: string
  dataUrl: string
}

type Props = {
  formats: InboxMessageFormat[]
  reply: string
  onReplyChange: (v: string) => void
  placeholder: string
  sending: boolean
  sendLabel: string
  attachLabel: string
  voiceLabel: string
  voiceStopLabel: string
  pendingLabel: string
  onSend: (opts: { body: string; attachment?: ComposerAttachment }) => void
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('read_failed'))
    reader.readAsDataURL(file)
  })
}

function formatForFile(file: File): 'image' | 'file' | 'audio' {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('audio/')) return 'audio'
  return 'file'
}

export function InboxComposerBar({
  formats,
  reply,
  onReplyChange,
  placeholder,
  sending,
  sendLabel,
  attachLabel,
  voiceLabel,
  voiceStopLabel,
  pendingLabel,
  onSend,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [pending, setPending] = useState<ComposerAttachment | null>(null)
  const [recording, setRecording] = useState(false)
  const canAttach =
    formats.includes('image') || formats.includes('file') || formats.includes('audio')
  const canVoice = formats.includes('voice') || formats.includes('audio')
  const accept = [
    formats.includes('image') ? 'image/*' : '',
    formats.includes('audio') ? 'audio/*' : '',
    formats.includes('file') ? '*/*' : '',
  ]
    .filter(Boolean)
    .join(',')

  useEffect(() => {
    return () => {
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function onPickFile(file: File | null) {
    if (!file) return
    const fmt = formatForFile(file)
    if (fmt === 'image' && !formats.includes('image') && !formats.includes('file')) return
    if (fmt === 'audio' && !formats.includes('audio') && !formats.includes('file')) return
    if (fmt === 'file' && !formats.includes('file')) return
    const dataUrl = await readFileAsDataUrl(file)
    setPending({
      format: fmt === 'image' ? 'image' : fmt === 'audio' ? 'audio' : 'file',
      filename: file.name || 'attachment',
      dataUrl,
    })
  }

  async function toggleVoice() {
    if (recording) {
      recorderRef.current?.stop()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? 'audio/ogg;codecs=opus'
          : undefined
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data)
      }
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        setRecording(false)
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        const dataUrl = await readFileAsDataUrl(
          new File([blob], 'voice-memo.webm', { type: blob.type }),
        )
        setPending({
          format: formats.includes('voice') ? 'voice' : 'audio',
          filename: blob.type.includes('ogg') ? 'voice-memo.ogg' : 'voice-memo.webm',
          dataUrl,
        })
      }
      recorderRef.current = rec
      rec.start()
      setRecording(true)
    } catch {
      setRecording(false)
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const body = reply.trim()
    if (!body && !pending) return
    onSend({ body, attachment: pending || undefined })
    setPending(null)
  }

  return (
    <form className="inbox-composer" onSubmit={submit}>
      <div className="inbox-composer-stack">
        {pending ? (
          <div className="inbox-composer-pending">
            <span className="inbox-composer-pending-name">{pending.filename}</span>
            <button
              type="button"
              className="btn ghost inbox-composer-pending-clear"
              onClick={() => setPending(null)}
              aria-label={pendingLabel}
            >
              ×
            </button>
          </div>
        ) : null}
        <textarea
          className="input inbox-composer-input"
          rows={3}
          value={reply}
          onChange={(e) => onReplyChange(e.target.value)}
          placeholder={placeholder}
          required={!pending}
        />
        <div className="inbox-composer-toolbar">
          {canAttach ? (
            <>
              <input
                ref={fileRef}
                type="file"
                className="sr-only"
                accept={accept || undefined}
                onChange={(e) => {
                  void onPickFile(e.target.files?.[0] || null)
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                className="btn icon-btn"
                aria-label={attachLabel}
                title={attachLabel}
                disabled={sending || recording}
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip size={16} weight="bold" aria-hidden />
              </button>
            </>
          ) : null}
          {canVoice ? (
            <button
              type="button"
              className={`btn icon-btn${recording ? ' is-recording' : ''}`}
              aria-label={recording ? voiceStopLabel : voiceLabel}
              title={recording ? voiceStopLabel : voiceLabel}
              disabled={sending}
              onClick={() => void toggleVoice()}
            >
              {recording ? (
                <Stop size={16} weight="fill" aria-hidden />
              ) : (
                <Microphone size={16} weight="bold" aria-hidden />
              )}
            </button>
          ) : null}
          <button
            type="submit"
            className="btn primary"
            disabled={sending || recording || (!reply.trim() && !pending)}
          >
            <PaperPlaneTilt size={14} weight="bold" aria-hidden />
            {sending ? '…' : sendLabel}
          </button>
        </div>
      </div>
    </form>
  )
}
