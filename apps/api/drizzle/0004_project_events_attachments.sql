-- Project board lane order, activity feed, task attachments

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS board_lane_order jsonb DEFAULT NULL;

CREATE TABLE IF NOT EXISTS project_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type varchar(64) NOT NULL,
  summary text NOT NULL DEFAULT '',
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_events_project_idx ON project_events (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  filename varchar(255) NOT NULL,
  mime_type varchar(120) NOT NULL,
  size_bytes integer NOT NULL DEFAULT 0,
  storage_path text NOT NULL,
  created_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS task_attachments_task_idx ON task_attachments (task_id);
CREATE INDEX IF NOT EXISTS task_attachments_business_idx ON task_attachments (business_id);
