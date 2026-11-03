-- Business Ultra 2 bootstrap schema (idempotent)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(320) NOT NULL UNIQUE,
  display_name varchar(160),
  password_hash text,
  is_superadmin boolean NOT NULL DEFAULT false,
  is_breakglass_operator boolean NOT NULL DEFAULT false,
  locale varchar(8) NOT NULL DEFAULT 'de',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS auth_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(320) NOT NULL,
  token_hash text NOT NULL,
  otp_hash text,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  slug varchar(64) NOT NULL UNIQUE,
  status varchar(16) NOT NULL DEFAULT 'active',
  logo_path text,
  styleguide jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(id),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS styleguide jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role varchar(16) NOT NULL,
  grant_seo_open boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id)
);

CREATE TABLE IF NOT EXISTS invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  email varchar(320) NOT NULL,
  role varchar(16) NOT NULL,
  token_hash text NOT NULL,
  invited_by_user_id uuid REFERENCES users(id),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  provider varchar(40) NOT NULL,
  ciphertext text NOT NULL,
  iv text NOT NULL,
  tag text NOT NULL,
  key_hint varchar(12),
  valid boolean NOT NULL DEFAULT false,
  last_checked_at timestamptz,
  updated_by_user_id uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, provider)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid,
  actor_user_id uuid,
  action varchar(80) NOT NULL,
  resource_ref varchar(200),
  status varchar(40) NOT NULL DEFAULT 'ok',
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalog_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name varchar(200) NOT NULL,
  sku varchar(80),
  description text,
  currency varchar(3) NOT NULL DEFAULT 'EUR',
  net_price_cents integer NOT NULL DEFAULT 0,
  tax_rate_bps integer NOT NULL DEFAULT 1900,
  active boolean NOT NULL DEFAULT true,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS social_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title varchar(200) NOT NULL,
  master_text text NOT NULL DEFAULT '',
  variants jsonb NOT NULL DEFAULT '[]'::jsonb,
  remote_status jsonb DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(id),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ads_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  provider varchar(40) NOT NULL,
  name varchar(200) NOT NULL,
  budget_daily_cents integer,
  objective varchar(120),
  payload jsonb DEFAULT '{}'::jsonb,
  remote_id varchar(120),
  status varchar(40) NOT NULL DEFAULT 'draft',
  created_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cmb_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name varchar(200) NOT NULL,
  model jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cmb_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  model_id uuid NOT NULL REFERENCES cmb_models(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS checkmap_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title varchar(200) NOT NULL,
  nodes jsonb NOT NULL DEFAULT '[]'::jsonb,
  edges jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS checkmap_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  board_id uuid NOT NULL REFERENCES checkmap_boards(id) ON DELETE CASCADE,
  node_id varchar(80),
  filename varchar(255) NOT NULL,
  mime_type varchar(120) NOT NULL,
  size_bytes integer NOT NULL,
  storage_path text NOT NULL,
  created_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  summary text,
  goals jsonb DEFAULT '[]'::jsonb,
  pains jsonb DEFAULT '[]'::jsonb,
  channels jsonb DEFAULT '[]'::jsonb,
  journey jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS openseo_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  status varchar(40) NOT NULL DEFAULT 'not_provisioned',
  base_url text,
  provision_meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS openseo_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  openseo_user_ref varchar(120) NOT NULL,
  role_mapped varchar(40) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id)
);

CREATE TABLE IF NOT EXISTS openseo_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS brevo_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name varchar(200) NOT NULL,
  subject varchar(300),
  html_content text,
  status varchar(40) NOT NULL DEFAULT 'draft',
  remote_id varchar(120),
  created_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS business_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  provider varchar(40) NOT NULL,
  external_id varchar(120) NOT NULL,
  label varchar(160),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, provider, external_id)
);

CREATE TABLE IF NOT EXISTS funnel_bindings (
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  surface varchar(80) NOT NULL,
  provider varchar(40) NOT NULL DEFAULT 'metricool',
  integration_id uuid REFERENCES business_integrations(id) ON DELETE SET NULL,
  status varchar(24) NOT NULL DEFAULT 'active',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, surface)
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name varchar(200) NOT NULL,
  description text NOT NULL DEFAULT '',
  market varchar(8) NOT NULL DEFAULT 'b2b',
  cover_path text,
  currency varchar(3) NOT NULL DEFAULT 'EUR',
  selling_price_cents integer NOT NULL DEFAULT 0,
  price_kind varchar(8) NOT NULL DEFAULT 'gross',
  tax_rate_bps integer NOT NULL DEFAULT 1900,
  cost_positions jsonb NOT NULL DEFAULT '[]'::jsonb,
  persona_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  persona_draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  journey_canvas jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_business_idx ON products (business_id);

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  kind varchar(16) NOT NULL DEFAULT 'person',
  display_name varchar(200) NOT NULL,
  email varchar(320),
  phone varchar(64),
  address text,
  street varchar(200),
  postal_code varchar(32),
  city varchar(120),
  country varchar(120),
  billing_street varchar(200),
  billing_postal_code varchar(32),
  billing_city varchar(120),
  billing_country varchar(120),
  relation_status varchar(24) NOT NULL DEFAULT 'lead',
  birth_date date,
  photo_url text,
  buyer_persona_id uuid REFERENCES personas(id) ON DELETE SET NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customers_business_idx ON customers (business_id);

CREATE TABLE IF NOT EXISTS business_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  scope varchar(24) NOT NULL DEFAULT 'customer',
  name varchar(40) NOT NULL,
  color varchar(16),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Existing installs may have created the table before `scope` existed.
ALTER TABLE business_tags ADD COLUMN IF NOT EXISTS scope varchar(24) NOT NULL DEFAULT 'customer';
DROP INDEX IF EXISTS business_tags_biz_name_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS business_tags_biz_scope_name_uidx ON business_tags (business_id, scope, name);

CREATE TABLE IF NOT EXISTS customer_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  label varchar(200) NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  currency varchar(3) NOT NULL DEFAULT 'EUR',
  purchased_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_purchases_customer_idx ON customer_purchases (customer_id);
CREATE INDEX IF NOT EXISTS customer_purchases_business_idx ON customer_purchases (business_id);

CREATE TABLE IF NOT EXISTS customer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  purpose varchar(120) NOT NULL,
  channel varchar(40) NOT NULL DEFAULT 'email',
  granted_at timestamptz,
  revoked_at timestamptz,
  evidence text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  type varchar(64) NOT NULL,
  summary text NOT NULL DEFAULT '',
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type varchar(16) NOT NULL DEFAULT 'custom',
  name varchar(200) NOT NULL,
  description text NOT NULL DEFAULT '',
  area varchar(120),
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  member_user_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  status varchar(24) NOT NULL DEFAULT 'planned',
  start_at timestamptz,
  due_at timestamptz,
  parent_area_project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  board_lane_order jsonb DEFAULT NULL,
  archived_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS projects_business_idx ON projects (business_id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS member_user_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_at timestamptz;

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  title varchar(300) NOT NULL,
  description text NOT NULL DEFAULT '',
  status varchar(24) NOT NULL DEFAULT 'open',
  priority varchar(16) NOT NULL DEFAULT 'medium',
  assignee_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  due_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tasks_business_idx ON tasks (business_id);

CREATE TABLE IF NOT EXISTS task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title varchar(300) NOT NULL,
  done boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type varchar(64) NOT NULL,
  summary text NOT NULL DEFAULT '',
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_events_project_idx ON project_events (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  filename varchar(255) NOT NULL,
  mime_type varchar(120) NOT NULL,
  size_bytes integer NOT NULL DEFAULT 0,
  storage_path text NOT NULL,
  created_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS task_attachments_task_idx ON task_attachments (task_id);

CREATE TABLE IF NOT EXISTS recurrence_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  title varchar(300) NOT NULL,
  description text NOT NULL DEFAULT '',
  priority varchar(16) NOT NULL DEFAULT 'medium',
  assignee_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  freq varchar(16) NOT NULL DEFAULT 'weekly',
  weekday integer,
  month_day integer,
  timezone varchar(64) NOT NULL DEFAULT 'Europe/Berlin',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  paused_at timestamptz,
  next_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES recurrence_rules(id) ON DELETE CASCADE,
  scheduled_for timestamptz NOT NULL,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_id, scheduled_for)
);
