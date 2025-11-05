# Test The Cookie Domain Fix

## Quick Test (5 minutes)

### 1. Update Spotify Redirect URI ⚠️ CRITICAL

Go to: https://developer.spotify.com/dashboard

1. Select your app
2. Click "Edit Settings"
3. Change Redirect URI:
   - ❌ **OLD:** `http://127.0.0.1:5001/callback`
   - ✅ **NEW:** `http://localhost:5001/callback`
4. Click "Save"

### 2. Clear Browser Cookies

**Chrome/Safari:**
1. Press `F12` (or Cmd+Option+I)
2. Go to: **Application** tab
3. Expand: **Cookies**
4. Click: `http://localhost:3000`
5. Click: **Clear All** button

Also delete cookies for `http://127.0.0.1:3000` if present.

### 3. Restart Servers

```bash
# Option A: Automated fresh start
bash fresh-start.sh

# Option B: Manual restart
# Stop all servers first (Ctrl+C)

# Terminal 1 - Flask
cd backend
source ../venv/bin/activate
python main.py

# Terminal 2 - Next.js
npm run dev
```

**Verify output:**
- Flask: `* Running on http://localhost:5001` ✅
- Next.js: `url: http://localhost:3000` ✅

### 4. Test Authentication

1. Open browser: **`http://localhost:3000`**  
   ⚠️ **NOT** `http://127.0.0.1:3000`

2. Click **"Connect to Spotify"**

3. Complete OAuth flow

4. **Verify cookie exists:**
   - F12 → Application → Cookies → `localhost:3000`
   - Should see: `spotify_session_id` with a UUID value

### 5. Test Message Persistence

1. **Send test message:** `"test message 1"`

2. **Check browser console (F12):**
   ```
   User authenticated, loading chat history...
   Loaded 2 messages from history
   ```

3. **Check Flask logs:**
   ```
   ✅ Saved messages to database (user: 1, assistant: 2)
   ```

4. **REFRESH PAGE (F5 or Cmd+R)** 🔄

5. **Expected result:**
   - ✅ "Loading chat history..." appears briefly
   - ✅ Your test message is STILL THERE!
   - ✅ No errors in console

### 6. Verify Session Persistence

**In browser console (F12), run:**
```javascript
document.cookie.split(';').find(c => c.includes('spotify_session_id'))
```

**Copy the session ID and refresh 5 times.**

**Check Flask logs - should see SAME session ID every time:**
```
=== SESSION CHAT HISTORY REQUEST ===
Session ID: 1ae0f137-2f2b-480e-b4ed-af9b97e77234
Found 2 messages for session
```

## Success Criteria

✅ Messages persist after refresh  
✅ Browser console: "Loaded X messages from history"  
✅ Flask logs: Same session ID on every request  
✅ Cookie value doesn't change on refresh  
✅ No CORS errors in console  

## If It Still Doesn't Work

### Check #1: Are you using localhost?
- ❌ `http://127.0.0.1:3000` → Won't work!
- ✅ `http://localhost:3000` → Correct!

### Check #2: Is the cookie being set?
```javascript
// Run in browser console (F12)
document.cookie
```

Should see: `spotify_session_id=<some-uuid>`

**If missing:**
- Clear all cookies again
- Restart servers
- Re-authenticate

### Check #3: Did you update Spotify redirect?
- Go to Spotify dashboard
- Verify: `http://localhost:5001/callback`
- Wait 5 minutes for changes to propagate

### Check #4: Are servers running on correct host?
**Flask terminal should show:**
```
* Running on http://localhost:5001
```

**NOT:**
```
* Running on http://127.0.0.1:5001  ❌
* Running on http://0.0.0.0:5001    ❌
```

## Debugging

### Browser Console (F12)
Look for:
```
✅ User authenticated, loading chat history...
✅ Loaded 2 messages from history
```

If you see:
```
❌ User not authenticated, skipping history load
❌ Failed to load chat history: 401
```

→ Cookie is not being sent. Clear cookies and restart.

### Flask Terminal
Look for:
```
=== SESSION CHAT HISTORY REQUEST ===
Session ID: 1ae0f137-2f2b-480e-b4ed-af9b97e77234
Found 2 messages for session
```

If session ID changes on each request → Cookie not persisting.

### Database Check
```sql
SELECT session_id, COUNT(*) as msg_count
FROM chat_messages
GROUP BY session_id;
```

**Good:**
```
session_id                           | msg_count
-------------------------------------|----------
1ae0f137-2f2b-480e-b4ed-af9b97e77234 | 10
```

**Bad:**
```
session_id                           | msg_count
-------------------------------------|----------
abc-123...                           | 2
def-456...                           | 2
ghi-789...                           | 2
```
(Multiple sessions = cookies not persisting)

## Still Broken?

Read the detailed guides:
- `COOKIE_DOMAIN_FIX.md` - Full technical explanation
- `DOMAIN_FIX_SUMMARY.md` - Quick summary
- `TROUBLESHOOTING_CHAT_HISTORY.md` - Comprehensive debugging

Or share:
1. Browser console logs (F12 → Console)
2. Flask terminal output
3. Result of: `document.cookie` in console
4. Database query result for session IDs

---

**This WILL fix your issue!** The domain mismatch was definitely the root cause. 🎉


