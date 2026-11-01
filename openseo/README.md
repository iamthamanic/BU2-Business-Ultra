# OpenSEO integration (BU2)

## Pin

Use the standalone image, pinned by digest (update after verifying upstream):

```yaml
# openseo/docker-compose.yml
image: ghcr.io/every-app/open-seo-standalone@sha256:REPLACE_WITH_VERIFIED_DIGEST
```

Do **not** run `latest` in production. Document the digest in GitHub Actions secrets as `OPENSEO_IMAGE_DIGEST` when deploying.

## Auth model (product decisions)

- BU keeps its own Brevo magic-link / OTP login (Q-040 B).
- OpenSEO is launched as the **original app** (no iframe) with a short-lived SSO handoff (Q-003, Q-035).
- Each BU user gets a separate OpenSEO identity with actor-scoped audit (Q-046).
- Editors with `seo.open` may research / analyze / audit / edit reports across **all projects of that business** (Q-050 A, Q-051 A).
- Editors may **not** manage team, credentials, global integrations, budgets, or irreversible deletes.

## Fork / patch path

Upstream `every-app/open-seo` does not ship a ready BU SSO bridge. V1 requires:

1. A consumer endpoint (see `SSO_CONTRACT.md`) that accepts a one-time handoff token.
2. Mapping BU roles → OpenSEO roles without granting unscoped admin to editors.
3. Mutation audit stamped with the BU user / OpenSEO identity.

Until the fork is wired, BU exposes:

- `POST /api/b/:slug/openseo/provision` — capacity-aware stub
- `POST /api/b/:slug/openseo/handoff` — creates one-time token + launch URL

## Local compose

```bash
docker compose -f openseo/docker-compose.yml up -d
```

Requires ≥4 GiB Docker RAM per upstream docs.
