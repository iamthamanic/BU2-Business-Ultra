-- Product SoR for Product UI (description + calc + persona links)
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
