-- Contacts SoR: rename customers → contacts; add dual roles + partner number/category/status.
-- Idempotent — migrate.ts re-runs every SQL file on each boot.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'customers'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'contacts'
  ) THEN
    ALTER TABLE customers RENAME TO contacts;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'customers_biz_number_uidx')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'contacts_biz_customer_number_uidx') THEN
    ALTER INDEX customers_biz_number_uidx RENAME TO contacts_biz_customer_number_uidx;
  END IF;
END $$;

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS is_customer boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_partner boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS partner_category varchar(80),
  ADD COLUMN IF NOT EXISTS partner_status varchar(24) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS partner_number integer;

-- Existing rows remain customers; partners opt-in later.
UPDATE contacts
SET is_customer = true
WHERE is_customer IS DISTINCT FROM true;

-- Partner-only contacts may omit K- number; keep numbers when role is removed (history).
ALTER TABLE contacts
  ALTER COLUMN customer_number DROP NOT NULL;

DROP INDEX IF EXISTS contacts_biz_customer_number_uidx;
DROP INDEX IF EXISTS customers_biz_number_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS contacts_biz_customer_number_uidx
  ON contacts (business_id, customer_number)
  WHERE customer_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS contacts_biz_partner_number_uidx
  ON contacts (business_id, partner_number)
  WHERE partner_number IS NOT NULL;

ALTER TABLE contacts
  DROP CONSTRAINT IF EXISTS contacts_role_chk;

ALTER TABLE contacts
  ADD CONSTRAINT contacts_role_chk CHECK (is_customer OR is_partner);
