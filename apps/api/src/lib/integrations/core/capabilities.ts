/**
 * Capability helpers — structured resolve (not boolean flags).
 * Location: apps/api/src/lib/integrations/core/capabilities.ts
 */
import {
  StructuredCapabilitySchema,
  type BindingPurpose,
  type StructuredCapability,
} from '@bu2/shared'

/** Map binding purpose → capability operation id. */
export const PURPOSE_TO_OPERATION: Record<BindingPurpose, string> = {
  read_mail: 'read_mail',
  send_mail: 'send_mail',
  read_dm: 'read_dm',
  send_dm: 'send_dm',
  publish: 'publish',
  insights: 'insights',
  calendar_read: 'calendar_read',
  calendar_write: 'calendar_write',
  sync: 'sync',
}

export function parseCapabilitiesCache(raw: unknown): StructuredCapability[] {
  if (!Array.isArray(raw)) return []
  const out: StructuredCapability[] = []
  for (const item of raw) {
    const parsed = StructuredCapabilitySchema.safeParse(item)
    if (parsed.success) out.push(parsed.data)
  }
  return out
}

export function findCapability(
  caps: StructuredCapability[],
  operation: string,
): StructuredCapability | undefined {
  return caps.find((c) => c.operation === operation)
}

/**
 * Whether a purpose is currently allowed given cached capabilities.
 * Fail-closed: missing capability ⇒ not allowed.
 */
export function purposeAllowed(
  caps: StructuredCapability[],
  purpose: BindingPurpose,
): { allowed: boolean; capability: StructuredCapability | null; reason?: string } {
  const op = PURPOSE_TO_OPERATION[purpose]
  const cap = findCapability(caps, op)
  if (!cap) {
    return { allowed: false, capability: null, reason: 'capability_missing' }
  }
  if (!cap.allowed) {
    return { allowed: false, capability: cap, reason: cap.reason || 'not_allowed' }
  }
  if (cap.availability === 'unavailable') {
    return { allowed: false, capability: cap, reason: 'unavailable' }
  }
  return { allowed: true, capability: cap }
}
