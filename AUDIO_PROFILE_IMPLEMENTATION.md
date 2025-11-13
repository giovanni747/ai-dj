# Audio Profile from Liked Tracks - Implementation Summary

## Overview
Implemented a system to use user's liked tracks' audio features as a fallback when Spotify API audio features are unavailable due to rate limits. The system calculates average audio features from liked tracks and uses them for similarity scoring.

## Database Changes

### 1. Schema Migration
**File**: `backend/add_audio_features_to_track_likes.sql`

Added three new columns to `track_likes` table:
- `energy` (REAL) - Energy level (0.0-1.0)
- `danceability` (REAL) - Danceability score (0.0-1.0)
- `valence` (REAL) - Valence/mood score (0.0-1.0)

**To apply migration:**
```bash
psql $DATABASE_URL -f backend/add_audio_features_to_track_likes.sql
```

Or run the SQL directly in your Neon console.

## Code Changes

### 2. Database Functions (`backend/chat_db.py`)

#### Updated `toggle_track_like()`
- Now accepts `energy`, `danceability`, and `valence` parameters
- Stores audio features when a track is liked

#### New `get_user_audio_profile()`
- Calculates average audio features from user's liked tracks
- Returns dict with `energy`, `danceability`, `valence`, and `track_count`
- Returns `None` if user has no liked tracks with audio features

### 3. Track Like Endpoint (`backend/main.py`)

#### Updated `/track_like` endpoint
- Fetches audio features from Spotify API when a track is liked
- Stores audio features in database along with the like
- Handles errors gracefully (continues without features if API fails)

### 4. AI Service (`backend/ai_service.py`)

#### Updated `get_recommendations()`
- Checks Spotify API audio features first
- Falls back to database audio profile if Spotify API unavailable
- Uses default values (0.5) if neither available
- Logs which source is being used

### 5. Recommendation Logic (`backend/main.py`)

#### Updated `dj_recommend()` endpoint
- Loads database audio profile before making recommendations
- Passes database profile to AI service
- Uses database profile for similarity scoring when Spotify API unavailable

#### Updated audio feature filtering
- Checks Spotify API first, then database profile
- Uses database averages for similarity scoring
- Calculates match scores based on energy, danceability, and valence similarity

## How It Works

### 1. When User Likes a Track
```
User clicks like → Fetch audio features from Spotify → Store in database
```

### 2. When Making Recommendations
```
1. Try to get audio features from Spotify API (user's top tracks)
2. If unavailable, get average from liked tracks in database
3. If no liked tracks, use default values (0.5 for all)
4. Use audio features for:
   - LLM prompt context
   - Similarity scoring of recommended tracks
```

### 3. Similarity Scoring
Tracks are scored based on how similar their audio features are to the user's profile:
- **Energy**: 40% weight
- **Danceability**: 40% weight  
- **Valence**: 20% weight

Lower difference = better match = higher recommendation score

## Default Values

When a user has no liked tracks with audio features:
- **Energy**: 0.5 (neutral)
- **Danceability**: 0.5 (neutral)
- **Valence**: 0.5 (neutral)

These defaults ensure the system still works for new users, but recommendations will improve as they like more tracks.

## Benefits

1. **Works around Spotify API limits**: Uses database as fallback
2. **Personalized recommendations**: Based on actual user preferences (liked tracks)
3. **Improves over time**: More liked tracks = better profile
4. **Graceful degradation**: Defaults ensure system always works

## Testing

1. **Like some tracks** - Audio features should be fetched and stored
2. **Check database** - Verify `energy`, `danceability`, `valence` columns are populated
3. **Make recommendations** - Should use database profile if Spotify API unavailable
4. **Check logs** - Should see messages about which audio profile source is used

## Future Improvements

1. **Batch fetch audio features** - When user has many liked tracks without features
2. **Weighted averages** - Recent likes weighted more heavily
3. **Genre-specific profiles** - Separate profiles for different genres
4. **Update existing likes** - Backfill audio features for tracks liked before this feature

---

*Implementation Date: 2025-11-13*

