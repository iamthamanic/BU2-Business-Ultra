-- Person first/last name + optional employer org link

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS first_name varchar(100);

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS last_name varchar(100);

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS org_customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS customers_org_customer_idx ON customers (org_customer_id);

-- Backfill names from display_name for person records (best-effort)
UPDATE customers
SET
  first_name = COALESCE(
    first_name,
    NULLIF(split_part(trim(display_name), ' ', 1), '')
  ),
  last_name = COALESCE(
    last_name,
    NULLIF(
      trim(substring(trim(display_name) from length(split_part(trim(display_name), ' ', 1)) + 1)),
      ''
    )
  )
WHERE kind = 'person'
  AND (first_name IS NULL OR last_name IS NULL);
