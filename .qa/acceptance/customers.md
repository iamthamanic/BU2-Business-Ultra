# Feature: Kunden (CRM)

## Intent
Business-scoped CRM: list, create/edit/archive, five tabs (Übersicht, Profil, Kommunikation, Verlauf, Vorgänge). No fake messages/orders.

## Preconditions
- Authenticated member with `customer` tab entitlement
- Editor+ for writes

## Happy Path
- [ ] Open Kunden → empty or list; search/filter
- [ ] Create customer (name required) → appears in list
- [ ] Open detail → Übersicht/Profil editable notes/tags/status/consent
- [ ] Kommunikation: channel empty + manual contact log
- [ ] Verlauf: CRM-internal events only
- [ ] Vorgänge: only real linked project tasks (or empty)
- [ ] Soft-archive + restore

## Edge Cases
- [ ] Viewer read-only
- [ ] Cross-tenant customer ID → 404
- [ ] Unconnected channels never invent messages

## Assumptions
- Soft archive (`archived_at`); person/org via `kind`
