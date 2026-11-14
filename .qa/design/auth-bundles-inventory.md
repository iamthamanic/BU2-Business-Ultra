# Auth / Bundles — SL-01 Inventory

Date: 2026-11-11

## Identity schema (Ist)

| Table | Path | Notes |
|-------|------|-------|
| `users` | `apps/api/src/db/schema/identity.ts` | email, passwordHash, isSuperadmin, isBreakglassOperator |
| `sessions` | same | bu2_session cookie via tokenHash |
| `auth_challenges` | same | magic link / OTP |
| `businesses` | same | tenant |
| `memberships` | same | role + grantSeoOpen/Use/Manage |
| `invites` | same | role-bound |

## AuthN call sites

| Area | Files |
|------|-------|
| Cookie session | `apps/api/src/plugins/auth.ts` |
| Login/OTP/logout/me | `apps/api/src/modules/auth/routes.ts`, `service.ts` |
| Web login | `apps/web/src/features/auth/LoginPage.tsx`, `VerifyPage.tsx` |
| OAuth session | `apps/api/src/modules/integrations/oauthRoutes.ts`, `lib/integrations/oauth/*` |

## AuthZ role/grant call sites (Soll → Permission Resolver)

| Package | Pattern |
|---------|---------|
| `packages/shared` | `canMutateContent`, `canManageMembers`, `canOpenSeo`, `canUseTools`, `canManageTools`, `canSendMail`, `canManageCredentials`, `resolveEntitledTabs`, `Role` |
| API modules | catalog, business, marketing, projects, settings, customers, inbox, finance, tools, ads, cmb, personas, sortanize, openseo, products, orders, tags, integrations |
| Web | SettingsTeamTab, BusinessShell, InboxPage, shells |

## FK dependents of `users.id`

crm, projects, inbox, tools, marketing, integrations, finance/orders (via businesses), audit actors — keep UUID continuity; Better Auth user.id = same UUID where possible.

## Superseded decisions

See `DECISIONS.md` § Auth Bundles (2026-11-11).
