# AI DJ Constraints & Response Format

## Overview

The AI DJ has been configured with strict constraints to ensure consistent, high-quality music recommendations.

---

## 🎯 DJ Constraints

### 1. **Music-Only Focus**
- The DJ **ONLY** discusses music-related topics:
  - Songs, artists, albums, genres
  - Music history, concerts, festivals
  - Audio features (energy, mood, tempo)
  - Music production, instruments
- If asked about non-music topics, the DJ politely redirects to music

### 2. **Response Format**
- **DJ Introduction**: 2-3 sentences maximum
- **Enthusiastic & Conversational**: Like a real DJ
- **No Song Lists**: The DJ does NOT list songs in the response
- **References User Taste**: Mentions user's preferences when relevant

### 3. **Track Recommendations**
- **Exactly 10 songs** per recommendation
- Songs are provided separately from the DJ's intro
- Tracks are structured in JSON format for easy parsing

---

## 📊 Response Structure

### API Response Format

```json
{
  "dj_response": "Yo! Based on your love for indie rock and those chill vibes, I've got the perfect set for you. These tracks blend atmospheric guitars with introspective lyrics that'll hit just right. Let's dive in!",
  "tracks": [
    {
      "position": 1,
      "id": "spotify_track_id",
      "name": "Song Title",
      "artist": "Artist Name",
      "artists": [
        { "name": "Artist Name", "id": "artist_id" }
      ],
      "album": {
        "name": "Album Name",
        "images": [
          { "url": "https://..." }
        ]
      },
      "preview_url": "https://...",
      "external_url": "https://open.spotify.com/track/...",
      "duration_ms": 240000,
      "popularity": 75
    }
    // ... 9 more tracks
  ],
  "total_tracks": 10
}
```

### CSV Export Format

Tracks can be exported to CSV with the following columns:

```csv
Position,Track Name,Artist,Album,Duration (ms),Popularity,Spotify URL,Preview URL
1,"Song Title","Artist Name","Album Name",240000,75,"https://...","https://..."
```

---

## 🎨 Example DJ Responses

### Good Examples ✅

**Request**: "Give me some upbeat songs for a workout"
**DJ Response**: 
> "Let's pump up that workout! I'm dropping 10 high-energy bangers that'll keep your heart racing and your feet moving. These tracks are all about that adrenaline rush with explosive beats and motivating vibes!"

**Request**: "I want something chill for studying"
**DJ Response**:
> "Perfect study vibes coming your way! I've curated 10 mellow tracks with smooth instrumentals and ambient textures that'll help you focus without being distracting. Time to get in the zone!"

**Request**: "Surprise me with something new"
**DJ Response**:
> "Alright, let's explore some fresh sounds! Based on your taste for electronic and indie, I'm mixing in some genre-bending tracks that'll expand your horizons. Get ready for something different!"

### Bad Examples ❌

**Too Long**:
> "Hey there! So I was thinking about your music taste and I noticed you really like indie rock, especially bands like Arctic Monkeys and The Strokes. I also saw that you enjoy some electronic music on the side, particularly artists like ODESZA and Flume. Based on all of this information, I've carefully selected 10 tracks that I think you'll really enjoy..."

**Lists Songs**:
> "Here are my recommendations:
> 1. Song A by Artist X
> 2. Song B by Artist Y
> 3. Song C by Artist Z..."

**Off-Topic**:
> "Sure! But first, let me tell you about the weather today. It's really nice outside, perfect for a walk. Speaking of walks, have you tried that new restaurant downtown?"

---

## 🛠️ Implementation Details

### Backend (`ai_service.py`)

The LLM is constrained with:
- **System Prompt**: Enforces music-only responses and format
- **Max Tokens**: Limited to 200 to enforce brevity
- **Temperature**: 0.8 for creative but consistent responses
- **Context Injection**: User's music profile is provided for personalization

### API Endpoint (`/dj_recommend`)

- Returns exactly **10 tracks** from Spotify
- Tracks are sorted by position (1-10)
- Includes full metadata for each track
- Conversation history is maintained for context

### Frontend Integration

Use the provided utilities:

```typescript
import { tracksToCSV, downloadTracksAsCSV, formatDuration } from "@/lib/track-utils";
import type { DJRecommendation, SpotifyTrack } from "@/types";

// Fetch recommendations
const response = await fetch('/api/dj-recommend', {
  method: 'POST',
  body: JSON.stringify({ message: userInput })
});

const data: DJRecommendation = await response.json();

// Display DJ intro
console.log(data.dj_response);

// Display tracks
data.tracks.forEach(track => {
  console.log(`${track.position}. ${track.name} by ${track.artist}`);
});

// Export to CSV
downloadTracksAsCSV(data.tracks, 'my-playlist.csv');
```

---

## 🔒 Guardrails

### Non-Music Requests

If a user asks about non-music topics:

**User**: "What's the weather like?"
**DJ**: "Hey, I'm all about the music! But speaking of weather, how about some sunny vibes or rainy day tunes? What mood are you in?"

**User**: "Tell me a joke"
**DJ**: "I've got jokes, but they're all about music! How about I drop you some feel-good tracks that'll make you smile instead? What do you say?"

### Inappropriate Requests

The DJ maintains a professional, music-focused persona and redirects inappropriate requests to music recommendations.

---

## 📈 Future Enhancements

Potential improvements:
- **Mood Detection**: Analyze user message sentiment for better recommendations
- **Lyrics Integration**: Include relevant lyrics snippets for each track
- **Playlist Creation**: Automatically create Spotify playlists from recommendations
- **Track Filtering**: Allow users to exclude genres or artists
- **Audio Preview**: Play 30-second previews directly in the UI

---

## 🧪 Testing

Test the constraints with these prompts:

1. ✅ "Give me workout music"
2. ✅ "I want sad songs"
3. ✅ "Recommend something like The Weeknd"
4. ❌ "What's 2+2?" (Should redirect to music)
5. ❌ "Tell me about politics" (Should redirect to music)
6. ✅ "Surprise me"
7. ✅ "I need focus music for coding"

---

## 📝 Summary

- **DJ gives short intros** (2-3 sentences)
- **Exactly 10 tracks** per recommendation
- **Music-only** conversations
- **Structured JSON** response format
- **CSV export** available via utilities
- **Type-safe** with TypeScript interfaces

