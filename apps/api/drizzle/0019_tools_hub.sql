-- Tools hub: membership grants + tenant tool installs; remove CheckMap

ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS grant_tools_use boolean NOT NULL DEFAULT false;
ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS grant_tools_manage boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS tool_installs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  manifest_id varchar(80) NOT NULL,
  name varchar(120) NOT NULL,
  entry_url text NOT NULL,
  icon_key varchar(40) NOT NULL DEFAULT 'puzzle',
  scopes jsonb NOT NULL DEFAULT '{}'::jsonb,
  kind varchar(24) NOT NULL DEFAULT 'custom',
  created_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, manifest_id)
);

CREATE INDEX IF NOT EXISTS tool_installs_business_idx ON tool_installs (business_id);

DROP TABLE IF EXISTS checkmap_attachments;
DROP TABLE IF EXISTS checkmap_boards;
