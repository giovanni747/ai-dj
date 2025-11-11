# Neon Auth + Clerk Integration Guide

## What is Neon Auth?

Neon Auth automatically syncs your Clerk users to your Neon database. When a user signs up/in with Clerk, their profile is instantly available in Postgres for joins, queries, and analytics.

## Step 1: Enable Neon Auth in Neon Console

1. Go to your Neon Console: https://console.neon.tech
2. Select your project (`ai-dj` database)
3. Go to **Settings** → **Auth**
4. Click **Enable Neon Auth**
5. Select **Clerk** as your authentication provider
6. You'll need to provide:
   - **Clerk Publishable Key** (same as `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`)
   - **Clerk Secret Key** (same as `CLERK_SECRET_KEY`)

## Step 2: What Neon Auth Does

Once enabled, Neon Auth will:
- ✅ Create a `neon_auth.users_sync` table automatically
- ✅ Sync all Clerk users to this table in real-time
- ✅ Keep user data up-to-date (updates, deletions, etc.)
- ✅ Provide user profile data for database joins

### The `neon_auth.users_sync` table contains:
```sql
- id (Clerk user ID)
- email
- name
- created_at
- updated_at
- deleted_at
```

## Step 3: Update Your Schema

After enabling Neon Auth, run this SQL to restructure your tables with proper foreign keys:

```sql
-- 1. Clear existing data (since we're switching to Clerk IDs)
TRUNCATE TABLE track_likes, message_feedback, chat_messages CASCADE;

-- 2. Update chat_messages to use Clerk user ID
ALTER TABLE chat_messages 
  DROP COLUMN IF EXISTS user_id,
  ALTER COLUMN clerk_id SET NOT NULL;

-- Add foreign key to neon_auth.users_sync
ALTER TABLE chat_messages
  ADD CONSTRAINT chat_messages_clerk_id_fk
  FOREIGN KEY (clerk_id) 
  REFERENCES neon_auth.users_sync(id)
  ON DELETE CASCADE;

-- 3. Update message_feedback to use Clerk user ID
ALTER TABLE message_feedback 
  DROP COLUMN IF EXISTS user_id,
  ALTER COLUMN clerk_id SET NOT NULL;

ALTER TABLE message_feedback
  ADD CONSTRAINT message_feedback_clerk_id_fk
  FOREIGN KEY (clerk_id)
  REFERENCES neon_auth.users_sync(id)
  ON DELETE CASCADE;

-- 4. Update track_likes to use Clerk user ID
ALTER TABLE track_likes 
  DROP COLUMN IF EXISTS user_id,
  ALTER COLUMN clerk_id SET NOT NULL;

ALTER TABLE track_likes
  ADD CONSTRAINT track_likes_clerk_id_fk
  FOREIGN KEY (clerk_id)
  REFERENCES neon_auth.users_sync(id)
  ON DELETE CASCADE;

-- 5. Drop the old users table (we don't need it anymore)
DROP TABLE IF EXISTS users CASCADE;

-- 6. Verify the setup
SELECT 
  tc.table_name, 
  tc.constraint_name, 
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public' 
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'clerk_id';
```

## Step 4: Benefits of Neon Auth + Foreign Keys

### Automatic User Sync
- ✅ Users are instantly available in your database
- ✅ No custom sync logic needed
- ✅ Real-time updates (name changes, email changes, etc.)

### Proper Data Cleanup
- ✅ When a user is deleted from Clerk, all their data is automatically cleaned up
- ✅ No orphaned messages or likes
- ✅ No ghost data cluttering your database

### Easy Joins and Queries
```sql
-- Get all messages with user info
SELECT 
  cm.content,
  u.email,
  u.name
FROM chat_messages cm
JOIN neon_auth.users_sync u ON cm.clerk_id = u.id
WHERE u.deleted_at IS NULL;

-- Get user statistics
SELECT 
  u.email,
  COUNT(cm.id) as message_count,
  COUNT(tl.id) as liked_tracks
FROM neon_auth.users_sync u
LEFT JOIN chat_messages cm ON u.id = cm.clerk_id
LEFT JOIN track_likes tl ON u.id = tl.clerk_id
WHERE u.deleted_at IS NULL
GROUP BY u.email;
```

## Step 5: Test the Integration

1. **Sign up a new user** in your app
2. **Check the database**:
```sql
-- See synced users
SELECT * FROM neon_auth.users_sync;

-- Verify foreign keys work
SELECT 
  cm.content,
  u.email
FROM chat_messages cm
JOIN neon_auth.users_sync u ON cm.clerk_id = u.id;
```

3. **Test cascading deletes**:
```sql
-- Delete a user (their messages should auto-delete)
DELETE FROM neon_auth.users_sync WHERE email = 'test@example.com';

-- Verify their messages are gone
SELECT * FROM chat_messages WHERE clerk_id = 'deleted_user_id';
-- Should return 0 rows
```

## Common Issues

### Issue: "relation neon_auth.users_sync does not exist"
**Solution**: Neon Auth is not enabled. Go to Neon Console → Settings → Auth and enable it.

### Issue: Foreign key constraint fails
**Solution**: You have existing data with Clerk IDs that don't exist in `neon_auth.users_sync`. Run the TRUNCATE commands above to clear old data.

### Issue: Users not syncing
**Solution**: 
1. Check that your Clerk keys are correct in Neon Auth settings
2. Make sure users are signing in through Clerk (not just created in Clerk Dashboard)
3. Check Neon Auth logs in the console

## Next Steps

After setting up Neon Auth:
1. ✅ Enable Neon Auth in Console
2. ✅ Run the SQL schema update
3. ✅ Update backend to use Clerk user IDs (we'll do this next)
4. ✅ Test with a new user signup

---

**Ready?** Let's proceed with updating the backend code!
