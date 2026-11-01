/**
 * FunnelTip — visible info icon + body-portal tooltip (not clipped by table overflow).
 * Location: apps/web/src/components/FunnelTip.tsx
 */
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Info } from '@phosphor-icons/react'

type Props = {
  tip: string
  children?: ReactNode
  /** When true, only the info icon is the hover target (for KPI heads / dense headers). */
  iconOnly?: boolean
  className?: string
}

export function FunnelTip({ tip, children, iconOnly = false, className = '' }: Props) {
  const tipId = useId()
  const anchorRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [style, setStyle] = useState<CSSProperties>({})

  function place() {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const width = Math.min(300, Math.max(200, window.innerWidth * 0.7))
    let left = r.left
    if (left + width > window.innerWidth - 12) left = Math.max(12, window.innerWidth - width - 12)
    const below = r.bottom + 8
    const preferBelow = below + 120 < window.innerHeight
    setStyle({
      position: 'fixed',
      top: preferBelow ? below : Math.max(8, r.top - 8),
      left,
      width,
      transform: preferBelow ? undefined : 'translateY(-100%)',
    })
  }

  function show() {
    if (!tip) return
    place()
    setOpen(true)
  }

  function hide() {
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    function onScroll() {
      place()
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-place while open
  }, [open])

  if (!tip) return <>{children}</>

  return (
    <>
      <span
        ref={anchorRef}
        className={`funnel-tip ${iconOnly ? 'funnel-tip--icon' : ''} ${className}`.trim()}
        tabIndex={0}
        aria-describedby={open ? tipId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {iconOnly ? null : <span className="funnel-tip-label">{children}</span>}
        <span className="funnel-tip-ic" aria-hidden>
          <Info size={iconOnly ? 13 : 12} weight="regular" />
        </span>
        {iconOnly ? <span className="sr-only">{children}</span> : null}
      </span>
      {open
        ? createPortal(
            <div id={tipId} className="funnel-tip-bubble" role="tooltip" style={style}>
              {tip}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
