# Feature: Unipile Telegram User (Integration Core Step 02b)

## Intent
Connect a **personal Telegram account** (private DMs) via Unipile into the same Omnichannel Inbox as the Bot path.

## Goal
- Platform Unipile DSN + API key via env (fail-closed)
- Start QR connect OR link existing Unipile `account_id`
- Sync chats/messages → `conversations` / `messages` (channel `telegram_user`)
- Reply via Unipile send → outbox delivery status
- Settings Connect wizard exposes Unipile when configured

## Non-Goals
- Hosted Auth redirect UI polish beyond QR + poll
- WhatsApp/LinkedIn via Unipile
- Webhooks (poll sync first)
- Replacing Telegram Bot path

## Happy Path
1. Admin sets `UNIPILE_DSN` + `UNIPILE_ACCESS_TOKEN`
2. Settings → Konto verbinden → Unipile → start QR → scan in Telegram → connection active
3. Sync → private chats appear in Inbox with channel badge `telegram_user`
4. Reply → message sent via Unipile, delivery `sent`

## Edge Cases
- Missing env → connect returns 503 `unipile_not_configured`
- QR expired / declined → surfaced error; no half-active connection
- Duplicate account_id same business → 409
- Capability deny if connection revoked

## Security Coverage
- F-03/F-05: Unipile token only server env; never to client
- B-02/B-03: connect/sync require membership + credential role
- B-10: no default fake Unipile token — fail closed
- P-02: errors without stack/secrets to client

## Acceptance
- [ ] Env documented in `.env.example`
- [ ] Connect QR + poll OR paste account_id
- [ ] Sync imports chats/messages idempotently
- [ ] Reply works for Unipile conversations
- [ ] Settings/Inbox UI wires sync for provider `unipile`
- [ ] `pnpm run checks` PASS

## Implementation Notes
- Client: DSN + ACCESS_TOKEN env, fail-closed 503
- Routes: start QR / finalize poll / link account_id / sync
- Channel `telegram_user`; reply via shared `replyInConversation` → Unipile outbox
- Settings wizard: Unipile card when configured; Inbox sync includes unipile
- Inbox sidebar icon → yellow (`#facc15`)
- Tests: 10 PASS; checks PASS

## Composition Gate
- HEAD_SHA: WORKTREE
- Verdict: CLEAR
- Proof: `.qa/runs/composition-gate-unipile-telegram-user.md`
