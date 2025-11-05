# Quick Start Guide - AI DJ with Constraints

## 🚀 Start the Application

### 1. Start Backend (Terminal 1)
```bash
cd /Users/giovannisanchez/ai-dj/backend
source ../venv/bin/activate
python main.py
```
**Expected output:** `Running on http://127.0.0.1:5001`

### 2. Start Frontend (Terminal 2)
```bash
cd /Users/giovannisanchez/ai-dj
npm run dev
```
**Expected output:** `Ready on http://localhost:3000`

---

## 🎯 What Changed?

### Before:
- DJ response was long and included song lists
- Variable number of tracks (up to 20)
- DJ could talk about anything
- Tracks were not displayed in UI

### After:
- ✅ DJ gives **2-3 sentence intro only**
- ✅ **Exactly 10 tracks** every time
- ✅ DJ **only discusses music**
- ✅ Tracks displayed with **album art & metadata**
- ✅ **CSV export** available
- ✅ **Structured JSON** format

---

## 🧪 Test It Out

### Good Prompts (Music-Related)
```
"Give me workout music"
"I want sad songs"
"Recommend something like The Weeknd"
"Surprise me"
"I need focus music for coding"
```

**Expected Result:**
1. Short DJ intro (2-3 sentences)
2. Playlist card with 10 tracks
3. Each track shows: position, album art, name, artist, duration

### Bad Prompts (Non-Music)
```
"What's the weather?"
"Tell me a joke"
"What's 2+2?"
```

**Expected Result:**
DJ redirects back to music:
> "Hey, I'm all about the music! But speaking of weather, how about some sunny vibes or rainy day tunes? What mood are you in?"

---

## 📊 Response Format

### API Response
```json
{
  "dj_response": "Short DJ intro here...",
  "tracks": [
    {
      "position": 1,
      "id": "spotify_id",
      "name": "Song Name",
      "artist": "Artist Name",
      "album": { "name": "...", "images": [...] },
      "duration_ms": 240000,
      "popularity": 75,
      "external_url": "https://...",
      "preview_url": "https://..."
    }
    // ... 9 more tracks (total: 10)
  ],
  "total_tracks": 10
}
```

---

## 🎨 UI Features

### Track Display
- **Position numbers** (1-10)
- **Album art** with hover effects
- **Song & artist names**
- **Duration** (MM:SS format)
- **Popularity badges** (for popular tracks)
- **Spotify links** (on hover)

### Animations
- Staggered track entrance
- Smooth fade-in effects
- Hover interactions

---

## 📁 Key Files

### Backend
- `backend/ai_service.py` - LLM constraints & prompts
- `backend/main.py` - `/dj_recommend` endpoint

### Frontend
- `types/index.ts` - TypeScript interfaces
- `lib/track-utils.ts` - CSV export & utilities
- `components/ui/track-list.tsx` - Track display component
- `components/ui/ai-input-demo.tsx` - Main chat interface

### Documentation
- `DJ_CONSTRAINTS.md` - Detailed constraints & examples
- `IMPLEMENTATION_SUMMARY.md` - Complete implementation details
- `QUICK_START.md` - This file

---

## 🔧 Common Customizations

### Change Track Count
**File:** `backend/main.py` (line 577)
```python
limit=10,  # Change to 5, 15, 20, etc.
```

### Adjust DJ Response Length
**File:** `backend/ai_service.py` (line 90)
```python
max_tokens=200  # Increase for longer intros
```

### Modify DJ Personality
**File:** `backend/ai_service.py` (lines 47-59)
```python
system_prompt = """Your custom DJ personality here..."""
```

---

## 📤 Export Tracks

### As CSV
```typescript
import { downloadTracksAsCSV } from "@/lib/track-utils";

downloadTracksAsCSV(tracks, "my-playlist.csv");
```

### As JSON
```typescript
const json = JSON.stringify(tracks, null, 2);
// Download or save as needed
```

---

## 🐛 Troubleshooting

### Backend Not Running
```bash
# Check if port 5001 is in use
lsof -ti:5001 | xargs kill -9

# Restart backend
cd backend && source ../venv/bin/activate && python main.py
```

### Frontend Not Running
```bash
# Check if port 3000 is in use
lsof -ti:3000 | xargs kill -9

# Restart frontend
npm run dev
```

### Spotify Authentication Issues
1. Go to `http://localhost:3000`
2. Click "Connect Spotify"
3. Authorize the app
4. You'll be redirected back

### DJ Not Following Constraints
Check the backend logs for errors. The LLM model might need adjustment:

**File:** `backend/ai_service.py` (line 14)
```python
self.model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
```

Try different models if needed.

---

## ✅ Verification Checklist

- [ ] Backend running on port 5001
- [ ] Frontend running on port 3000
- [ ] Spotify authenticated
- [ ] DJ gives short responses (2-3 sentences)
- [ ] Exactly 10 tracks displayed
- [ ] Tracks show album art
- [ ] Spotify links work
- [ ] Non-music prompts redirected

---

## 🎉 You're All Set!

Your AI DJ is now configured with strict constraints:
- **Music-only conversations**
- **Short DJ intros**
- **Exactly 10 tracks**
- **Beautiful track display**
- **CSV export ready**

Enjoy discovering music! 🎵

