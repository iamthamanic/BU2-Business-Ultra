/**
 * FunnelExportMenu — ⋯ menu: Spalten (optional) + Exportieren (format + column scope).
 * Location: apps/web/src/components/FunnelExportMenu.tsx
 */
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Icon } from '@phosphor-icons/react'
import {
  BracketsCurly,
  DotsThree,
  Export,
  FileCsv,
  FilePdf,
  FileXls,
  Table,
  X,
} from '@phosphor-icons/react'
import { useI18n } from '../lib/i18n'
import {
  exportFunnel,
  type FunnelExportFormat,
  type FunnelExportPayload,
} from '../lib/funnelExport'
import {
  filterExportPayloadColumns,
  type TableColumnDef,
} from '../lib/tableColumns'
import { FunnelTip } from './FunnelTip'
import { TableColumnsModal } from './TableColumnsModal'

export type FunnelColumnPicker = {
  columns: TableColumnDef[]
  visibleKeys: string[]
  onChange: (keys: string[]) => void
  onReset: () => void
}

type Props = {
  getPayload: () => FunnelExportPayload
  className?: string
  /** When set: Spalten menu item + export can filter to visible columns. */
  columnPicker?: FunnelColumnPicker
}

type ColumnScope = 'visible' | 'all'

const FORMATS: {
  format: FunnelExportFormat
  labelKey: 'exportFmtCsv' | 'exportFmtJson' | 'exportFmtXls' | 'exportFmtPdf'
  icon: Icon
}[] = [
  { format: 'csv', labelKey: 'exportFmtCsv', icon: FileCsv },
  { format: 'json', labelKey: 'exportFmtJson', icon: BracketsCurly },
  { format: 'xls', labelKey: 'exportFmtXls', icon: FileXls },
  { format: 'pdf', labelKey: 'exportFmtPdf', icon: FilePdf },
]

function seedExportKeys(columns: TableColumnDef[], visibleKeys: string[]): string[] {
  const order = columns.map((c) => c.key)
  const locked = columns.filter((c) => c.locked).map((c) => c.key)
  const picked = order.filter((k) => visibleKeys.includes(k) || locked.includes(k))
  return picked.length > 0 ? picked : order
}

export function FunnelExportMenu({ getPayload, className = '', columnPicker }: Props) {
  const { t } = useI18n()
  const titleId = useId()
  const [menuOpen, setMenuOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [format, setFormat] = useState<FunnelExportFormat>('csv')
  const [columnScope, setColumnScope] = useState<ColumnScope>('visible')
  const [exportKeys, setExportKeys] = useState<string[]>([])
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

  function openExportModal() {
    setMenuOpen(false)
    setFormat('csv')
    setColumnScope(columnPicker ? 'visible' : 'all')
    if (columnPicker) {
      setExportKeys(seedExportKeys(columnPicker.columns, columnPicker.visibleKeys))
    } else {
      setExportKeys([])
    }
    setModalOpen(true)
  }

  function openColumnsModal() {
    setMenuOpen(false)
    setColumnsOpen(true)
  }

  function toggleExportKey(key: string, locked?: boolean) {
    if (locked || !columnPicker) return
    setExportKeys((prev) => {
      if (prev.includes(key)) {
        const next = prev.filter((k) => k !== key)
        return next.length === 0 ? prev : next
      }
      const order = columnPicker.columns.map((c) => c.key)
      return order.filter((k) => k === key || prev.includes(k))
    })
  }

  function confirm() {
    setModalOpen(false)
    const payload = getPayload()
    if (columnPicker && columnScope === 'visible') {
      const filtered = filterExportPayloadColumns(payload, exportKeys)
      exportFunnel({ ...payload, ...filtered }, format)
      return
    }
    exportFunnel(payload, format)
  }

  return (
    <div ref={rootRef} className={`funnel-export-box ${className}`.trim()}>
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
          {columnPicker ? (
            <button
              type="button"
              role="menuitem"
              className="funnel-export-item"
              onClick={openColumnsModal}
            >
              <Table size={16} weight="duotone" aria-hidden />
              <span>{t('tableColumnsMenu')}</span>
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className="funnel-export-item"
            onClick={openExportModal}
          >
            <Export size={16} weight="bold" aria-hidden />
            <span>{t('exportMenu')}</span>
          </button>
        </div>
      ) : null}

      {columnPicker ? (
        <TableColumnsModal
          open={columnsOpen}
          title={t('tableColumnsTitle')}
          columns={columnPicker.columns}
          visibleKeys={columnPicker.visibleKeys}
          lockedHint={t('tableColumnLocked')}
          cancelLabel={t('cancel')}
          resetLabel={t('tableColumnsReset')}
          applyLabel={t('tableColumnsApply')}
          onClose={() => setColumnsOpen(false)}
          onApply={columnPicker.onChange}
          onReset={columnPicker.onReset}
        />
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
                <div
                  className="funnel-export-formats"
                  role="radiogroup"
                  aria-label={t('exportPickFormat')}
                >
                  {FORMATS.map((f) => {
                    const Ic = f.icon
                    return (
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
                        <span className="funnel-export-fmt-ic" aria-hidden>
                          <Ic size={18} weight="duotone" />
                        </span>
                        <span>{t(f.labelKey)}</span>
                      </label>
                    )
                  })}
                </div>

                {columnPicker ? (
                  <div className="funnel-export-scope">
                    <p className="funnel-export-scope-title">{t('exportColumnScope')}</p>
                    <div
                      className="funnel-export-scope-opts"
                      role="radiogroup"
                      aria-label={t('exportColumnScope')}
                    >
                      <label
                        className={`funnel-export-scope-opt${columnScope === 'visible' ? ' is-active' : ''}`}
                      >
                        <input
                          type="radio"
                          name="funnel-export-scope"
                          checked={columnScope === 'visible'}
                          onChange={() => setColumnScope('visible')}
                        />
                        <span>{t('exportColumnsVisible')}</span>
                      </label>
                      <label
                        className={`funnel-export-scope-opt${columnScope === 'all' ? ' is-active' : ''}`}
                      >
                        <input
                          type="radio"
                          name="funnel-export-scope"
                          checked={columnScope === 'all'}
                          onChange={() => setColumnScope('all')}
                        />
                        <span>{t('exportColumnsAll')}</span>
                      </label>
                    </div>

                    {columnScope === 'visible' ? (
                      <ul
                        className="table-columns-list funnel-export-col-list"
                        aria-label={t('exportColumnsVisible')}
                      >
                        {columnPicker.columns.map((c) => {
                          const on = exportKeys.includes(c.key)
                          return (
                            <li key={c.key}>
                              <label
                                className={`table-columns-option${on ? ' is-on' : ''}${c.locked ? ' is-locked' : ''}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={on}
                                  disabled={Boolean(c.locked)}
                                  onChange={() => toggleExportKey(c.key, c.locked)}
                                />
                                <span className="table-columns-option-main">
                                  <span className="table-columns-option-label">{c.label}</span>
                                  {c.locked ? (
                                    <span className="muted table-columns-locked">
                                      {t('tableColumnLocked')}
                                    </span>
                                  ) : null}
                                </span>
                                {c.description ? (
                                  <span
                                    className="table-columns-option-tip"
                                    onClick={(e) => e.preventDefault()}
                                    onMouseDown={(e) => e.preventDefault()}
                                  >
                                    <FunnelTip tip={c.description} iconOnly wide>
                                      {c.label}
                                    </FunnelTip>
                                  </span>
                                ) : null}
                              </label>
                            </li>
                          )
                        })}
                      </ul>
                    ) : null}
                  </div>
                ) : null}

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
