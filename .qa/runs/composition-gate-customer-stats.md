# Composition Gate — customer-stats

- HEAD_SHA: WORKTREE (uncommitted customer-stats; base c29a027d24b37c1fee1bd547f345fe8fad7b6a7d)
- Date: 2026-11-02
- Verdict: CLEAR

## Event
Customer purchase line created/deleted or buyer persona linked — LTV / product mix / persona summary must stay consistent for that customer in the same tenant.

## Hop chain
UI modal (CustomerDetail) → POST/PATCH/DELETE `/api/b/:slug/customers/:id/{purchases|stats}` → Zod + membership + business-scoped persona/product check → `customer_purchases` / `customers.buyer_persona_id` → `loadCustomerStats` (sum LTV + product map + persona join) → detail payload / modal re-render

## Simulations
| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| 1 event, N actors | Each purchase is one row; LTV = sum of that customer's lines only | Insert scoped by businessId+customerId; stats loader filters same pair | pass |
| invalid / missing | Bad persona/product/cross-tenant → 400/404; no silent retarget | Persona/product looked up with businessId; missing customer → 404 | pass |
| 2 consumers / crash | No outbox/fan-out; delete returns fresh stats once | Sync request/response; no worker; UI updates from returned `stats` | pass |

## Flags
| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| — | — | — | — | — |

## Skip reason
n/a
