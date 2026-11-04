# Composition Gate — unipile-telegram-user

- HEAD_SHA: WORKTREE
- Verdict: **CLEAR**
- Date: 2026-11-04

## Hop chains

1. **Env → start QR → finalize → connection → inbox binding**
   - `UNIPILE_*` required (503 else) → POST start → poll finalize → `connections(unipile)` + inbox bindings → Inbox sources.

2. **Sync → chats/messages → conversations**
   - POST unipile sync → list chats/messages → upsert channel `telegram_user` → dedupe `unipile:chat:msg`.

3. **Reply → outbox → Unipile send**
   - replyInConversation branches on provider → `unipile_send` job → delivery status.

## Notes

- Platform token never exposed to client.
- Paste `account_id` path for accounts already linked in Unipile dashboard.
