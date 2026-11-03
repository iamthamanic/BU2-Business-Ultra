-- Customer note replies (one-level threading)

ALTER TABLE customer_notes
  ADD COLUMN IF NOT EXISTS parent_note_id uuid REFERENCES customer_notes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS customer_notes_parent_idx ON customer_notes (parent_note_id);
