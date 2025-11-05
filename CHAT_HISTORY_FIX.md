# Chat History Fix - Authentication Check Added

## What Was Fixed

The chat history was disappearing on refresh because the component was trying to load history **before checking if the user was authenticated**.

### The Problem

```
Page loads → Component mounts → Tries to load history immediately
                                  ↓
                                  No session/auth yet → Request fails
                                  ↓
                                  No messages loaded
```

### The Solution

```
Page loads → Component mounts → Check authentication FIRST
                                  ↓
                           Authenticated? → Load history
                                  ↓
                           Not authenticated? → Skip (show empty state)
```

## Changes Made

### File: `components/ui/ai-input-demo.tsx`

Added authentication check before loading history:

```typescript
// Check authentication first
const authResponse = await fetch('/api/spotify-auth', {
  credentials: 'include',
});

if (!authResponse.ok || !authData.authenticated) {
  console.log('User not authenticated, skipping history load');
  setIsLoadingHistory(false);
  return;
}

// Only load history if authenticated
console.log('User authenticated, loading chat history...');
// ... rest of history loading code
```

### File: `backend/main.py`

Added detailed debug logging to track session persistence:

```python
print(f"\n=== SESSION CHAT HISTORY REQUEST ===")
print(f"Session ID: {session_id}")
print(f"Found {len(messages)} messages for session")
```

## How to Test

### Option 1: Quick Test

1. **Restart both servers:**
   ```bash
   ./restart-servers.sh
   ```

2. **Open browser and authenticate:**
   - Go to `http://localhost:3000`
   - If not logged in, click "Connect to Spotify"
   - Complete authentication

3. **Send a test message:**
   ```
   "test message 1"
   ```

4. **Refresh the page (F5 or Cmd+R)**

5. **Expected result:**
   - You should see "Loading chat history..." briefly
   - Your test message should appear
   - Browser console should show:
     ```
     User authenticated, loading chat history...
     Loaded 2 messages from history
     ```

### Option 2: Automated Test

Run the test script:

```bash
bash test-session.sh
```

This will check:
- ✓ Servers are running
- ✓ Database is connected
- ✓ Tables exist
- ✓ Session endpoint works

## Debugging

### Check Browser Console (F12)

**If you see:**
```
User not authenticated, skipping history load
```
→ **You need to authenticate first**. Go to `http://localhost:5001` to log in.

**If you see:**
```
User authenticated, loading chat history...
Loaded X messages from history
```
→ **Working correctly!** Messages should appear.

**If you see:**
```
User authenticated, loading chat history...
Failed to load chat history: 401
```
→ **Authentication expired**. Clear cookies and re-authenticate.

### Check Backend Logs

You should see:
```
=== SESSION CHAT HISTORY REQUEST ===
Session ID: abc-123-def-456...
Found 2 messages for session
```

**If you see:**
```
❌ Not authenticated
```
→ Session cookie is missing or invalid.

**If you see:**
```
Found 0 messages for session
```
→ Session ID doesn't match. See troubleshooting below.

## Common Issues

### Issue 1: "User not authenticated" on every refresh

**Cause:** Session cookie not persisting

**Fix:**
1. Check browser cookies (F12 → Application → Cookies)
2. Look for `spotify_session_id` cookie
3. If missing after auth, check cookie settings in `/api/set-session/route.ts`
4. Use `http://localhost:3000` (not `127.0.0.1:3000`)

### Issue 2: "Found 0 messages for session" but DB has messages

**Cause:** Session ID is changing between requests

**Fix:**
1. Check backend logs - session ID should be consistent
2. Clear all cookies and re-authenticate
3. Send new message, then refresh

### Issue 3: Messages load sometimes but not always

**Cause:** Race condition or timing issue

**Fix:**
1. Refresh a second time (slower refresh = more time to auth)
2. Check network tab in DevTools
3. See if `/api/spotify-auth` completes before `/api/chat-history`

## Detailed Troubleshooting

See `TROUBLESHOOTING_CHAT_HISTORY.md` for comprehensive debugging steps.

## Alternative: Load All User Messages (Not Just Session)

If session persistence is problematic, you can load ALL your messages instead:

**Change: `/api/chat-history/route.ts`**

From:
```typescript
const response = await fetch(`http://127.0.0.1:5001/session_chat_history?limit=${limit}`, {
```

To:
```typescript
const response = await fetch(`http://127.0.0.1:5001/chat_history?limit=${limit}`, {
```

This loads all conversations across all sessions (may be more messages).

## Verify It's Working

### 1. Check Console Logs

Browser console should show:
```
User authenticated, loading chat history...
Loaded 2 messages from history
Loaded 0 liked tracks
```

### 2. Check Backend Logs

Flask terminal should show:
```
=== SESSION CHAT HISTORY REQUEST ===
Session ID: abc-123-def-456...
Limit: 50
Found 2 messages for session
First message: test message 1...
```

### 3. Check Database

```sql
SELECT session_id, role, content, created_at 
FROM chat_messages 
ORDER BY created_at DESC 
LIMIT 5;
```

Should show your messages with consistent `session_id`.

### 4. Test Multiple Refreshes

- Refresh 5 times in a row
- Messages should persist every time
- Session ID should remain the same

## Success Criteria

✅ Messages persist after refresh
✅ Console shows "User authenticated, loading chat history..."
✅ Backend shows same session ID across refreshes
✅ `spotify_session_id` cookie exists and doesn't change
✅ Database has messages with your session ID

## Still Not Working?

1. **Run the test script:** `bash test-session.sh`
2. **Check all logs:** Browser console + Flask terminal
3. **Read troubleshooting guide:** `TROUBLESHOOTING_CHAT_HISTORY.md`
4. **Test manually:**
   ```bash
   # Get your session cookie from browser
   curl -H "Cookie: spotify_session_id=YOUR_SESSION_ID" \
        http://127.0.0.1:5001/session_chat_history
   ```

The fix ensures authentication is checked before attempting to load history, which should resolve the disappearing messages issue.

