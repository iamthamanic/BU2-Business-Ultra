/**
 * FunnelExportMenu — 3-dot box + dropdown to download funnel table (CSV/JSON/XLS/PDF).
 * Location: apps/web/src/components/FunnelExportMenu.tsx
 */
import { useEffect, useRef, useState } from 'react'
import { DotsThree } from '@phosphor-icons/react'
import { useI18n } from '../lib/i18n'
import {
  exportFunnel,
  type FunnelExportFormat,
  type FunnelExportPayload,
} from '../lib/funnelExport'

type Props = {
  /** Lazy so we only build rows when the user picks a format. */
  getPayload: () => FunnelExportPayload
  className?: string
}

const FORMATS: { format: FunnelExportFormat; labelKey: 'exportCsv' | 'exportJson' | 'exportXls' | 'exportPdf' }[] =
  [
    { format: 'csv', labelKey: 'exportCsv' },
    { format: 'json', labelKey: 'exportJson' },
    { format: 'xls', labelKey: 'exportXls' },
    { format: 'pdf', labelKey: 'exportPdf' },
  ]

export function FunnelExportMenu({ getPayload, className = '' }: Props) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function run(format: FunnelExportFormat) {
    setOpen(false)
    exportFunnel(getPayload(), format)
  }

  return (
    <div
      ref={rootRef}
      className={`funnel-filter-row funnel-export-box ${className}`.trim()}
    >
      <button
        type="button"
        className="funnel-export-btn"
        aria-label={t('exportMenu')}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t('exportMenu')}
        onClick={() => setOpen((v) => !v)}
      >
        <DotsThree size={20} weight="bold" aria-hidden />
      </button>
      {open ? (
        <div className="funnel-export-menu" role="menu">
          {FORMATS.map((f) => (
            <button
              key={f.format}
              type="button"
              role="menuitem"
              className="funnel-export-item"
              onClick={() => run(f.format)}
            >
              {t(f.labelKey)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
