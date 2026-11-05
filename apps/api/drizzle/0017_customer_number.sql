-- Per-business customer numbers: 6 digits starting at 100100

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS customer_number integer;

DO $$
DECLARE
  bid uuid;
  r RECORD;
  n integer;
BEGIN
  FOR bid IN SELECT DISTINCT business_id FROM customers LOOP
    n := 100100;
    FOR r IN
      SELECT id
      FROM customers
      WHERE business_id = bid
        AND customer_number IS NULL
      ORDER BY created_at ASC, id ASC
    LOOP
      WHILE EXISTS (
        SELECT 1 FROM customers
        WHERE business_id = bid AND customer_number = n
      ) LOOP
        n := n + 1;
      END LOOP;
      UPDATE customers SET customer_number = n WHERE id = r.id;
      n := n + 1;
    END LOOP;
  END LOOP;
END $$;

UPDATE customers
SET customer_number = 100100
WHERE customer_number IS NULL;

ALTER TABLE customers
  ALTER COLUMN customer_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customers_biz_number_uidx
  ON customers (business_id, customer_number);
