/**
 * Tools hub domain helpers — system tiles + custom installs.
 * Location: apps/api/src/modules/tools/service.ts
 */
import { and, eq } from 'drizzle-orm'
import type { CreateToolInstallInput, ToolInstallDto, UpdateToolInstallInput } from '@bu2/shared'
import { db } from '../../db/client.js'
import { toolInstalls } from '../../db/schema.js'

const SORTANIZE_TILE: ToolInstallDto = {
  id: '00000000-0000-4000-8000-000000000001',
  manifestId: 'sortanize',
  name: 'Sortanize',
  entryUrl: '',
  iconKey: 'sortanize',
  scopes: {},
  kind: 'system',
  openMode: 'route',
  openPath: 'tools/sortanize',
}

function mapInstall(row: typeof toolInstalls.$inferSelect): ToolInstallDto {
  return {
    id: row.id,
    manifestId: row.manifestId,
    name: row.name,
    entryUrl: row.entryUrl,
    iconKey: row.iconKey,
    scopes: row.scopes ?? {},
    kind: row.kind === 'system' ? 'system' : 'custom',
    openMode: 'external',
    openPath: null,
  }
}

export async function listToolsForBusiness(businessId: string): Promise<ToolInstallDto[]> {
  const rows = await db
    .select()
    .from(toolInstalls)
    .where(eq(toolInstalls.businessId, businessId))
  const custom = rows
    .filter((r) => r.manifestId !== 'sortanize')
    .map(mapInstall)
  return [SORTANIZE_TILE, ...custom]
}

export async function createToolInstall(
  businessId: string,
  userId: string,
  input: CreateToolInstallInput,
): Promise<{ ok: true; tool: ToolInstallDto } | { ok: false; error: 'conflict' | 'reserved' }> {
  if (input.manifestId === 'sortanize') return { ok: false, error: 'reserved' }
  try {
    const [row] = await db
      .insert(toolInstalls)
      .values({
        businessId,
        manifestId: input.manifestId,
        name: input.name.trim(),
        entryUrl: input.entryUrl,
        iconKey: input.iconKey ?? 'puzzle',
        scopes: input.scopes ?? {},
        kind: 'custom',
        createdByUserId: userId,
      })
      .returning()
    if (!row) return { ok: false, error: 'conflict' }
    return { ok: true, tool: mapInstall(row) }
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('tool_installs_biz_manifest') || msg.includes('unique')) {
      return { ok: false, error: 'conflict' }
    }
    throw e
  }
}

export async function updateToolInstall(
  businessId: string,
  id: string,
  input: UpdateToolInstallInput,
): Promise<ToolInstallDto | null> {
  const patch: Partial<typeof toolInstalls.$inferInsert> = { updatedAt: new Date() }
  if (input.name !== undefined) patch.name = input.name.trim()
  if (input.entryUrl !== undefined) patch.entryUrl = input.entryUrl
  if (input.iconKey !== undefined) patch.iconKey = input.iconKey
  if (input.scopes !== undefined) patch.scopes = input.scopes
  const [row] = await db
    .update(toolInstalls)
    .set(patch)
    .where(and(eq(toolInstalls.id, id), eq(toolInstalls.businessId, businessId)))
    .returning()
  return row ? mapInstall(row) : null
}

export async function deleteToolInstall(businessId: string, id: string): Promise<boolean> {
  const deleted = await db
    .delete(toolInstalls)
    .where(and(eq(toolInstalls.id, id), eq(toolInstalls.businessId, businessId)))
    .returning({ id: toolInstalls.id })
  return deleted.length > 0
}
