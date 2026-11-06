# Composition gate — tools-hub

- HEAD_SHA: pending (local)
- Verdict: CLEAR
- Date: 2026-11-05

## Hop chains reviewed

1. **Install custom tool** — `POST /tools` → single `tool_installs` row (unique biz+manifest) → audit once. Cardinality: **once per install request**. Duplicate manifest → 409 fail-closed.
2. **List hub** — read-only merge of system Sortanize tile + DB installs; no fan-out side effects.
3. **Open custom tool** — client opens new tab with slug/manifest query only; **no** server token mint in v1 (no dual consumers).
4. **Uninstall** — single DELETE by id+tenant; system tile immutable (400).
5. **Member grants** — `PATCH .../members/:id/grants` updates one membership row + one audit; Owner/Admin targets rejected (400). Cardinality: **once per grant request**.

## Simulations

| Sim | Result |
|-----|--------|
| N-actors concurrent install same manifest | Unique index → one succeeds, others 409 |
| Invalid/missing URL or reserved manifest | Fail closed (400) |
| Two consumers / crash mid-install | No outbox; DB row is SoT; retry-safe |

## Notes

CheckMap removal has no remaining producer→consumer path (module deleted).
