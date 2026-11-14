-- Inbox step 04: conversation unread counter for Ungelesen filter
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS unread_count integer NOT NULL DEFAULT 0;
