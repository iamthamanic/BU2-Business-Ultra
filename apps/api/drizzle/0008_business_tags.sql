-- Company-wide CRM tag catalog

CREATE TABLE IF NOT EXISTS business_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name varchar(40) NOT NULL,
  color varchar(16),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS business_tags_biz_name_uidx ON business_tags (business_id, name);
