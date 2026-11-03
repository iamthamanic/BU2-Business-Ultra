-- Customer stats: buyer persona + purchase lines (LTV source)

ALTER TABLE customers ADD COLUMN IF NOT EXISTS buyer_persona_id uuid REFERENCES personas(id) ON DELETE SET NULL;

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
