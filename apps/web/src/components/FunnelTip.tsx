/**
 * FunnelTip — hover/focus tooltip for funnel KPIs and table headers (Dark-Ops).
 * Location: apps/web/src/components/FunnelTip.tsx
 */
import type { ElementType, ReactNode } from 'react'

type Props = {
  tip: string
  children: ReactNode
  as?: ElementType
  className?: string
}

export function FunnelTip({ tip, children, as: Tag = 'span', className = '' }: Props) {
  if (!tip) {
    const Comp = Tag
    return <Comp className={className || undefined}>{children}</Comp>
  }
  return (
    <Tag className={`funnel-tip ${className}`.trim()} data-tip={tip} tabIndex={0}>
      {children}
    </Tag>
  )
}
