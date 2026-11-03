-- Customer birth date + optional photo URL

ALTER TABLE customers ADD COLUMN IF NOT EXISTS birth_date date;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS photo_url text;
