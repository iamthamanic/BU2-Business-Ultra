-- Side content (comments / checklist / attachments) on recurrence series + nullable task owner

ALTER TABLE task_comments
  ALTER COLUMN task_id DROP NOT NULL;
ALTER TABLE task_comments
  ADD COLUMN IF NOT EXISTS rule_id uuid REFERENCES recurrence_rules(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS task_comments_rule_idx ON task_comments (rule_id);

ALTER TABLE task_checklist_items
  ALTER COLUMN task_id DROP NOT NULL;
ALTER TABLE task_checklist_items
  ADD COLUMN IF NOT EXISTS rule_id uuid REFERENCES recurrence_rules(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS task_checklist_rule_idx ON task_checklist_items (rule_id);

ALTER TABLE task_attachments
  ALTER COLUMN task_id DROP NOT NULL;
ALTER TABLE task_attachments
  ADD COLUMN IF NOT EXISTS rule_id uuid REFERENCES recurrence_rules(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS task_attachments_rule_idx ON task_attachments (rule_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'task_comments_owner_chk'
  ) THEN
    ALTER TABLE task_comments
      ADD CONSTRAINT task_comments_owner_chk CHECK (
        (task_id IS NOT NULL AND rule_id IS NULL)
        OR (task_id IS NULL AND rule_id IS NOT NULL)
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'task_checklist_items_owner_chk'
  ) THEN
    ALTER TABLE task_checklist_items
      ADD CONSTRAINT task_checklist_items_owner_chk CHECK (
        (task_id IS NOT NULL AND rule_id IS NULL)
        OR (task_id IS NULL AND rule_id IS NOT NULL)
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'task_attachments_owner_chk'
  ) THEN
    ALTER TABLE task_attachments
      ADD CONSTRAINT task_attachments_owner_chk CHECK (
        (task_id IS NOT NULL AND rule_id IS NULL)
        OR (task_id IS NULL AND rule_id IS NOT NULL)
      );
  END IF;
END $$;
