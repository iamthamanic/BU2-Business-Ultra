/**
 * Persisted table column visibility — localStorage per company slug + tableId.
 * Location: apps/web/src/lib/tableColumns.ts
 */
import { useCallback, useMemo, useState } from 'react'

export type TableColumnDef = {
  key: string
  label: string
  /** Always visible; checkbox disabled in picker. */
  locked?: boolean
  /** Longer help shown in the columns modal tooltip. */
  description?: string
}

type StoredShape = {
  visible: string[]
  known: string[]
}

function storageKey(slug: string, tableId: string): string {
  return `bu2:table-cols:${slug}:${tableId}`
}

function defaultVisibleKeys(columns: TableColumnDef[]): string[] {
  return columns.map((c) => c.key)
}

function readStored(slug: string, tableId: string): StoredShape | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(storageKey(slug, tableId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      return { visible: parsed.filter((x) => typeof x === 'string'), known: [] }
    }
    if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as StoredShape).visible)
    ) {
      const p = parsed as StoredShape
      return {
        visible: p.visible.filter((x) => typeof x === 'string'),
        known: Array.isArray(p.known) ? p.known.filter((x) => typeof x === 'string') : [],
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

function writeStored(slug: string, tableId: string, visible: string[], known: string[]) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(
      storageKey(slug, tableId),
      JSON.stringify({ visible, known } satisfies StoredShape),
    )
  } catch {
    /* ignore quota */
  }
}

function resolveVisible(columns: TableColumnDef[], stored: StoredShape | null): string[] {
  const allKeys = columns.map((c) => c.key)
  const locked = columns.filter((c) => c.locked).map((c) => c.key)
  if (!stored) return defaultVisibleKeys(columns)

  const knownPrev = new Set(stored.known.length ? stored.known : stored.visible)
  const visibleSet = new Set(stored.visible)
  const next: string[] = []
  for (const k of allKeys) {
    if (locked.includes(k)) {
      next.push(k)
      continue
    }
    if (visibleSet.has(k)) {
      next.push(k)
      continue
    }
    // New column (not in previous known schema) → default on
    if (!knownPrev.has(k)) next.push(k)
  }
  if (next.length === 0 && allKeys.length > 0) {
    return locked.length ? [...locked] : [allKeys[0]!]
  }
  return next
}

function normalizeVisible(columns: TableColumnDef[], raw: string[]): string[] {
  const locked = columns.filter((c) => c.locked).map((c) => c.key)
  const allowed = new Set(columns.map((c) => c.key))
  let merged = raw.filter((k) => allowed.has(k))
  for (const k of locked) {
    if (!merged.includes(k)) merged = [k, ...merged]
  }
  if (merged.length === 0 && columns[0]) merged = [columns[0].key]
  return columns.map((c) => c.key).filter((k) => merged.includes(k))
}

export function usePersistedTableColumns(opts: {
  slug: string
  tableId: string
  columns: TableColumnDef[]
}) {
  const { slug, tableId, columns } = opts
  const columnsKey = columns.map((c) => `${c.key}:${c.locked ? '1' : '0'}`).join('|')
  const signature = `${slug}|${tableId}|${columnsKey}`

  const [visibleKeys, setVisibleKeysState] = useState<string[]>(() =>
    resolveVisible(columns, slug ? readStored(slug, tableId) : null),
  )
  const [prevSignature, setPrevSignature] = useState(signature)
  if (signature !== prevSignature) {
    setPrevSignature(signature)
    setVisibleKeysState(resolveVisible(columns, slug ? readStored(slug, tableId) : null))
  }

  const setVisibleKeys = useCallback(
    (next: string[] | ((prev: string[]) => string[])) => {
      setVisibleKeysState((prev) => {
        const raw = typeof next === 'function' ? next(prev) : next
        const merged = normalizeVisible(columns, raw)
        if (slug) {
          writeStored(
            slug,
            tableId,
            merged,
            columns.map((c) => c.key),
          )
        }
        return merged
      })
    },
    [columns, slug, tableId],
  )

  const reset = useCallback(() => {
    setVisibleKeys(defaultVisibleKeys(columns))
  }, [columns, setVisibleKeys])

  const visibleColumns = useMemo(
    () => columns.filter((c) => visibleKeys.includes(c.key)),
    [columns, visibleKeys],
  )

  return { visibleKeys, visibleColumns, setVisibleKeys, reset }
}

/** Filter export payload columns/rows to the given keys (order preserved). */
export function filterExportPayloadColumns<
  T extends {
    columns: { key: string; label: string }[]
    rows: Record<string, string | number | null>[]
  },
>(payload: T, keys: string[]): Pick<T, 'columns' | 'rows'> {
  const keySet = new Set(keys)
  const columns = payload.columns.filter((c) => keySet.has(c.key))
  const orderedKeys = columns.map((c) => c.key)
  const rows = payload.rows.map((row) => {
    const out: Record<string, string | number | null> = {}
    for (const k of orderedKeys) {
      out[k] = row[k] ?? null
    }
    return out
  })
  return { columns, rows }
}
