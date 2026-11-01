/**
 * ShellControls — deprecated for account chrome (now sidebar footer).
 * Kept as thin topbar extras helper if a page needs extra header actions.
 * Location: apps/web/src/components/ShellControls.tsx
 */
import type { ReactNode } from 'react'

type Props = {
  extra?: ReactNode
}

export function ShellControls({ extra }: Props) {
  return <>{extra}</>
}
