/**
 * FunnelExportMenu — ⋯ opens “Exportieren”; click opens modal to pick CSV/JSON/XLS/PDF.
 * Location: apps/web/src/components/FunnelExportMenu.tsx
 */
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DotsThree, X } from '@phosphor-icons/react'
import { useI18n } from '../lib/i18n'
import {
  exportFunnel,
  type FunnelExportFormat,
  type FunnelExportPayload,
} from '../lib/funnelExport'

type Props = {
  getPayload: () => FunnelExportPayload
  className?: string
}

const FORMATS: {
  format: FunnelExportFormat
  labelKey: 'exportFmtCsv' | 'exportFmtJson' | 'exportFmtXls' | 'exportFmtPdf'
}[] = [
  { format: 'csv', labelKey: 'exportFmtCsv' },
  { format: 'json', labelKey: 'exportFmtJson' },
  { format: 'xls', labelKey: 'exportFmtXls' },
  { format: 'pdf', labelKey: 'exportFmtPdf' },
]

export function FunnelExportMenu({ getPayload, className = '' }: Props) {
  const { t } = useI18n()
  const titleId = useId()
  const [menuOpen, setMenuOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [format, setFormat] = useState<FunnelExportFormat>('csv')
  const rootRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  useEffect(() => {
    if (!modalOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setModalOpen(false)
    }
    document.addEventListener('keydown', onKey)
    dialogRef.current?.querySelector<HTMLElement>('button, input')?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [modalOpen])

  function openModal() {
    setMenuOpen(false)
    setFormat('csv')
    setModalOpen(true)
  }

  function confirm() {
    setModalOpen(false)
    exportFunnel(getPayload(), format)
  }

  return (
    <div
      ref={rootRef}
      className={`funnel-export-box ${className}`.trim()}
    >
      <button
        type="button"
        className="funnel-export-btn"
        aria-label={t('exportMenu')}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        title={t('exportMenu')}
        onClick={() => setMenuOpen((v) => !v)}
      >
        <DotsThree size={20} weight="bold" aria-hidden />
      </button>
      {menuOpen ? (
        <div className="funnel-export-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            className="funnel-export-item"
            onClick={openModal}
          >
            {t('exportMenu')}
          </button>
        </div>
      ) : null}

      {modalOpen
        ? createPortal(
            <div
              className="bu-modal-overlay"
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setModalOpen(false)
              }}
            >
              <div
                ref={dialogRef}
                className="bu-modal panel funnel-export-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
              >
                <div className="bu-modal-head">
                  <h2 id={titleId} className="section-title" style={{ margin: 0 }}>
                    {t('exportMenu')}
                  </h2>
                  <button
                    type="button"
                    className="btn icon-btn"
                    onClick={() => setModalOpen(false)}
                    aria-label={t('cancel')}
                  >
                    <X size={16} weight="bold" aria-hidden />
                  </button>
                </div>
                <p className="muted page-lede">{t('exportPickFormat')}</p>
                <div className="funnel-export-formats" role="radiogroup" aria-label={t('exportPickFormat')}>
                  {FORMATS.map((f) => (
                    <label
                      key={f.format}
                      className={`funnel-export-fmt${format === f.format ? ' is-active' : ''}`}
                    >
                      <input
                        type="radio"
                        name="funnel-export-format"
                        value={f.format}
                        checked={format === f.format}
                        onChange={() => setFormat(f.format)}
                      />
                      <span>{t(f.labelKey)}</span>
                    </label>
                  ))}
                </div>
                <div className="bu-modal-actions">
                  <button type="button" className="btn" onClick={() => setModalOpen(false)}>
                    {t('cancel')}
                  </button>
                  <button type="button" className="btn primary" onClick={confirm}>
                    {t('exportConfirm')}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
