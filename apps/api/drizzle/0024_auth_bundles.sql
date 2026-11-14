-- Auth / Bundles Phase-1 — Better Auth tables + membership hard-cut (idempotent)

-- Better Auth core
CREATE TABLE IF NOT EXISTS "user" (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email varchar(320) NOT NULL UNIQUE,
  email_verified boolean NOT NULL DEFAULT false,
  image text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "session" (
  id uuid PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "account" (
  id uuid PRIMARY KEY,
  account_id text NOT NULL,
  provider_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "verification" (
  id uuid PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Align users profile table with Better Auth ids (drop default random if present)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS image text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status varchar(16) NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Membership hard-cut columns
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS status varchar(16) NOT NULL DEFAULT 'active';

-- Backfill owners from legacy role before drop
UPDATE memberships SET is_owner = true WHERE role = 'owner';

-- Platform grants
CREATE TABLE IF NOT EXISTS platform_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  capability_key varchar(100) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES users(id),
  UNIQUE (user_id, capability_key)
);

-- Bundles
CREATE TABLE IF NOT EXISTS permission_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  key varchar(64),
  name varchar(120) NOT NULL,
  description varchar(500),
  is_system boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS permission_bundles_biz_key_uidx
  ON permission_bundles (business_id, key);

CREATE TABLE IF NOT EXISTS bundle_permissions (
  bundle_id uuid NOT NULL REFERENCES permission_bundles(id) ON DELETE CASCADE,
  permission_key varchar(160) NOT NULL,
  PRIMARY KEY (bundle_id, permission_key)
);

CREATE TABLE IF NOT EXISTS membership_bundles (
  membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  bundle_id uuid NOT NULL REFERENCES permission_bundles(id) ON DELETE CASCADE,
  PRIMARY KEY (membership_id, bundle_id)
);

-- Invites: bundle_ids instead of role
ALTER TABLE invites ADD COLUMN IF NOT EXISTS bundle_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Drop legacy ACL columns when present
ALTER TABLE memberships DROP COLUMN IF EXISTS role;
ALTER TABLE memberships DROP COLUMN IF EXISTS grant_seo_open;
ALTER TABLE memberships DROP COLUMN IF EXISTS grant_tools_use;
ALTER TABLE memberships DROP COLUMN IF EXISTS grant_tools_manage;
ALTER TABLE invites DROP COLUMN IF EXISTS role;
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;
