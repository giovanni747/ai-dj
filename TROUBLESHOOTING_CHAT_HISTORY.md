# Troubleshooting Chat History Not Persisting

## The Problem

Chat history disappears when you refresh the page, even though it's being saved to the database.

## Root Cause

This is likely a **session/authentication issue**. The chat history is tied to your Spotify session ID, and if the session isn't being maintained across page refreshes, the app can't retrieve your history.

## Diagnosis Steps

### 1. Check Browser Console

Open your browser's Developer Tools (F12) and check the Console tab for these messages:

**If you see:**
```
User not authenticated, skipping history load
```
**Problem:** You're not authenticated when the page loads. This is the most common issue.

**If you see:**
```
User authenticated, loading chat history...
Loaded X messages from history
Loaded X liked tracks
```
**Good:** Authentication is working and history should load.

**If you see:**
```
Failed to load chat history: 401
```
**Problem:** Authentication failed during history load.

### 2. Check Cookies

In Developer Tools → Application tab → Cookies → `http://localhost:3000`:

Look for a cookie named `spotify_session_id`:
- **If missing:** Authentication didn't complete properly
- **If present:** Copy the value (it should be a UUID)

### 3. Check Backend Logs

In your Flask backend terminal, you should see:

```
=== SESSION CHAT HISTORY REQUEST ===
Session ID: abc-123-def-456...
Limit: 50
Found X messages for session
```

**If you see:**
```
❌ Not authenticated
```
**Problem:** The session cookie isn't being sent or isn't valid.

### 4. Check Database

Query your Neon database directly:

```sql
-- Check if messages are being saved
SELECT id, session_id, role, content, created_at 
FROM chat_messages 
ORDER BY created_at DESC 
LIMIT 10;

-- Check if your session_id exists
SELECT DISTINCT session_id 
FROM chat_messages 
ORDER BY session_id;
```

**If no messages:** They're not being saved.
**If messages exist but with different session_ids:** Session ID is changing on each request.

## Common Issues & Solutions

### Issue 1: Session ID Changes on Each Refresh

**Symptoms:**
- Database has messages with different session_ids
- Backend logs show different session_id each time

**Why this happens:**
- The `spotify_session_id` cookie isn't being persisted
- Cookie settings might be incorrect (SameSite, Secure, Domain)

**Solution:**

1. Check `/api/set-session/route.ts` cookie settings:
```typescript
cookieStore.set("spotify_session_id", sessionId, {
  httpOnly: true,
  sameSite: "lax",  // Should be "lax" for localhost
  secure: process.env.NODE_ENV === "production",  // Should be false in dev
  path: "/",
  maxAge: 60 * 60 * 24 * 7,  // 7 days
});
```

2. Make sure you're using `http://localhost:3000` (not `127.0.0.1`)

3. Clear all cookies and re-authenticate:
   - Go to Developer Tools → Application → Cookies
   - Delete all cookies for localhost
   - Go to `http://localhost:5001` to re-authenticate
   - Check if `spotify_session_id` cookie appears

### Issue 2: Authentication Not Completing Before History Loads

**Symptoms:**
- Console shows "User not authenticated, skipping history load"
- But you ARE authenticated (can send messages)

**Why this happens:**
- The component tries to load history before authentication check completes
- Race condition between auth check and history load

**Solution:**

The code now checks authentication before loading history. If you still see this:

1. Refresh the page a second time (authentication should be faster)
2. Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)
3. Try incognito mode to test without cache

### Issue 3: CORS/Cookie Issues with Multiple Domains

**Symptoms:**
- Cookies work on `localhost:3000` but not `127.0.0.1:3000`
- Authentication works but history doesn't load

**Why this happens:**
- Cookies are domain-specific
- `localhost` and `127.0.0.1` are treated as different domains

**Solution:**

**Always use the same domain:**
- Frontend: `http://localhost:3000`
- Backend: `http://127.0.0.1:5001` (Flask default)

Update your CORS settings in `backend/main.py`:
```python
CORS(app, supports_credentials=True, 
     origins=['http://localhost:3000', 'http://127.0.0.1:3000'])
```

### Issue 4: Database Connection Issues

**Symptoms:**
- Backend logs show "Database not configured"
- No messages being saved

**Why this happens:**
- `DATABASE_URL` not set in `.env`
- Database connection failed

**Solution:**

1. Check `.env` file has `DATABASE_URL`
2. Test database connection:
```bash
cd backend
python -c "from chat_db import chat_db; print('DB OK' if chat_db else 'DB FAIL')"
```

3. If it fails, check your Neon database is active

### Issue 5: Messages Saved But Not Loading

**Symptoms:**
- Backend shows "Found 0 messages for session"
- But database has messages

**Why this happens:**
- Session ID in cookie doesn't match session ID in database
- Messages were saved with one session ID, trying to load with another

**Solution:**

1. Get your current session ID:
```javascript
// In browser console
document.cookie.split(';').find(c => c.includes('spotify_session_id'))
```

2. Check database for that session ID:
```sql
SELECT COUNT(*) FROM chat_messages 
WHERE session_id = 'YOUR_SESSION_ID_HERE';
```

3. If count is 0, the session IDs don't match. You need to:
   - Clear cookies and re-authenticate
   - Send a new message to save with the current session
   - Refresh and check if history loads

## Testing the Fix

### Step 1: Clean Start

```bash
# 1. Stop both servers
# 2. Clear browser cookies for localhost
# 3. Start servers fresh
./restart-servers.sh
```

### Step 2: Authenticate

```bash
# 1. Go to http://localhost:5001
# 2. Complete Spotify OAuth
# 3. You should be redirected back to localhost:3000
```

### Step 3: Verify Session Cookie

```javascript
// In browser console (F12)
document.cookie.split(';').find(c => c.includes('spotify_session_id'))
```

Should show something like:
```
" spotify_session_id=abc-123-def-456..."
```

### Step 4: Send a Test Message

```
Send: "test message 1"
```

Check backend logs:
```
✅ Saved messages to database (user: 1, assistant: 2)
```

### Step 5: Refresh Page

Press F5 or Cmd+R to refresh.

**Expected behavior:**
- Brief "Loading chat history..." spinner
- Your test message should appear
- Console should show:
  ```
  User authenticated, loading chat history...
  Loaded 2 messages from history
  ```

### Step 6: Verify in Database

```sql
SELECT session_id, role, content, created_at 
FROM chat_messages 
ORDER BY created_at DESC;
```

Should show your messages with the same `session_id`.

## Still Not Working?

### Enable Verbose Logging

1. **Frontend:** Open browser console (F12) before refreshing
2. **Backend:** Check Flask terminal for debug output

### Collect Debug Info

Run these commands and share the output:

```bash
# 1. Check if database is accessible
cd backend
python -c "from chat_db import chat_db; print('DB:', 'OK' if chat_db else 'FAIL')"

# 2. Check if messages exist
python -c "
from chat_db import chat_db
if chat_db:
    import os
    from dotenv import load_dotenv
    load_dotenv('../.env')
    # This would need the actual query
"
```

### Manual Test

Try manually calling the API:

```bash
# Get your session cookie from browser
# Then test the endpoint
curl -H "Cookie: spotify_session_id=YOUR_SESSION_ID" \
     http://127.0.0.1:5001/session_chat_history
```

Should return:
```json
{
  "messages": [...],
  "total": 2
}
```

## Quick Fix: User-Wide History Instead of Session

If session persistence is too problematic, we can switch to loading ALL user history instead of just the current session:

**Change `/api/chat-history/route.ts`:**
```typescript
const response = await fetch(`http://127.0.0.1:5001/chat_history?limit=${limit}`, {
  // Changed from session_chat_history to chat_history
```

This will load all your conversations across all sessions (might be a lot of data).

## Summary Checklist

- [ ] Browser console shows "User authenticated"
- [ ] `spotify_session_id` cookie exists and persists after refresh
- [ ] Backend logs show same session ID before and after refresh
- [ ] Database has messages with your session ID
- [ ] `/session_chat_history` endpoint returns messages
- [ ] No CORS errors in browser console
- [ ] Using `localhost:3000` (not `127.0.0.1:3000`)

If all checkboxes are checked, chat history should work!

