/**
 * connProviderIcons — brand marks for connection cards / panels.
 * Location: apps/web/src/features/settings/connProviderIcons.tsx
 */
import { ConnBrandLogo } from './connBrandLogos'

/** Colored brand tile (Google, Meta, Telegram, …). size maps to brand tile. */
export function ConnProviderIcon({ id, size = 22 }: { id: string; size?: number }) {
  const tier = size <= 18 ? 'sm' : size >= 28 ? 'lg' : 'md'
  return <ConnBrandLogo id={id} size={tier} />
}
