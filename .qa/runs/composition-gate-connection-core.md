# Composition Gate — connection-core

- HEAD_SHA: WORKTREE (uncommitted implement)
- Date: 2026-11-04
- Verdict: CLEAR

## Event

Mock provider connect → encrypted credential rows → optional module binding → capability resolve for purpose.

## Intended meaning

| Axis | Intent |
|------|--------|
| Cardinality | One `connections` row per connect; one credential row per kind; one binding per (connection, module, purpose) |
| Tenant | All reads/writes scoped by `business_id`; wrong-business connection id ⇒ null/404 |
| Secrets | Plaintext only in adapter memory at connect; API responses never include credential plaintext |
| Capability | Binding enable fails closed if purpose not allowed / missing / unavailable |

## Hop chain

1. **Producer** `connectMockAccount` → inserts `connections` + sealed `connection_credentials`
2. **Consumer** `createModuleBinding` → `getConnectionForBusiness` + `purposeAllowed`
3. **Consumer** capability GET → same resolve helpers

## Simulations

### N-actors
Two businesses cannot share a connection id: lookup always ANDs `businessId`. Unique index is per business, so same external id may exist in two tenants independently — intended.

### Invalid / missing
- Unknown connection for binding → 404
- Purpose without capability → 409 capability_denied / capability_missing
- Publish on mock → denied (unavailable)

### Concurrent consumers
No outbox/worker in this slice. Bindings are unique; duplicate insert → 409. No fan-out side effects.

## Findings

None.

## Verdict rationale

Multi-hop path is intentional Integration Core; fail-closed tenant + capability checks match design. No silent retarget or cross-tenant leak in this hop chain.
