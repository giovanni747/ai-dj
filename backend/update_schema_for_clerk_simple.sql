-- ========================================
-- CLERK CHAT HISTORY SCHEMA UPDATE (NO NEON AUTH)
-- Run this in Neon Console SQL Editor
-- ========================================
-- This version works WITHOUT Neon Auth - just uses Clerk IDs directly

-- 1. CLEAR EXISTING DATA (fresh start with Clerk IDs)
-- ⚠️ WARNING: This deletes all existing messages, feedback, and likes
TRUNCATE TABLE track_likes, message_feedback, chat_messages CASCADE;

-- 2. UPDATE CHAT_MESSAGES TABLE
-- Add clerk_id column if it doesn't exist
ALTER TABLE chat_messages 
  ADD COLUMN IF NOT EXISTS clerk_id TEXT;

-- Drop old user_id column (if it exists)
ALTER TABLE chat_messages 
  DROP COLUMN IF EXISTS user_id CASCADE;

-- Make clerk_id required (NOT NULL)
ALTER TABLE chat_messages 
  ALTER COLUMN clerk_id SET NOT NULL;

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_clerk_id_created 
  ON chat_messages(clerk_id, created_at DESC);

-- 3. UPDATE MESSAGE_FEEDBACK TABLE
-- Add clerk_id column if it doesn't exist
ALTER TABLE message_feedback 
  ADD COLUMN IF NOT EXISTS clerk_id TEXT;

-- Drop old user_id column (if it exists)
ALTER TABLE message_feedback 
  DROP COLUMN IF EXISTS user_id CASCADE;

-- Make clerk_id required
ALTER TABLE message_feedback 
  ALTER COLUMN clerk_id SET NOT NULL;

-- Update unique constraint to use clerk_id instead of user_id
ALTER TABLE message_feedback
  DROP CONSTRAINT IF EXISTS message_feedback_message_id_user_id_key,
  DROP CONSTRAINT IF EXISTS message_feedback_pkey;
  
-- Re-add unique constraint with clerk_id
ALTER TABLE message_feedback
  ADD CONSTRAINT message_feedback_message_id_clerk_id_key 
  UNIQUE(message_id, clerk_id);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_message_feedback_clerk_id 
  ON message_feedback(clerk_id);

-- 4. UPDATE TRACK_LIKES TABLE
-- Add clerk_id column if it doesn't exist
ALTER TABLE track_likes 
  ADD COLUMN IF NOT EXISTS clerk_id TEXT;

-- Drop old user_id column (if it exists)
ALTER TABLE track_likes 
  DROP COLUMN IF EXISTS user_id CASCADE;

-- Make clerk_id required
ALTER TABLE track_likes 
  ALTER COLUMN clerk_id SET NOT NULL;

-- Update unique constraint to use clerk_id instead of user_id
ALTER TABLE track_likes
  DROP CONSTRAINT IF EXISTS track_likes_user_id_track_id_key,
  DROP CONSTRAINT IF EXISTS track_likes_pkey;
  
-- Re-add unique constraint with clerk_id
ALTER TABLE track_likes
  ADD CONSTRAINT track_likes_clerk_id_track_id_key 
  UNIQUE(clerk_id, track_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_track_likes_clerk_id 
  ON track_likes(clerk_id, created_at DESC);

-- 5. DROP OLD USERS TABLE (no longer needed)
DROP TABLE IF EXISTS users CASCADE;

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Verify chat_messages structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'chat_messages'
ORDER BY ordinal_position;

-- Verify indexes
SELECT 
  schemaname, 
  tablename, 
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND (indexname LIKE '%clerk%' OR indexname LIKE '%message%' OR indexname LIKE '%track%')
ORDER BY tablename, indexname;

-- Verify tables are empty
SELECT 'chat_messages' AS table_name, COUNT(*) AS row_count FROM chat_messages
UNION ALL
SELECT 'message_feedback', COUNT(*) FROM message_feedback
UNION ALL
SELECT 'track_likes', COUNT(*) FROM track_likes;

-- ========================================
-- SUCCESS!
-- ========================================
-- Schema is updated and ready for Clerk IDs!
-- No Neon Auth required - just use Clerk IDs directly as TEXT

