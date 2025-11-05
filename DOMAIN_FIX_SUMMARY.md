# Cookie Domain Fix - Quick Summary

## The Problem

Your database shows messages being saved with **2 different session IDs**:
- `2333edef-27b1-4733-a5eb-e61ab103b4ac` (messages 1-2)
- `1ae0f137-2f2b-480e-b4ed-af9b97e77234` (messages 3-12)

**Root cause:** Domain mismatch
- Frontend: `localhost:3000` 
- Backend: `127.0.0.1:5001`

**Browsers treat `localhost` and `127.0.0.1` as DIFFERENT DOMAINS!**

Cookies set on `127.0.0.1` aren't sent to `localhost` requests, causing new session IDs on each request.

## The Fix

✅ Changed ALL URLs from `127.0.0.1:5001` → `localhost:5001`

**Files updated:**
- `backend/main.py` - Flask host, CORS, redirect URL
- `app/api/*` - All API route files (7 files)
- `components/ui/spotify-*.tsx` - Auth components (2 files)

## What You Need to Do

### 1. Update Spotify Redirect URI
Go to https://developer.spotify.com/dashboard
- Change: `http://127.0.0.1:5001/callback`
- To: `http://localhost:5001/callback`

### 2. Clear Browser Cookies
F12 → Application → Cookies → Delete all for:
- `localhost:3000`
- `127.0.0.1:3000` (if present)

### 3. Restart Servers

**Option A - Automated:**
```bash
bash fresh-start.sh
```

**Option B - Manual:**
```bash
# Kill existing processes
pkill -f "next dev"
pkill -f "flask"

# Terminal 1 - Flask
cd backend
source ../venv/bin/activate
python main.py
# Should see: Running on http://localhost:5001

# Terminal 2 - Next.js
npm run dev
# Should see: url: http://localhost:3000
```

### 4. Test

1. Open: `http://localhost:3000` (NOT 127.0.0.1!)
2. Connect to Spotify
3. Send message: "test 1"
4. **Refresh page (F5)**
5. ✅ Message should still be there!

## Verify It Works

**Browser console (F12):**
```
User authenticated, loading chat history...
Loaded 2 messages from history
```

**Flask logs:**
```
=== SESSION CHAT HISTORY REQUEST ===
Session ID: 1ae0f137-2f2b-480e-b4ed-af9b97e77234
Found 2 messages for session
```

**Cookie check (F12 → Application → Cookies):**
- Name: `spotify_session_id`
- Domain: `localhost`
- Value: (UUID that doesn't change on refresh)

## Why This Works

### Before (Broken):
```
localhost:3000 → calls → 127.0.0.1:5001
                          ↓
                    Sets cookie on: 127.0.0.1
                          ↓
User refreshes → localhost:3000 checks cookies
                          ↓
                    No cookie found for localhost!
                          ↓
                    ❌ New session created
```

### After (Fixed):
```
localhost:3000 → calls → localhost:5001
                          ↓
                    Sets cookie on: localhost
                          ↓
User refreshes → localhost:3000 checks cookies
                          ↓
                    ✅ Cookie found!
                          ↓
                    ✅ Same session used
```

## Still Not Working?

Read `COOKIE_DOMAIN_FIX.md` for detailed troubleshooting.

Common issues:
1. Forgot to update Spotify redirect URI
2. Still using 127.0.0.1 in browser URL bar
3. Old cookies not cleared
4. Flask running on wrong host

---

**TL;DR:** Use `localhost` everywhere, not `127.0.0.1`. Cookies will persist. Messages will load. Problem solved! 🎉


