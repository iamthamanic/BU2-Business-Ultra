-- CRM customers + projects/tasks/recurrence

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  kind varchar(16) NOT NULL DEFAULT 'person',
  display_name varchar(200) NOT NULL,
  email varchar(320),
  phone varchar(64),
  address text,
  relation_status varchar(24) NOT NULL DEFAULT 'lead',
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customers_business_idx ON customers (business_id);
CREATE INDEX IF NOT EXISTS customers_business_status_idx ON customers (business_id, relation_status);

CREATE TABLE IF NOT EXISTS customer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_notes_customer_idx ON customer_notes (customer_id);

CREATE TABLE IF NOT EXISTS customer_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  purpose varchar(120) NOT NULL,
  channel varchar(40) NOT NULL DEFAULT 'email',
  granted_at timestamptz,
  revoked_at timestamptz,
  evidence text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_consents_customer_idx ON customer_consents (customer_id);

CREATE TABLE IF NOT EXISTS customer_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  type varchar(64) NOT NULL,
  summary text NOT NULL DEFAULT '',
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_events_customer_idx ON customer_events (customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type varchar(16) NOT NULL DEFAULT 'custom',
  name varchar(200) NOT NULL,
  description text NOT NULL DEFAULT '',
  area varchar(120),
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status varchar(24) NOT NULL DEFAULT 'planned',
  due_at timestamptz,
  parent_area_project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  archived_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS projects_business_idx ON projects (business_id);
CREATE INDEX IF NOT EXISTS projects_business_type_idx ON projects (business_id, type);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  title varchar(300) NOT NULL,
  description text NOT NULL DEFAULT '',
  status varchar(24) NOT NULL DEFAULT 'open',
  priority varchar(16) NOT NULL DEFAULT 'medium',
  assignee_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  due_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tasks_business_idx ON tasks (business_id);
CREATE INDEX IF NOT EXISTS tasks_project_idx ON tasks (project_id);
CREATE INDEX IF NOT EXISTS tasks_assignee_idx ON tasks (business_id, assignee_user_id);
CREATE INDEX IF NOT EXISTS tasks_customer_idx ON tasks (customer_id);

CREATE TABLE IF NOT EXISTS task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS task_comments_task_idx ON task_comments (task_id);

CREATE TABLE IF NOT EXISTS task_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title varchar(300) NOT NULL,
  done boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS task_checklist_task_idx ON task_checklist_items (task_id);

CREATE TABLE IF NOT EXISTS recurrence_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  title varchar(300) NOT NULL,
  description text NOT NULL DEFAULT '',
  priority varchar(16) NOT NULL DEFAULT 'medium',
  assignee_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  freq varchar(16) NOT NULL DEFAULT 'weekly',
  weekday integer,
  month_day integer,
  timezone varchar(64) NOT NULL DEFAULT 'Europe/Berlin',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  paused_at timestamptz,
  next_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS recurrence_rules_business_idx ON recurrence_rules (business_id);
CREATE INDEX IF NOT EXISTS recurrence_rules_next_idx ON recurrence_rules (business_id, next_at);

CREATE TABLE IF NOT EXISTS task_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES recurrence_rules(id) ON DELETE CASCADE,
  scheduled_for timestamptz NOT NULL,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_id, scheduled_for)
);
CREATE INDEX IF NOT EXISTS task_occurrences_rule_idx ON task_occurrences (rule_id);
