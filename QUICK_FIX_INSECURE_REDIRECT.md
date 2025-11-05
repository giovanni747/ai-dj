# Quick Fix: INVALID_CLIENT: Insecure redirect URI

## The Problem

Spotify is rejecting your redirect URI with "Insecure redirect URI" error. This is because **Spotify blocks `127.0.0.1` redirects** for security reasons.

## The Solution (2 Steps)

### Step 1: Remove `127.0.0.1` from Spotify Dashboard

1. Go to: https://developer.spotify.com/dashboard
2. Select your app: **AI-Dj**
3. Click **"Edit Settings"**
4. Scroll to **"Redirect URIs"** section
5. **DELETE** this line:
   ```
   http://127.0.0.1:5001/callback  ❌ REMOVE THIS
   ```
6. **KEEP ONLY** this line:
   ```
   http://localhost:5001/callback  ✅ KEEP THIS
   ```
7. Click **"Save"** (wait for success message)

### Step 2: Wait 2-3 Minutes

Spotify changes take a few minutes to propagate. Wait 2-3 minutes before testing.

## Test It

1. **Restart Flask** (if needed):
   ```bash
   # Kill Flask
   pkill -f "python main.py"
   
   # Restart Flask
   cd backend
   source ../venv/bin/activate
   python main.py
   ```

2. **Open browser**: `http://localhost:3000`

3. **Click "Connect to Spotify"**

4. **Check Flask logs** - you should see:
   ```
   🔧 SPOTIFY OAUTH CONFIGURATION
   Redirect URI: http://localhost:5001/callback
   
   === STARTING OAUTH FLOW ===
   Redirect URI: http://localhost:5001/callback
   ```

5. **Should redirect to Spotify** (no error!)

## Why This Happens

Spotify's security policy:
- ✅ **Allows:** `http://localhost:5001/callback` (standard localhost)
- ❌ **Blocks:** `http://127.0.0.1:5001/callback` (considered insecure)
- ✅ **Allows:** `https://yourdomain.com/callback` (production)

Even if `127.0.0.1` is in your dashboard, Spotify may reject it during OAuth flow.

## Verification

After removing `127.0.0.1` from Spotify:

1. **Spotify Dashboard** should show:
   ```
   Redirect URIs:
   • http://localhost:5001/callback
   ```
   (Only one URI, no `127.0.0.1`)

2. **Flask logs** should show:
   ```
   Redirect URI: http://localhost:5001/callback
   ```

3. **No "Insecure redirect URI" error** when clicking "Connect to Spotify"

## Still Getting Error?

If you still get the error after removing `127.0.0.1`:

1. **Double-check Spotify dashboard** - make sure `127.0.0.1` is completely removed
2. **Wait 5 minutes** - Spotify changes can take time
3. **Clear browser cache** - old redirect might be cached
4. **Check Flask logs** - verify it's using `localhost`, not `127.0.0.1`

---

**The fix: Remove `127.0.0.1` from Spotify, keep only `localhost`!** ✅

