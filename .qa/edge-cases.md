# Business Ultra — project-specific edge cases for verify-ui

Extends the universal matrix in the verify-ui skill.
Add rows as features ship.

## Global

| ID | Case | Fail if |
|----|------|---------|
| G-01 | App loads | Blank screen, uncaught console errors |
| G-02 | Locale | UI language does not match AGENTS.md (de) |

## Security (Secure-by-Default Seeds)

| ID | Case | Fail if |
|----|------|---------|
| S-01 | Secret im Client | `localStorage`/Client-Bundle enthält Token/Secret/Password |
| S-02 | XSS über User-Input | Unvalidierter User-Input wird gerendert |
| S-03 | IDOR / fehlende Authz | Sensitive Ressource ohne Owner-/Rollen-Check |
| S-04 | SQL-Injection | Raw-SQL mit User-Input via String-Konkatenation |
| S-05 | Insecure Cookie | Session-Cookie ohne HttpOnly+Secure+SameSite in Prod |
| S-06 | Upload ohne Validierung | File-Upload akzeptiert beliebigen Typ/Größe |
| S-07 | Auth-Endpoint ohne Rate-Limit | Login/Register ohne Rate-Limiting |
| S-08 | Secrets in Logs | `console.log`/Error enthält Password/Token/API-Key |

## CRM / Projekte UI

| ID | Case | Fail if |
|----|------|---------|
| CRM-01 | Project header meta | “Area” label sichtbar neben Status |
| CRM-02 | Active badge | Status active nicht grün oder pill (`999px`) |
| CRM-03 | Detail tabs | Tablist als Stadium-Pill statt `.crm-tablist` underline |
| CRM-04 | Empty Kunden | Fake-Datenzeilen statt leerer Tabelle + CTA |

## <!-- Feature area -->

| ID | Case | Fail if |
|----|------|---------|
| | | |
