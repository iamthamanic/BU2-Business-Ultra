-- Omnichannel Inbox tables + outbox (Telegram E2E step 02)

CREATE TABLE IF NOT EXISTS contact_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  kind varchar(40) NOT NULL,
  value varchar(320) NOT NULL,
  display_name varchar(200),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  confidence varchar(16) NOT NULL DEFAULT 'medium',
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS contact_identities_biz_kind_value_uidx
  ON contact_identities (business_id, kind, value);

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  channel varchar(32) NOT NULL,
  external_thread_id varchar(160) NOT NULL,
  title varchar(200),
  status varchar(24) NOT NULL DEFAULT 'open',
  assignee_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  contact_identity_id uuid REFERENCES contact_identities(id) ON DELETE SET NULL,
  last_message_at timestamptz,
  last_preview varchar(280),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS conversations_conn_thread_uidx
  ON conversations (connection_id, external_thread_id);

CREATE INDEX IF NOT EXISTS conversations_business_last_idx
  ON conversations (business_id, last_message_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  direction varchar(16) NOT NULL,
  provider_message_id varchar(200) NOT NULL,
  body_text text NOT NULL DEFAULT '',
  delivery_status varchar(24) NOT NULL DEFAULT 'received',
  error_detail varchar(500),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  raw jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS messages_conn_provider_msg_uidx
  ON messages (connection_id, provider_message_id);

CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON messages (conversation_id, created_at);

CREATE TABLE IF NOT EXISTS outbox_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  kind varchar(40) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(24) NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  last_error varchar(500),
  provider_ref varchar(200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outbox_jobs_pending_idx
  ON outbox_jobs (status, next_run_at)
  WHERE status IN ('pending', 'processing');
