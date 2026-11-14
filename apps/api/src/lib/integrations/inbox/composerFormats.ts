/**
 * Resolve inbox composer messageFormats for a connection (cache + provider defaults).
 * Location: apps/api/src/lib/integrations/inbox/composerFormats.ts
 */
import {
  inboxComposerFormatsForProvider,
  type InboxMessageFormat,
  type StructuredCapability,
} from '@bu2/shared'
import { parseCapabilitiesCache } from '../core/capabilities.js'

export function composerFormatsForConnection(opts: {
  provider: string
  capabilitiesCache: unknown
}): InboxMessageFormat[] {
  const caps = parseCapabilitiesCache(opts.capabilitiesCache)
  const send =
    caps.find((c) => c.operation === 'send_dm' && c.allowed) ||
    caps.find((c) => c.operation === 'send_mail' && c.allowed) ||
    caps.find((c) => c.operation === 'send_dm') ||
    caps.find((c) => c.operation === 'send_mail')
  return inboxComposerFormatsForProvider(opts.provider, send?.messageFormats ?? null)
}

export function sendCapabilityFormats(caps: StructuredCapability[]): string[] {
  const send =
    caps.find((c) => c.operation === 'send_dm') || caps.find((c) => c.operation === 'send_mail')
  return send?.messageFormats ?? []
}
