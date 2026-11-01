-- Password auth: bcrypt hash on users (nullable for OTP-only accounts)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;
