-- ========================================
-- CLERK CHAT HISTORY SCHEMA UPDATE
-- Run this in Neon Console SQL Editor
-- ========================================

-- IMPORTANT: Make sure Neon Auth is enabled first!
-- Go to: Neon Console → Settings → Auth → Enable Neon Auth → Select Clerk

-- 1. CLEAR EXISTING DATA (fresh start with Clerk IDs)
-- ⚠️ WARNING: This deletes all existing messages, feedback, and likes
TRUNCATE TABLE track_likes, message_feedback, chat_messages CASCADE;

-- 2. UPDATE CHAT_MESSAGES TABLE
-- Remove old Spotify user_id column, make clerk_id required
ALTER TABLE chat_messages 
  DROP COLUMN IF EXISTS user_id CASCADE,
  ALTER COLUMN clerk_id SET NOT NULL;

-- Add foreign key to neon_auth.users_sync (created by Neon Auth)
ALTER TABLE chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_clerk_id_fk,
  ADD CONSTRAINT chat_messages_clerk_id_fk
  FOREIGN KEY (clerk_id) 
  REFERENCES neon_auth.users_sync(id)
  ON DELETE CASCADE;

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_clerk_id_created 
  ON chat_messages(clerk_id, created_at DESC);

-- 3. UPDATE MESSAGE_FEEDBACK TABLE
ALTER TABLE message_feedback 
  DROP COLUMN IF EXISTS user_id CASCADE,
  ALTER COLUMN clerk_id SET NOT NULL;

ALTER TABLE message_feedback
  DROP CONSTRAINT IF EXISTS message_feedback_clerk_id_fk,
  ADD CONSTRAINT message_feedback_clerk_id_fk
  FOREIGN KEY (clerk_id)
  REFERENCES neon_auth.users_sync(id)
  ON DELETE CASCADE;

-- 4. UPDATE TRACK_LIKES TABLE
ALTER TABLE track_likes 
  DROP COLUMN IF EXISTS user_id CASCADE,
  ALTER COLUMN clerk_id SET NOT NULL;

ALTER TABLE track_likes
  DROP CONSTRAINT IF EXISTS track_likes_clerk_id_fk,
  ADD CONSTRAINT track_likes_clerk_id_fk
  FOREIGN KEY (clerk_id)
  REFERENCES neon_auth.users_sync(id)
  ON DELETE CASCADE;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_track_likes_clerk_id 
  ON track_likes(clerk_id, created_at DESC);

-- 5. DROP OLD USERS TABLE (no longer needed with Neon Auth)
DROP TABLE IF EXISTS users CASCADE;

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- 6. VERIFY FOREIGN KEYS
SELECT 
  tc.table_name, 
  tc.constraint_name, 
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_schema = 'public' 
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'clerk_id';

-- Expected: 3 rows (chat_messages, message_feedback, track_likes)

-- 7. VERIFY INDEXES
SELECT 
  schemaname, 
  tablename, 
  indexname, 
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE '%clerk%';

-- Expected: Multiple indexes with clerk_id

-- 8. VERIFY TABLES ARE EMPTY
SELECT 'chat_messages' AS table_name, COUNT(*) AS row_count FROM chat_messages
UNION ALL
SELECT 'message_feedback', COUNT(*) FROM message_feedback
UNION ALL
SELECT 'track_likes', COUNT(*) FROM track_likes;

-- Expected: All counts should be 0

-- 9. VERIFY NEON AUTH USER SYNC
SELECT * FROM neon_auth.users_sync;

-- Expected: Shows Clerk users (will be empty if no one has signed in yet)

-- ========================================
-- SUCCESS!
-- ========================================
-- If all verification queries passed:
-- ✅ Schema is updated
-- ✅ Foreign keys are in place
-- ✅ Old data is cleared
-- ✅ Ready to test with new Clerk users!

