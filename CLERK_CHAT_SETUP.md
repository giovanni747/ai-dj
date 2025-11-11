# Clerk + Chat History Integration - Complete Setup Guide

## What We're Doing

We're integrating **Clerk authentication** with your chat history feature, so:
- ✅ Users can log in with Clerk (email, Google, etc.)
- ✅ Their chat messages are saved and persist across sessions
- ✅ Messages are tied to their Clerk user ID, not Spotify session
- ✅ When users log out and back in, their chat history is restored

## Architecture

```
User signs in with Clerk
    ↓
Frontend sends Clerk user ID in X-Clerk-User-Id header
    ↓
Backend saves messages with clerk_id
    ↓
Neon database stores messages tied to Clerk users
```

## Step 1: Enable Neon Auth (REQUIRED)

### Why?
Neon Auth automatically syncs Clerk users to your database, so you can:
- Join chat messages with user profiles
- Automatically clean up data when users are deleted
- Query user statistics easily

### How to Enable:

1. **Go to Neon Console**: https://console.neon.tech
2. **Select your project**: `ai-dj` database
3. **Go to Settings → Auth**
4. **Click "Enable Neon Auth"**
5. **Select "Clerk"** as your auth provider
6. **Provide your Clerk keys**:
   - Publishable Key: From your `.env` file (starts with `pk_`)
   - Secret Key: From your `.env` file (starts with `sk_`)

### What This Does:
- Creates a `neon_auth.users_sync` table
- Auto-syncs all Clerk users to this table
- Keeps user data up-to-date in real-time

## Step 2: Clear Existing Data & Update Schema

Since we're switching from Spotify user IDs to Clerk user IDs, we need to clear old data and restructure the database.

### Run this SQL in your Neon Console:

```sql
-- ========================================
-- CLERK CHAT HISTORY SCHEMA UPDATE
-- ========================================

-- 1. CLEAR EXISTING DATA (fresh start with Clerk IDs)
TRUNCATE TABLE track_likes, message_feedback, chat_messages CASCADE;

-- 2. UPDATE CHAT_MESSAGES TABLE
ALTER TABLE chat_messages 
  DROP COLUMN IF EXISTS user_id,  -- Remove old Spotify user_id
  ALTER COLUMN clerk_id SET NOT NULL;  -- Make clerk_id required

-- Add foreign key to neon_auth.users_sync
ALTER TABLE chat_messages
  ADD CONSTRAINT chat_messages_clerk_id_fk
  FOREIGN KEY (clerk_id) 
  REFERENCES neon_auth.users_sync(id)
  ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_chat_messages_clerk_id_created 
  ON chat_messages(clerk_id, created_at DESC);

-- 3. UPDATE MESSAGE_FEEDBACK TABLE
ALTER TABLE message_feedback 
  DROP COLUMN IF EXISTS user_id,  -- Remove old Spotify user_id
  ALTER COLUMN clerk_id SET NOT NULL;  -- Make clerk_id required

ALTER TABLE message_feedback
  ADD CONSTRAINT message_feedback_clerk_id_fk
  FOREIGN KEY (clerk_id)
  REFERENCES neon_auth.users_sync(id)
  ON DELETE CASCADE;

-- 4. UPDATE TRACK_LIKES TABLE
ALTER TABLE track_likes 
  DROP COLUMN IF EXISTS user_id,  -- Remove old Spotify user_id
  ALTER COLUMN clerk_id SET NOT NULL;  -- Make clerk_id required

ALTER TABLE track_likes
  ADD CONSTRAINT track_likes_clerk_id_fk
  FOREIGN KEY (clerk_id)
  REFERENCES neon_auth.users_sync(id)
  ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_track_likes_clerk_id 
  ON track_likes(clerk_id, created_at DESC);

-- 5. DROP OLD USERS TABLE (no longer needed)
DROP TABLE IF EXISTS users CASCADE;

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

-- You should see 3 foreign keys (chat_messages, message_feedback, track_likes)

-- 7. VERIFY INDEXES
SELECT 
  schemaname, 
  tablename, 
  indexname, 
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE '%clerk%';
```

## Step 3: Test the Integration

### 1. Restart Your Servers

```bash
# Kill existing processes
pkill -f "flask run"
pkill -f "next dev"

# Start Flask
cd /Users/giovannisanchez/ai-dj/backend
source ../venv/bin/activate
python main.py

# In a new terminal, start Next.js
cd /Users/giovannisanchez/ai-dj
npm run dev
```

### 2. Test Flow

1. **Sign up/Sign in** with Clerk
2. **Connect Spotify** (click the Spotify button in the input)
3. **Send a message**: "recommend me some upbeat songs"
4. **Verify messages are saved**:
   ```sql
   SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 5;
   ```
5. **Refresh the page** - your messages should reappear!
6. **Sign out and sign back in** - your messages should still be there!

### 3. Test User Sync

Check that Clerk users are syncing to Neon:

```sql
-- See synced Clerk users
SELECT * FROM neon_auth.users_sync;

-- See messages with user info
SELECT 
  cm.content,
  u.email,
  u.name,
  cm.created_at
FROM chat_messages cm
JOIN neon_auth.users_sync u ON cm.clerk_id = u.id
ORDER BY cm.created_at DESC
LIMIT 10;
```

## Step 4: Test Cascading Deletes

Foreign keys ensure that when a user is deleted, all their data is automatically cleaned up.

```sql
-- Find a test user
SELECT id, email FROM neon_auth.users_sync LIMIT 1;

-- Check their messages
SELECT COUNT(*) FROM chat_messages WHERE clerk_id = 'user_xxx';

-- Delete the user (⚠️ WARNING: This deletes all their data!)
DELETE FROM neon_auth.users_sync WHERE id = 'user_xxx';

-- Verify their messages are gone
SELECT COUNT(*) FROM chat_messages WHERE clerk_id = 'user_xxx';
-- Should return 0
```

## What Changed in the Code

### Frontend (Next.js)
- ✅ All API routes now get Clerk user ID with `currentUser()`
- ✅ User ID is passed to Flask in `X-Clerk-User-Id` header
- ✅ Chat history is loaded from `/api/chat-history` (which calls `/clerk_chat_history` on Flask)

### Backend (Flask)
- ✅ New `get_clerk_user_id()` helper extracts Clerk ID from headers
- ✅ `dj_recommend` saves messages with `clerk_id`
- ✅ New `/clerk_chat_history` endpoint for Clerk users
- ✅ All endpoints (`/message_feedback`, `/track_like`, `/liked_tracks`, `/liked_track_ids`) use Clerk IDs
- ✅ No longer depends on Spotify user ID for chat history

### Database
- ✅ `chat_messages.clerk_id` is now required (NOT NULL)
- ✅ Foreign keys ensure data integrity
- ✅ Cascading deletes clean up orphaned data
- ✅ Indexes speed up queries by clerk_id

## Benefits

### For Users
- 🔒 **Secure**: Clerk handles authentication
- 💾 **Persistent**: Chat history saved across sessions
- 🚀 **Fast**: Messages load instantly on page load
- 🧹 **Clean**: Old data is automatically cleaned up

### For You
- 📊 **Analytics**: Query user behavior easily
- 🔗 **Joins**: Combine chat data with user profiles
- 🛡️ **Data Integrity**: Foreign keys prevent orphaned data
- 🔄 **Real-time Sync**: Neon Auth keeps users up-to-date

## Troubleshooting

### "Clerk user ID not found in request headers"
**Cause**: User is not signed in with Clerk  
**Solution**: Make sure user is signed in before making API calls

### "relation neon_auth.users_sync does not exist"
**Cause**: Neon Auth is not enabled  
**Solution**: Go to Neon Console → Settings → Auth and enable it

### "foreign key constraint fails"
**Cause**: Trying to save a message for a Clerk user that doesn't exist in `neon_auth.users_sync`  
**Solution**: 
1. Make sure Neon Auth is enabled
2. Have the user sign out and sign in again (to trigger sync)
3. Check that the user exists: `SELECT * FROM neon_auth.users_sync WHERE id = 'user_xxx'`

### "Messages not appearing after refresh"
**Cause**: clerk_id not being saved correctly  
**Solution**: 
1. Check Flask logs for "✅ Saved messages to database"
2. Verify messages in database: `SELECT * FROM chat_messages WHERE clerk_id = 'user_xxx'`
3. Check that `X-Clerk-User-Id` header is being sent from frontend

## Next Steps

Once everything is working:
1. ✅ Test with multiple users
2. ✅ Monitor Neon Auth logs in console
3. ✅ Set up user analytics queries
4. ✅ Consider adding user-facing features like:
   - "Clear conversation" button
   - Export chat history
   - Search through past conversations

---

**Ready?** Follow the steps above to enable Neon Auth and update your database schema!

