-- Integration Core: multi-account connections (separate from settings_secrets)

CREATE TABLE IF NOT EXISTS connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  provider varchar(40) NOT NULL,
  auth_method varchar(32) NOT NULL,
  external_account_id varchar(160) NOT NULL,
  display_name varchar(160),
  status varchar(24) NOT NULL DEFAULT 'pending',
  account_type varchar(80),
  health jsonb NOT NULL DEFAULT '{}'::jsonb,
  capabilities_cache jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS connections_biz_provider_ext_uidx
  ON connections (business_id, provider, external_account_id);

CREATE TABLE IF NOT EXISTS connection_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  kind varchar(40) NOT NULL,
  ciphertext text NOT NULL,
  iv text NOT NULL,
  tag text NOT NULL,
  key_hint varchar(12),
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS connection_credentials_conn_kind_uidx
  ON connection_credentials (connection_id, kind);

CREATE TABLE IF NOT EXISTS module_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  module varchar(40) NOT NULL,
  purpose varchar(40) NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS module_bindings_conn_mod_purpose_uidx
  ON module_bindings (connection_id, module, purpose);

CREATE TABLE IF NOT EXISTS sync_cursors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  stream varchar(80) NOT NULL,
  cursor text NOT NULL DEFAULT '',
  renewed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sync_cursors_conn_stream_uidx
  ON sync_cursors (connection_id, stream);
