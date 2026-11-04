# Composition Gate — omnichannel-ux-shell

- HEAD_SHA: WORKTREE
- Verdict: **CLEAR**
- Date: 2026-11-04

## Hop chains checked

1. **Connect → Connection → Inbox binding → Inbox source**
   - Settings ConnectAccountModal → POST `/inbox/telegram/connect` → `connections` + `module_bindings(inbox)` → GET `/inbox/connections` lists source → Sync/Reply.

2. **Usage toggle → module_bindings → tags**
   - PUT `/integrations/module-bindings` → enable CRM/Marketing/Inbox → list bindings → Settings table tags + detail checkboxes.

3. **Tenant isolation**
   - All routes use `loadMembership` → `businessId`; credentials never returned; bot token only in connect body.

## Simulations

| Check | Result |
|-------|--------|
| N-actors (two businesses same bot id) | Isolated by connections unique (biz, provider, ext) |
| Invalid fallback (toggle publish-only module without cap) | `no_capable_purpose` 409 — fail closed |
| Concurrent consumer (sync while list) | Idempotent ingest by provider_message_id (existing Telegram path) |

## Notes

- Assigned/Unread filters are UI stubs (empty until step 04).
- Metricool/Brevo panels unchanged below messaging hub.
