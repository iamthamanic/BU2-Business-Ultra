# Acceptance — authz-module-fine-keys

## Intent

Replace coarse `canMutateContent` / membership-only GETs with catalog permission keys on CRM, Inbox, Projects, Marketing, Ads, Catalog/Products, Settings reads, Integrations list, plus tags/CMB/Sortanize companions.

## Happy Path

- GET customers / tags → `customers.read`; mutations → `customers.write`
- GET inbox → `inbox.read`; reply/sync → `inbox.send`; assign → `inbox.manage`; connect stays `canManageCredentials`
- Projects/tasks/recurrence: GET → `projects.read` (+ `assertProjectAccess`); mutations → `projects.write`
- Marketing: GET → `marketing.campaign.read`; drafts/styleguide/brevo create → `.write`; schedule/retry → `.publish`; Brevo send stays `mail.send`
- Ads: GET → `ads.campaign.read`; create/publish → `ads.campaign.write`
- Catalog/products: `.read` / `.write`
- Settings feature-gates/status/ready → `settings.read`; secrets stay credentials
- Integrations providers/list GETs → `integrations.connections.read`; manage stays credentials
- CMB: GET → `finance.read`; POST models/calculate → `finance.write`
- Sortanize: GET/preview → `tools.use`; match/run → `tools.manage`

## Security Coverage

- B-02/B-03/B-08: fine keys deny-by-default per module (finance pattern)
- Project team visibility still ANDed with `projects.read`/`projects.write`

## Implementation Notes

- No new permission keys; finance routes untouched; no UI
- Orders → `products.read`/`products.write`; Personas → `marketing.campaign.read`/`write`
- Administration system template gains `catalog.*` + `products.*` for new tenants
- Mapping documented in `apps/api/src/lib/authorize.test.ts`
- `canMutateContent` removed from API modules (helper may remain in shared for UI until #19)
