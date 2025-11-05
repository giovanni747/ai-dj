# Troubleshooting Guide - AI DJ

## 🚨 Issue: No Tracks Displayed

### Symptoms
- DJ response appears
- No playlist card shown
- No tracks visible

### Diagnosis Steps

#### 1. Check Browser Console
Open browser console (F12) and look for:
```javascript
DJ Recommendation Response: { dj_response: "...", tracks: [...], total_tracks: 10 }
Tracks received: 10
```

**If you see `Tracks received: 0`:**
- Backend is not returning tracks
- Continue to step 2

**If you see `Tracks received: 10` but no display:**
- Frontend rendering issue
- Check for React errors in console
- Verify TrackList component is imported

---

#### 2. Check Backend Logs

Look for these messages in the Flask terminal:

**Good:**
```
Attempting Spotify recommendations with seeds:
  Artists: ['artist_id_1', 'artist_id_2']
  Genres: ['pop', 'rock']
  Tracks: None
  Market: US
SUCCESS: Got 10 recommendations
SUCCESS: Returning 10 tracks
```

**Bad:**
```
Primary recommendations failed: ...
Fallback: Using user's top tracks instead
SUCCESS: Got 10 top tracks as fallback
SUCCESS: Returning 10 tracks
```
*This means Spotify recommendations API is failing, but top tracks fallback is working*

**Worst:**
```
Primary recommendations failed: ...
Fallback: Using user's top tracks instead
Top tracks fallback also failed: ...
All fallbacks failed: ...
WARNING: No tracks returned from Spotify recommendations!
```
*This means all Spotify API calls are failing*

---

### Solutions

#### Solution 1: Spotify Recommendations API 404 Errors

**Problem:** Spotify's recommendations endpoint returns 404

**Cause:** 
- Missing API scopes
- Invalid seed parameters
- Spotify API regional restrictions
- Account type limitations (free vs premium)

**Fix:**
1. **Check Spotify Scopes** in your Spotify Developer Dashboard:
   - Required: `user-read-private`, `user-read-email`, `user-top-read`, `user-read-recently-played`
   - Add if missing, then re-authenticate

2. **Use Top Tracks Fallback** (already implemented):
   - The code now falls back to user's top tracks if recommendations fail
   - This should work even if recommendations API is unavailable

3. **Check Spotify Account**:
   - Some features require Spotify Premium
   - Try with a Premium account if available

---

#### Solution 2: Empty Tracks Array

**Problem:** Backend returns `tracks: []`

**Cause:**
- No user listening history
- New Spotify account
- All API calls failing

**Fix:**
1. **Build Listening History**:
   ```
   - Play some songs on Spotify
   - Create playlists
   - Like some tracks
   - Wait 24 hours for Spotify to process
   ```

2. **Check Authentication**:
   ```bash
   # In browser console
   fetch('/api/spotify-auth', { credentials: 'include' })
     .then(r => r.json())
     .then(console.log)
   
   # Should show: { authenticated: true, ... }
   ```

3. **Manual Test**:
   - Go to `http://localhost:5001/get_user` directly
   - Should show your Spotify profile
   - If error, re-authenticate

---

#### Solution 3: Frontend Not Rendering Tracks

**Problem:** Tracks received but not displayed

**Cause:**
- React rendering error
- TrackList component issue
- CSS/styling problem

**Fix:**
1. **Check Console for React Errors**:
   ```
   Look for red error messages
   Check for component errors
   ```

2. **Verify TrackList Import**:
   ```typescript
   // In ai-input-demo.tsx
   import { TrackList } from "@/components/ui/track-list";
   ```

3. **Check Track Structure**:
   ```javascript
   // In browser console
   // After sending a message
   // Check if tracks have all required fields
   ```

4. **Verify CSS**:
   - Check if elements are hidden (`display: none`)
   - Check if opacity is 0
   - Check if elements are off-screen

---

### Quick Fixes

#### Fix 1: Force Top Tracks (Bypass Recommendations)

If recommendations API keeps failing, modify `backend/main.py`:

```python
# Around line 570, comment out recommendations and use top tracks directly:
try:
    print("Using top tracks directly (recommendations disabled)")
    top_tracks_response = sp.current_user_top_tracks(time_range='medium_term', limit=10)
    recommendations = {'tracks': top_tracks_response.get('items', [])}
except Exception as e:
    print(f"Error getting top tracks: {e}")
    recommendations = {'tracks': []}
```

---

#### Fix 2: Use Mock Data (For Testing)

If all Spotify calls fail, use mock data temporarily:

```python
# In backend/main.py, after line 611:
if len(recommendations.get('tracks', [])) == 0:
    print("Using mock data for testing")
    recommendations = {
        'tracks': [
            {
                'id': 'mock1',
                'name': 'Test Song 1',
                'artists': [{'name': 'Test Artist', 'id': 'mock_artist'}],
                'album': {
                    'name': 'Test Album',
                    'images': [{'url': 'https://via.placeholder.com/300'}]
                },
                'preview_url': None,
                'external_urls': {'spotify': 'https://open.spotify.com'},
                'duration_ms': 180000,
                'popularity': 75
            }
            # Add 9 more...
        ]
    }
```

---

### Debugging Commands

#### Check Backend Status
```bash
curl http://localhost:5001/get_user
```

#### Check Next.js API
```bash
curl http://localhost:3000/api/spotify-auth \
  -H "Cookie: spotify_session_id=YOUR_SESSION_ID"
```

#### Test DJ Recommend
```bash
curl -X POST http://localhost:3000/api/dj-recommend \
  -H "Content-Type: application/json" \
  -H "Cookie: spotify_session_id=YOUR_SESSION_ID" \
  -d '{"message": "Give me some music"}'
```

---

### Common Error Messages

#### "HTTP Error 404 for recommendations"
- **Cause**: Spotify recommendations API unavailable
- **Solution**: Use top tracks fallback (already implemented)

#### "Not authenticated"
- **Cause**: Missing or expired session
- **Solution**: Click "Connect Spotify" and re-authenticate

#### "Token expired"
- **Cause**: Spotify token needs refresh
- **Solution**: Re-authenticate or implement token refresh

#### "No tracks returned"
- **Cause**: Empty Spotify history or API failure
- **Solution**: Build listening history or use mock data

---

### Verification Checklist

After applying fixes:

- [ ] Backend starts without errors
- [ ] Frontend compiles successfully
- [ ] Spotify authentication works
- [ ] Browser console shows tracks received
- [ ] Backend logs show success messages
- [ ] Tracks display in UI
- [ ] Album art loads
- [ ] Spotify links work
- [ ] Exactly 10 tracks shown

---

### Still Not Working?

1. **Restart Everything**:
   ```bash
   # Kill all processes
   pkill -f "python main.py"
   pkill -f "next"
   
   # Start backend
   cd backend && source ../venv/bin/activate && python main.py
   
   # Start frontend
   npm run dev
   ```

2. **Clear Browser Cache**:
   - Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
   - Clear cookies for localhost
   - Try incognito mode

3. **Check Environment Variables**:
   ```bash
   # In backend directory
   cat ../.env | grep -E "CLIENT_ID|CLIENT_SECRET|GROQ_API_KEY"
   ```

4. **Verify Dependencies**:
   ```bash
   # Backend
   pip list | grep -E "spotipy|flask|groq"
   
   # Frontend
   npm list | grep -E "framer-motion|lucide-react"
   ```

---

### Getting Help

If still stuck, gather this information:

1. **Browser Console Output** (full errors)
2. **Backend Terminal Output** (last 50 lines)
3. **Frontend Terminal Output** (any errors)
4. **Network Tab** (check /api/dj-recommend response)
5. **Spotify Account Type** (Free/Premium)
6. **Steps to Reproduce**

Then check:
- GitHub Issues
- Spotify API Status: https://status.spotify.com
- Groq API Status

---

## 🎉 Success Indicators

When everything works correctly, you should see:

**Browser Console:**
```
DJ Recommendation Response: {
  dj_response: "Let's pump up that workout!...",
  tracks: [10 track objects],
  total_tracks: 10
}
Tracks received: 10
```

**Backend Logs:**
```
Attempting Spotify recommendations with seeds:
  Artists: ['4NHQUGzhtTLFvgF5SZesLK', ...]
  Genres: ['pop', 'rock']
  Tracks: None
  Market: US
SUCCESS: Got 10 recommendations
SUCCESS: Returning 10 tracks
127.0.0.1 - - [Date] "POST /dj_recommend HTTP/1.1" 200 -
```

**UI:**
- DJ intro appears (2-3 sentences)
- Playlist card shows "🎵 Your Playlist (10 tracks)"
- 10 tracks with album art
- Hover effects work
- Spotify links open correctly

