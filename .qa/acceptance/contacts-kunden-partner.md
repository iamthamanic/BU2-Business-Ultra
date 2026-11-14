# Feature: Kontakte — Kunden + Partner

## Intent
Bestehende Kundenverwaltung zu Kontaktverwaltung erweitern: Nav „Kontakte“, Tabs Kunden/Partner, dual roles, K-/P-Nummern, Partnerkategorie.

## Preconditions
- Business mit Membership vorhanden
- Migration `0020_contacts_roles.sql` angewandt (`customers` → `contacts`)
- Bestehende Kunden-Rows haben `is_customer=true`

## Happy Path
- [x] Nav heißt „Kontakte“ und öffnet `/co/:slug/contacts` (browser)
- [x] Tabs „Kunden“ und „Partner“ vorhanden; letzter Tab via localStorage
- [x] Bestehende Kunden erscheinen unter Tab Kunden (browser: Ada Kunde / K-100100)
- [x] Neuer Kunde anlegbar (Rolle Kunde) — browser create → detail
- [x] Neuer Partner anlegbar (Rolle Partner + Kategorie → `P-…`)
- [x] Kontakt kann Kunde+Partner sein und in beiden Tabs erscheinen (Ada: K-100100 + P-100101)
- [x] Rollen im Detail editierbar ohne Datenverlust (Partner-Rolle + Kategorie Agentur gespeichert)
- [x] Nummern: K-/P-… für Rollen (browser + API)
- [x] `/co/:slug/customer` redirectet auf `/contacts`
- [x] API role filter used by tabs (`role=partner|customer`)
- [x] Reine Partner nicht in Kunden-Tab
- [x] Header-CTA: „Kunde anlegen“ / „Partner anlegen“; Status-Select entfernt
- [x] Create-Modal Rollen folgen aktivem Tab (`key={tab}` + reset on open)

## Edge Cases
- [x] Mindestens eine Rolle erforderlich (unit: CustomerSchema / Patch)
- [x] Partner-only: P-number gesetzt (browser)
- [x] Tenant-Isolation: Membership + businessId (code review)
- [x] Archiv/Restore — API + list filters (archive hides from active; restore returns)

## Composition Gate
CLEAR — `.qa/runs/composition-gate-contacts-kunden-partner.md`

## Security
- B-02/B-03: Membership + canMutateContent auf Mutationen
- B-04: Drizzle parameterized queries
- F-02: Zod CustomerSchema / CustomerPatchSchema
- B-10: Presence-Checks ohne `env || ''` Secret-Defaults (Ads/Brevo/finAPI/OAuth trim helpers)
