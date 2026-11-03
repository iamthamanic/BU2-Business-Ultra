-- Project start date (Zieltermin remains due_at)

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS start_at timestamptz;
