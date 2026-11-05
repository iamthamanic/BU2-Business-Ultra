-- Relative reminders before task due / recurrence next (Google Calendar style)

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS reminders jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE recurrence_rules
  ADD COLUMN IF NOT EXISTS reminders jsonb NOT NULL DEFAULT '[]'::jsonb;
