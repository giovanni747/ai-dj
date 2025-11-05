# Fix: INVALID_CLIENT: Invalid redirect URI

## The Problem

You're getting this error because:
- Spotify app has redirect URI: `http://127.0.0.1:5001/callback`
- But backend is now using: `http://localhost:5001/callback`

**These must match EXACTLY!**

## Solution: Update Spotify Redirect URI

### Step 1: Go to Spotify Developer Dashboard

1. Go to: https://developer.spotify.com/dashboard
2. Log in with your Spotify account
3. Click on your app

### Step 2: Update Redirect URI

1. Click **"Edit Settings"** button
2. Scroll down to **"Redirect URIs"** section
3. **Remove:** `http://127.0.0.1:5001/callback` (if present)
4. **Add:** `http://localhost:5001/callback`
5. Click **"Add"** then **"Save"**

### Step 3: Wait 5 Minutes

Spotify changes take a few minutes to propagate. Wait 5 minutes before testing.

### Step 4: Test

1. Restart Flask server (if it's running)
2. Try authenticating again
3. Should work now! ✅

---

## Alternative: Temporary Workaround (NOT RECOMMENDED)

If you can't update Spotify right now, you can temporarily revert:

**Option A: Set environment variable**

Add to your `.env` file:
```bash
SPOTIFY_REDIRECT_URI=http://127.0.0.1:5001/callback
```

**Option B: Use 127.0.0.1 everywhere**

But this will **break cookies again** because:
- Frontend: `localhost:3000`
- Backend: `127.0.0.1:5001`
- Cookies won't persist! ❌

**Better solution:** Update Spotify to use `localhost` (recommended)

---

## Why This Matters

For cookies to work:
- ✅ Frontend: `http://localhost:3000`
- ✅ Backend: `http://localhost:5001`
- ✅ Spotify redirect: `http://localhost:5001/callback`

All must use **`localhost`** (not `127.0.0.1`) for cookies to persist!

---

## Quick Checklist

- [ ] Updated Spotify redirect URI to `http://localhost:5001/callback`
- [ ] Waited 5 minutes for changes to propagate
- [ ] Restarted Flask server
- [ ] Cleared browser cookies
- [ ] Tested authentication

Once Spotify redirect URI is updated, everything should work! 🎉

