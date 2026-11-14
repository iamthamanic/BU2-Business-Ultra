# Composition Gate — inbox-assign-unread

- HEAD_SHA: WORKTREE (uncommitted implement)
- Date: 2026-11-08
- Verdict: **CLEAR**

## Path

1. **Producer:** Inbound message insert (Gmail / Telegram / Unipile sync) → `bumpConversationUnread`
2. **Consumer:** Inbox list filter `unread` reads `unreadCount`; opening thread → `markConversationRead` (GET messages)
3. **Producer:** PATCH assign → `assignConversation` (membership check) → list filter `assigned` reads `assigneeUserId === me`

## Simulations

| Sim | Result |
|-----|--------|
| N-actors | Unread is conversation-global (one counter). Assign is one row per conversation. No fan-out. |
| Invalid fallback | Assignee not in business membership → 400 `assignee_not_member` (fail-closed). No silent retarget. |
| Concurrent consumers | Mark-read is idempotent `unread_count=0`. List/filter are read-only. |

## Notes

- Cardinality: one unread bump per newly inserted inbound message; one clear per thread open.
- No outbox/mail side-effects in this hop chain.
