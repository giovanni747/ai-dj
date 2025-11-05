# Fix: INVALID_CLIENT: Insecure redirect URI

## The Problem

Spotify is rejecting your redirect URI with "Insecure redirect URI" error. This usually means:

1. **The redirect URI doesn't match EXACTLY** what's registered in Spotify
2. **Spotify is blocking `127.0.0.1`** - some OAuth providers don't allow `127.0.0.1` for security
3. **Format mismatch** - extra spaces, wrong protocol, etc.

## Quick Fix

### Step 1: Remove `127.0.0.1` from Spotify

Even though Spotify shows both URIs, **remove `127.0.0.1`**:

1. Go to: https://developer.spotify.com/dashboard
2. Select your app → **Edit Settings**
3. In **Redirect URIs**, **remove** `http://127.0.0.1:5001/callback`
4. **Keep only:** `http://localhost:5001/callback`
5. Click **Save**

**Why?** Spotify (and many OAuth providers) may reject `127.0.0.1` as insecure. `localhost` is the standard for local development.

### Step 2: Verify Your .env File

Make sure your `.env` file doesn't override the redirect URI:

```bash
# Check if SPOTIFY_REDIRECT_URI is set
cat .env | grep SPOTIFY_REDIRECT_URI
```

**If it exists and points to `127.0.0.1`, either:**
- Remove it (let the code use `localhost` default)
- OR change it to: `SPOTIFY_REDIRECT_URI=http://localhost:5001/callback`

### Step 3: Restart Flask Server

After updating Spotify:

```bash
# Kill Flask
pkill -f "python main.py"

# Restart Flask
cd backend
source ../venv/bin/activate
python main.py
```

**Check the output** - you should see:
```
🔧 SPOTIFY OAUTH CONFIGURATION
============================================================
Client ID: <your-client-id>...
Redirect URI: http://localhost:5001/callback
Next.js URL: http://localhost:3000
============================================================
```

### Step 4: Test Authentication

1. Open: `http://localhost:3000`
2. Click "Connect to Spotify"
3. Should redirect to Spotify login (no error!)
4. After login, should redirect back successfully

## Why This Happens

Spotify's OAuth validation:
- ✅ Allows: `http://localhost:5001/callback` (standard localhost)
- ❌ May reject: `http://127.0.0.1:5001/callback` (treated as insecure)
- ✅ Allows: `https://yourdomain.com/callback` (production)

## Alternative: Use Environment Variable

If you need to switch between environments, set in `.env`:

```bash
SPOTIFY_REDIRECT_URI=http://localhost:5001/callback
```

Then restart Flask. The code will use this value.

## Verification Checklist

- [ ] Spotify dashboard shows **only** `http://localhost:5001/callback`
- [ ] `.env` file doesn't have `SPOTIFY_REDIRECT_URI=http://127.0.0.1...`
- [ ] Flask logs show: `Redirect URI: http://localhost:5001/callback`
- [ ] No "Insecure redirect URI" error when clicking "Connect to Spotify"

## Still Getting Error?

### Check 1: Exact Match

The redirect URI must match **EXACTLY**:
- ✅ `http://localhost:5001/callback`
- ❌ `http://localhost:5001/callback/` (trailing slash)
- ❌ `http://localhost:5001/callback ` (trailing space)
- ❌ `https://localhost:5001/callback` (https instead of http)

### Check 2: Spotify Dashboard

Make sure:
1. The redirect URI is saved in Spotify
2. You clicked "Save" (not just "Add")
3. Wait 2-3 minutes for changes to propagate

### Check 3: Browser Console

Check for any errors when clicking "Connect to Spotify":
```
F12 → Console tab
```

Look for:
- CORS errors
- Redirect errors
- Network errors

### Check 4: Flask Logs

When you click "Connect to Spotify", Flask should show:
```
Starting OAuth with session_id: <uuid>
```

If you see the "Insecure redirect URI" error, it's coming from Spotify's OAuth endpoint, not Flask.

## Success Indicators

✅ **No error when clicking "Connect to Spotify"**  
✅ **Browser redirects to Spotify login page**  
✅ **After login, redirects back to your app**  
✅ **Authentication completes successfully**  

---

**The key fix: Remove `127.0.0.1` from Spotify and use only `localhost`!** 🎉

