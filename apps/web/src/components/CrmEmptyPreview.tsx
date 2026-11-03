/**
 * CrmEmptyPreview — empty blurred stage + centered CTA (no fake rows).
 * Location: apps/web/src/components/CrmEmptyPreview.tsx
 */
import type { ReactNode } from 'react'
import { Plus } from '@phosphor-icons/react'

type Props = {
  children?: ReactNode
  ctaLabel: string
  onCta?: () => void
  canWrite?: boolean
  hint?: string
}

export function CrmEmptyPreview({ children, ctaLabel, onCta, canWrite = true, hint }: Props) {
  const showCta = Boolean(canWrite && onCta)

  return (
    <div className="crm-preview-wrap panel">
      <div className="crm-preview-stage" aria-hidden>
        {children ?? <div className="crm-preview-void" />}
      </div>
      <div className="crm-preview-fade" aria-hidden />
      {hint || showCta ? (
        <div className="crm-preview-cta">
          <div className="crm-preview-hint">
            {hint ? <p className="muted crm-preview-hint-text">{hint}</p> : null}
            {showCta ? (
              <button type="button" className="btn primary crm-preview-btn" onClick={onCta}>
                <Plus size={14} weight="bold" aria-hidden />
                {ctaLabel}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
