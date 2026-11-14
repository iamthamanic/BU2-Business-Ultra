# Feature: Inbox Composer Capabilities (Kanal-Funktionen)

## Intent
Composer zeigt und nutzt kanalabhängige Send-Funktionen (Text, HTML, Anhang, Audio/Voice) anhand deklarierter Connection-Capabilities — nicht ein generisches Textfeld für alle Kanäle.

## Goal
- `messageFormats` an Inbox-Providern deklarieren (`text` | `html` | `image` | `file` | `audio` | `voice`)
- Thread-API liefert `composerFormats` für die aktive Connection
- Composer-Toolbar: Attach / Voice nur wenn Format erlaubt; E-Mail behält HTML-Modal
- Telegram: Anhang + Voice/Audio wirklich senden (Bot API)

## Non-Goals
- Gmail/Outlook/Unipile Media-Send (UI darf Formate zeigen; Send → klarer Fehler bis Adapter folgt)
- Stickers, Reactions, Location, Polls
- Persistente Media-Galerie / CDN jenseits lokaler Uploads + Message-Raw

## Happy Path
1. User öffnet Telegram-Thread → Toolbar zeigt Anhang + Voice neben Text
2. User hängt Bild an → Reply speichert Upload, Bot sendet Photo, Bubble zeigt Caption/Dateiname
3. User nimmt Voice auf → Audio wird gesendet
4. User öffnet E-Mail-Thread → HTML-Composer; Attach nur wenn `file` in Formats

## Edge Cases
- Connection mit altem `capabilitiesCache` (nur `text`) → Provider-Defaults anreichern
- Reply ohne Body und ohne Attachment → 400
- Attachment > Größenlimit → 413
- Provider ohne Media-Wire → 501 `media_unsupported_for_provider`
- Viewer ohne Write → Composer ausgeblendet (bestehend)

## Security Coverage
- F-02: Dateityp/Größe serverseitig prüfen (MIME + max bytes)
- F-03/F-05: kein Credential im Client; Uploads unter business-scoped path
- B-02/B-03: Reply weiter `canMutateContent`
- B-09: businessId aus Membership
- P-04: Upload Type/Size-Validierung
- B-04: N/A (kein SQL aus Dateiname)

## Acceptance
- [ ] Conversation GET enthält `composerFormats: string[]`
- [ ] Telegram Bot Capabilities listen image/file/audio/voice
- [ ] Composer-Toolbar blendet Actions nach Formats
- [ ] Telegram Attach + Voice/Audio Send funktioniert E2E (oder Demo mit echte Connection)
- [ ] `pnpm --filter @bu2/web exec tsc --noEmit` + API tsc/tests relevant PASS

## Implementation Notes
- Shared: `InboxMessageFormat`, `INBOX_COMPOSER_FORMATS_BY_PROVIDER`, `inboxComposerFormatsForProvider`, extended `InboxReplySchema` (+ optional attachment dataUrl)
- API: `composerFormats` on conversation GET + connections list; Telegram `sendPhoto/Document/Audio/Voice` via outbox; Gmail/Unipile media → 501
- Web: `InboxComposerBar` Attach + Voice according to `composerFormats`; E-Mail stays HTML modal
- Skip: Unipile/Gmail media wire; stickers/reactions
