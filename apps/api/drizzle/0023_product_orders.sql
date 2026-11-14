-- Product order templates + concrete orders (A-numbers from 100100).
-- Idempotent — migrate.ts re-runs every SQL file on each boot.

CREATE TABLE IF NOT EXISTS product_order_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  title varchar(200) NOT NULL DEFAULT '',
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS product_order_templates_biz_product_uidx
  ON product_order_templates (business_id, product_id);

CREATE INDEX IF NOT EXISTS product_order_templates_business_idx
  ON product_order_templates (business_id);

CREATE TABLE IF NOT EXISTS product_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_number integer NOT NULL,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  status varchar(16) NOT NULL DEFAULT 'draft',
  title varchar(200) NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  currency varchar(3) NOT NULL DEFAULT 'EUR',
  notes text,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS product_orders_biz_number_uidx
  ON product_orders (business_id, order_number);

CREATE INDEX IF NOT EXISTS product_orders_business_idx
  ON product_orders (business_id);

CREATE INDEX IF NOT EXISTS product_orders_customer_idx
  ON product_orders (customer_id);

CREATE INDEX IF NOT EXISTS product_orders_product_idx
  ON product_orders (product_id);
