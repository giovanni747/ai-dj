# Quick Start: Clerk + Chat History

## 🚀 What I've Done

I've integrated **Clerk authentication** with your chat history so messages persist across sessions!

### Changes Made:

#### Frontend (Next.js)
- ✅ All API routes now extract Clerk user ID with `currentUser()`
- ✅ Clerk ID is sent to Flask in `X-Clerk-User-Id` header
- ✅ New `/api/get-clerk-user` route to get current user info
- ✅ Chat history loads on page mount

#### Backend (Flask)
- ✅ New `get_clerk_user_id()` helper to extract Clerk ID from headers
- ✅ New `/clerk_chat_history` endpoint for Clerk users
- ✅ `dj_recommend` saves messages with `clerk_id`
- ✅ All endpoints now use Clerk IDs instead of Spotify user IDs

#### Database
- ✅ Updated `chat_db.py` to support `clerk_id`
- ✅ `save_message()` now accepts and uses `clerk_id`
- ✅ `get_user_messages()` queries by `clerk_id`

## ⚡ Quick Setup (3 Steps)

### Step 1: Enable Neon Auth

1. Go to https://console.neon.tech
2. Select your `ai-dj` project
3. Go to **Settings → Auth**
4. Click **Enable Neon Auth**
5. Select **Clerk**
6. Enter your Clerk keys from `.env`:
   - **Publishable Key**: Value of `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - **Secret Key**: Value of `CLERK_SECRET_KEY`

### Step 2: Run SQL Schema Update

Go to Neon Console → SQL Editor and run:

```bash
/Users/giovannisanchez/ai-dj/backend/update_schema_for_clerk.sql
```

Or copy-paste from `backend/update_schema_for_clerk.sql`

### Step 3: Test It!

1. **Open your app**: http://localhost:3000
2. **Sign in with Clerk**
3. **Connect Spotify** (green button in input)
4. **Send a message**: "recommend me some chill songs"
5. **Refresh the page** → Your message should reappear! 🎉
6. **Sign out and sign in** → Messages still there! 🎉

## 🧪 Verify It's Working

### Check Chat Messages in Database:

```sql
-- See your messages
SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 10;

-- See messages with user info
SELECT 
  cm.content,
  u.email,
  u.name,
  cm.created_at
FROM chat_messages cm
JOIN neon_auth.users_sync u ON cm.clerk_id = u.id
ORDER BY cm.created_at DESC;
```

### Check Flask Logs:

You should see:
```
✅ Saved messages to database (user: 12345, assistant: 67890)
Clerk ID: user_2xxx...
Found 2 messages for clerk user
```

## 📚 Full Documentation

- **`CLERK_CHAT_SETUP.md`**: Complete setup guide with troubleshooting
- **`NEON_AUTH_SETUP.md`**: Detailed Neon Auth documentation
- **`backend/update_schema_for_clerk.sql`**: SQL schema update script

## ❓ Troubleshooting

### Messages not saving?
**Check**: Flask logs for "Clerk user ID not found in request headers"  
**Fix**: Make sure you're signed in with Clerk

### "relation neon_auth.users_sync does not exist"?
**Fix**: Enable Neon Auth in the console (Step 1 above)

### Foreign key constraint fails?
**Fix**: Make sure the SQL schema update completed successfully

---

**That's it!** Your chat history should now persist across sessions with Clerk authentication! 🎉

