-- Finance SoR: accounts, transactions, per-business settings.
-- Idempotent — migrate.ts re-runs every SQL file on each boot.

CREATE TABLE IF NOT EXISTS finance_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL,
  iban varchar(34),
  bank_name varchar(120),
  currency varchar(3) NOT NULL DEFAULT 'EUR',
  balance_cents integer NOT NULL DEFAULT 0,
  connection_id uuid REFERENCES connections(id) ON DELETE SET NULL,
  source varchar(24) NOT NULL DEFAULT 'manual',
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS finance_accounts_business_idx
  ON finance_accounts (business_id);

CREATE UNIQUE INDEX IF NOT EXISTS finance_accounts_biz_iban_uidx
  ON finance_accounts (business_id, iban)
  WHERE iban IS NOT NULL;

CREATE TABLE IF NOT EXISTS finance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES finance_accounts(id) ON DELETE CASCADE,
  booked_on date NOT NULL,
  name varchar(200) NOT NULL,
  description text NOT NULL DEFAULT '',
  category varchar(80) NOT NULL DEFAULT 'Sonstiges',
  project_label varchar(160),
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  status varchar(16) NOT NULL DEFAULT 'paid',
  kind varchar(16) NOT NULL,
  source varchar(80) NOT NULL DEFAULT 'manual',
  amount_cents integer NOT NULL,
  recurring boolean NOT NULL DEFAULT false,
  external_id varchar(160),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_tx_kind_chk CHECK (kind IN ('income', 'expense')),
  CONSTRAINT finance_tx_status_chk CHECK (status IN ('paid', 'overdue', 'planned')),
  CONSTRAINT finance_tx_amount_chk CHECK (amount_cents >= 0)
);

CREATE INDEX IF NOT EXISTS finance_tx_business_idx
  ON finance_transactions (business_id);

CREATE INDEX IF NOT EXISTS finance_tx_account_idx
  ON finance_transactions (account_id);

CREATE INDEX IF NOT EXISTS finance_tx_booked_idx
  ON finance_transactions (business_id, booked_on DESC);

CREATE UNIQUE INDEX IF NOT EXISTS finance_tx_biz_external_uidx
  ON finance_transactions (business_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS finance_settings (
  business_id uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  tax_reserve_cents integer NOT NULL DEFAULT 0,
  ops_buffer_current_cents integer NOT NULL DEFAULT 0,
  ops_buffer_target_cents integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
