# Composition Gate — telegram-inbox-e2e

- HEAD_SHA: WORKTREE
- Date: 2026-11-04
- Verdict: CLEAR

## Event

Telegram inbound update → conversation/message upsert; outbound reply → one outbox job → sendMessage → delivery status.

## Intended meaning

| Axis | Intent |
|------|--------|
| Cardinality inbound | One message row per `(connection_id, provider_message_id)`; duplicates skipped |
| Cardinality outbound | Exactly **one** `outbox_jobs` row per reply; process updates that message only |
| Tenant | All queries AND `business_id`; wrong id → 404 |
| Secrets | Bot token encrypted; never in list/thread API |

## Hop chain

1. Sync: getUpdates → identity → conversation → message (idempotent)
2. Reply: message(pending) → outbox(pending) → send → message(sent|failed) + outbox(sent|failed)

## Simulations

### N-actors
Two businesses with same Telegram chat id stay isolated via connection/business scoping.

### Invalid / missing
Invalid token fails at connect before insert. Missing capability → 409. Send failure marks failed (no silent success).

### Concurrent consumers
Single synchronous outbox processor per reply in V1; unique provider_message_id prevents double ingest.

## Findings

None.
