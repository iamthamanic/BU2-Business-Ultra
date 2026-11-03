-- Structured postal + billing address on customers

ALTER TABLE customers ADD COLUMN IF NOT EXISTS street varchar(200);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS postal_code varchar(32);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS city varchar(120);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS country varchar(120);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS billing_street varchar(200);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS billing_postal_code varchar(32);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS billing_city varchar(120);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS billing_country varchar(120);
