# AGENTS.md — Business Ultra 2

Dieses Dokument ist die **verbindliche Projektkarte** für Menschen und KI-Agenten.
Lies es zuerst, bevor du Code änderst.

## Was ist dieses Projekt?

Business Ultra 2 (BU2) ist ein modularer Monolith für Marketing-, Produkt-, Kunden- und Projektarbeit: Dark-Ops UI (Vite/React), Fastify-API, Postgres. Multi-Tenant unter `/co/:slug/...`.

**Produktkontext:** [README.md](README.md), Entscheidungen: [DECISIONS.md](DECISIONS.md). PRD-Draft: [docs/PRD.md](docs/PRD.md) (aus bestehenden Docs abgeleitet — bei Bedarf schärfen).

**Verträge:** Architektur [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · Security [docs/SECURITY.md](docs/SECURITY.md) · Integrationen [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) · Operations [docs/OPERATIONS.md](docs/OPERATIONS.md) · UI [docs/UI_STYLEGUIDE.md](docs/UI_STYLEGUIDE.md). Vor Commit: `@audit-runner preflight` (Contract **plus** Quality-Chain: SOLID/KISS/DRY via `@audit-changes`, Spaghetti via ponytail, Boundaries via `@codebase-realignment`, UI-Reuse). Nur Docs: `contract-only`.

### Was dieses Repo **ist**

- Produktiv-App mit Web (`apps/web`), API (`apps/api`), Shared-Packages und Playwright-E2E
- Dark-Ops Design-System in `apps/web/src/styles/dark-ops.css` + [docs/UI_STYLEGUIDE.md](docs/UI_STYLEGUIDE.md)

### Was dieses Repo **nicht** ist

- Kein Next.js-/Vercel-only Stack; kein DaisyUI-Zwang trotz älterer User-Rules — hier gilt Dark-Ops + bestehende Komponenten

---

## Tech Stack (verbindlich)

| Bereich | Technologie | Notiz |
|---------|-------------|-------|
| Frontend | Vite + React + TypeScript | `apps/web`, Port 8741 |
| Backend | Fastify + Drizzle + Postgres 16 | `apps/api`, Port 8742 |
| Styling | Dark-Ops CSS (custom tokens) | kein Tailwind-Pflicht |
| Tests | Vitest (packages) + Playwright (`apps/e2e`) | |
| Package manager | pnpm workspaces | |

**Nicht verwenden:** Fremde Design-Systeme (shadcn/Material) ohne bewusste Migration; Secrets im Client-Bundle.

---

## Architektur

Kanonischer Vertrag: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** (`binding`, owner-approved). Kurzüberblick:

```
apps/web/          Dark-Ops shell, features (customer, projects, product, …)
apps/api/          Fastify modules + DB
apps/e2e/          Playwright
packages/shared/   Zod contracts
packages/finance-calc/
```

### Schichtenregeln

1. UI spricht nur Shared-Contracts / API-Client — keine SQL im Frontend
2. AuthZ serverseitig; Tenant-Slug aus Route, nicht aus Client-Trust — Details: [docs/SECURITY.md](docs/SECURITY.md)
3. Neue UI: bestehende Shell-/Product-/CRM-Klassen vor neuen One-offs
4. Provider/OAuth/Connections: [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md)
5. Betrieb/Backup/Deploy-Pointer: [docs/OPERATIONS.md](docs/OPERATIONS.md)

---

## Sprache & Naming

| Bereich | Sprache |
|---------|---------|
| UI (Labels, Fehler) | Deutsch (i18n DE/EN) |
| Code, Commits | Englisch |

---

## Validation

- **Checks:** `pnpm run checks` (lint + typecheck + web build)
- **Dev:** `pnpm dev` → http://127.0.0.1:8741
- **E2E:** `pnpm test:e2e`

Run checks before push. Do not bypass hooks.

---

## UI / Design

- Styleguide: [docs/UI_STYLEGUIDE.md](docs/UI_STYLEGUIDE.md)
- Radius: `--radius-xs` / `--radius-sm` / `--radius` — keine Pill-Status-Badges oder Pill-Tableisten
- Status `active` = grün (`--good`); Primary-Actions = `--accent`
- Required states: loading, empty, error, disabled where applicable

---

## Issue Template (verbindlich)

Alle Issues folgen dem kanonischen Template aus **`@issue-contract`**
(global: `~/.claude/skills/issue-contract/references/issue-template.md`).
Projekt-Override (nur bei Bedarf): `.qa/issue-template.md`.
Projekt-Werte: `.qa/project.yaml` → `issueContract`.

Pflicht-Sektionen in Reihenfolge: `Type → Intent → Goal → Non-Goals → Context → Scope → User Journey → Runtime → Security & Data → Edge Cases → Acceptance → Blockers → Runner`.

---

## Security Checklist (Secure by Default)

Diese Checkliste ist **techstack-agnostisch** und für alle Agents verbindlich.

Jede Feature-Implementierung muss die zutreffenden Sektionen abhaken. `@implement` dokumentiert die Coverage in der Acceptance-Datei, `@audit-changes`/`@ecc-check` führen diff-scoped Probes aus, `@review-ticket` prüft die Coverage im Verdict. Hop-Ketten zusätzlich über `@composition-gate` — FLAGGED muss gefixt werden.

### Frontend Security

| # | Maßnahme | Fail if |
|---|----------|---------|
| F-01 | HTTPS überall | App läuft ohne TLS oder mixed content |
| F-02 | Input-Validierung & Sanitization | Unvalidierter User-Input erreicht Render-/State-Schicht |
| F-03 | Keine sensiblen Daten im Browser | `localStorage.setItem('token'\|'secret'\|'password', …)` im Diff |
| F-04 | CSRF-Schutz | State-changing Request ohne CSRF-Token oder SameSite-Cookie |
| F-05 | API-Keys nie im Frontend | Secrets in Client-Bundle |

### Backend Security

| # | Maßnahme | Fail if |
|---|----------|---------|
| B-01 | Authentication Fundamentals | Eigenbau-Auth, Plaintext- oder schwache/unsalted Hashes |
| B-02 | Authorization Checks | Sensitive Operation ohne Rollen-/Owner-Check |
| B-03 | API-Endpoint-Schutz | Unauthentifizierter Endpoint auf geschützter Ressource |
| B-04 | SQL-Injection-Prävention | String-Konkatenation in SQL mit User-Input |
| B-05 | Basis Security Headers | Headers fehlen oder unsicher ohne Removal-Plan |
| B-06 | DDoS-Schutz | Rate-Limiting deaktiviert |
| B-07 | Least-privilege assignment | Actor kann mehr vergeben als er hält |
| B-08 | Deny-by-default AuthZ map | Unbekannter Pfad → Default-Read statt deny |
| B-09 | Trust-boundary identity | User-ID/Rollen aus Client-Headern |
| B-10 | Secrets fail-closed | `process.env.SECRET \|\| 'default-…'` |

### Practical Security Habits

| # | Maßnahme | Fail if |
|---|----------|---------|
| P-01 | Dependencies aktuell | High/Critical Audits offen |
| P-02 | Korrekte Fehlerbehandlung | Error enthält Stack/Secrets |
| P-03 | Secure Cookies | Session ohne HttpOnly/Secure in Prod |
| P-04 | File-Upload-Sicherheit | Upload ohne Type/Size-Validierung |
| P-05 | Rate Limiting | Auth ohne Rate-Limit |
| P-06 | Side-effect jobs / Outbox | Doppelte Sends / Claim-Bugs |

Critical-Verstöße blocken PR/READY. Important bis Fix.

---

## QA Pipeline

```
@pingpong-solution  →  @implement  →  @verify-ticket  →  @composition-gate  →  @verify-ui  →  @review-ticket
```

- Design artifacts: `.qa/design/`
- Acceptance: `.qa/acceptance/`
- Project config: `.qa/project.yaml`
- Living docs: `@memory-live-doc`
- Composition: `@composition-gate` — **FLAGGED must be fixed** before review/PR
- Performance (optional): `@test-performance-speed` when labeled `performance` — diagnose before optimizing; not a merge gate

---

## Development Workflow

### Context compact & long queues (mandatory)

Auto-compact is **unreliable**. Do **not** wait for the window to hard-fail.

**After every shipped issue** in a multi-ticket loop (`N>1`):

1. Update the handoff file with last merged issue/PR/SHA and next issue
2. **Stop the turn** and tell the user to run `/compact` (or fresh chat + handoff)
3. Resume the next ticket only **after** the user continues post-compact

**Never compact mid-implementation** of the current issue.

---

## Living documentation

After material changes, run `@memory-live-doc` (or rely on pipeline integration).

- Do not invent features in docs without evidence
- Storage: `.project-memory/`
- First setup: `@memory-live-doc bootstrap` (audit: draft then apply after OK)

---

## README

Keep README in sync when adding features, scripts, or env vars.
