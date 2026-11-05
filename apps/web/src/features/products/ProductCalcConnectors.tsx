/**
 * ProductCalcConnectors — Decorative stem + fan SVG lines (legacy CMB workbench).
 * Pure presentation — not domain edges. Location: apps/web/src/features/products/ProductCalcConnectors.tsx
 */

type FanProps = {
  branches?: number
  direction: 'down' | 'up'
}

/** Percentage-based fan: trunk splits into N branches (or merges). */
export function ProductCalcFan({ branches = 5, direction }: FanProps) {
  const mid = 50
  const topY = direction === 'down' ? 0 : 100
  const botY = direction === 'down' ? 100 : 0
  const trunkEnd = direction === 'down' ? 28 : 72
  const spreadY = direction === 'down' ? 55 : 45
  const xs: number[] = []
  for (let i = 0; i < branches; i++) xs.push(((i + 0.5) / branches) * 100)

  return (
    <svg
      className="product-calc-fan"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path d={`M ${mid} ${topY} L ${mid} ${trunkEnd}`} fill="none" stroke="currentColor" strokeWidth="0.6" />
      <path
        d={`M ${xs[0]} ${spreadY} L ${xs[branches - 1]} ${spreadY}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="0.6"
      />
      {xs.map((x) => (
        <path
          key={x}
          d={
            direction === 'down'
              ? `M ${mid} ${trunkEnd} L ${x} ${spreadY} L ${x} ${botY}`
              : `M ${x} ${botY} L ${x} ${spreadY} L ${mid} ${trunkEnd}`
          }
          fill="none"
          stroke="currentColor"
          strokeWidth="0.55"
        />
      ))}
    </svg>
  )
}

export function ProductCalcStem() {
  return <div className="product-calc-stem" aria-hidden />
}
