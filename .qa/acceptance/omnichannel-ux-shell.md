# Feature: Omnichannel UX Shell (Verbindungen + Inbox)

## Intent
Wire Settings → Verbindungen and Inbox UI to Integration Core so the product matches the Omnichannel mockups structurally — even with Telegram as the only live provider.

## Goal
- Connections table + connect flow live under Settings (not buried in Inbox)
- Binding tags / toggles for Inbox · CRM · Marketing
- Inbox: source strip, status filters (stubs), channel badges, CTA to Settings when empty

## Non-Goals
- Unipile / personal Telegram (02b)
- Gmail / Outlook / Meta OAuth
- Full CRM confirm, assign, internal notes, attachments
- Replacing Metricool/Brevo/Ads secret panels (keep below messaging hub)

## Happy Path
1. Admin opens Einstellungen → Verbindungen → sees messaging accounts table (or empty)
2. Clicks „Konto verbinden“ → picks Telegram → enters bot token → connection appears with Inbox tag
3. Opens connection detail → toggles CRM on → tag appears
4. Opens Inbox → source strip shows Telegram · Sync works · filters visible · empty state links to Settings if no connection

## Edge Cases
- Viewer cannot connect or toggle bindings
- Toggle Marketing on Telegram when only send_dm available → uses send_dm purpose
- Disable Inbox binding → connection stays but Inbox sync/list should respect binding (best-effort; document if deferred)
- Duplicate Telegram bot → 409 surfaced in UI

## Security Coverage
- F-02: token only in password field; never echo
- F-03/F-05: no credentials in client storage beyond transient form state
- B-02/B-03: connect + binding mutate require canManageCredentials
- B-09: business from membership, not client
- P-03: N/A session cookies unchanged

## Acceptance
- [ ] Messaging connections section above legacy API-key panels
- [ ] Connect modal: provider step + Telegram bot token
- [ ] Table columns: provider, account, status, usage tags, sync action
- [ ] Module toggles Inbox/CRM/Marketing via bindings API
- [ ] Inbox no longer hosts primary connect form; links to Settings
- [ ] Inbox source strip + filter tabs (Alle/Offen/…)
- [ ] `pnpm run checks` PASS

## Implementation Notes
- Settings: `MessagingConnectionsPanel` + `ConnectAccountModal` above legacy API-key panels
- API: `PUT /integrations/module-bindings` (`setModuleBindingsEnabled`) for Inbox/CRM/Marketing tags
- Inbox: connect form removed → CTA to Settings; source strip; filter tabs; reply-via line
- Inbox sources = connections with enabled inbox binding (any provider)
- Tests: 7 PASS; `pnpm run checks` PASS
- Stubs: assigned/unread empty; protocol tab; non-Telegram providers “Bald”

## Composition Gate
- HEAD_SHA: WORKTREE
- Verdict: CLEAR
- Proof: `.qa/runs/composition-gate-omnichannel-ux-shell.md`
