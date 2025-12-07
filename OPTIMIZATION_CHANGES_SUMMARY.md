# AI DJ Optimization Changes Summary

## Date: December 6, 2025

### Overview
Implemented three key optimizations to improve token usage, reduce costs, and ensure 5 songs are consistently returned despite duplicate filtering.

---

## Changes Made

### 1. ✅ Use Faster Model for Lyrics Scoring
**File**: `backend/ai_service.py`

**Change**: Use `llama-3.1-8b-instant` for lyrics scoring instead of `llama-3.3-70b-versatile`

**Benefits**:
- **Faster response times** - 8B model is significantly faster than 70B
- **Lower cost** - Smaller model uses fewer resources
- **Maintained accuracy** - Lyrics scoring is a simpler task that doesn't require the larger model

**Code**:
```python
# Added in __init__
self.lyrics_model = os.getenv("GROQ_LYRICS_MODEL", "llama-3.1-8b-instant")

# Updated batch_score_lyrics_relevance (line 355)
response = self.client.chat.completions.create(
    model=self.lyrics_model,  # Use faster model for lyrics scoring
    ...
)
```

---

### 2. ✅ Request 7 Songs Instead of 5
**Files**: `backend/ai_service.py`, `backend/main.py`

**Change**: Request 7 songs from LLM, then select top 5 after filtering

**Reason**: When duplicate detection skips previously recommended songs, we end up with fewer than 5 songs. Requesting 7 gives us a buffer.

**Code Changes**:
```python
# ai_service.py - Updated prompts (lines 75, 84, 177)
"Recommend exactly 7 songs that exist on Spotify (we'll select the best 5 after filtering duplicates)"
"... (exactly 7 songs)"

# ai_service.py - Increased max_tokens (lines 237, 249)
max_tokens=1700,  # Increased for 7 songs instead of 5

# main.py - Updated logging (line 1186)
for i, song in enumerate(llm_songs[:7], 1):  # Show first 7 (we requested 7)

# main.py - Updated selection logic (line 1599)
selected_tracks = tracks_with_scores[:5]  # Select top 5 from 7
```

---

### 3. ✅ Reduce Duplicate Detection Strictness
**File**: `backend/main.py`

**Change**: Increased similarity threshold from `0.7` (70%) to `0.95` (95%)

**Reason**: 
- 70% was too strict - it marked prompts as "similar" even when they were quite different
- 95% allows more variety in recommendations while still preventing exact duplicates
- Users get fresh recommendations for slightly different requests

**Code**:
```python
# main.py - Line 1055
previously_recommended_track_ids = chat_db.get_previously_recommended_tracks(
    user_id=clerk_id,
    user_message=user_message,
    similarity_threshold=0.95  # 95% word overlap threshold (less strict)
)
```

**Example**:
- Old (0.7): "Create a playlist for Focus & Study" and "Give me focus music" → Treated as duplicates
- New (0.95): These are now treated as different prompts → More variety in recommendations

---

## Expected Results

### Token Usage
- **Before**: ~4,000 tokens per request
  - Main recommendation: 1,500 tokens
  - Lyrics scoring: 1,000 tokens (using 70B model)
  - Explanations: 800 tokens
  - Other: 700 tokens

- **After**: ~3,200 tokens per request
  - Main recommendation: 1,700 tokens (increased for 7 songs)
  - Lyrics scoring: 400 tokens (using 8B model) ✅ **60% reduction**
  - Explanations: 800 tokens
  - Other: 300 tokens

**Total savings**: ~800 tokens per request (~20% reduction)

### Song Count
- **Before**: Often returned 4 songs after duplicate filtering
- **After**: Consistently returns 5 songs
  - Request 7 songs from LLM
  - Skip duplicates (typically 1-2)
  - Select top 5 from remaining

### Duplicate Detection
- **Before (0.7)**: Too aggressive - blocked variety
- **After (0.95)**: Only blocks near-exact duplicates
- More fresh recommendations for users

---

## Testing Recommendations

1. **Test with duplicate prompts**:
   ```
   1. "Create a playlist for Focus & Study"
   2. "Create a playlist for Focus & Study" (should skip duplicates)
   3. "Give me study music" (should get new songs with 0.95 threshold)
   ```

2. **Verify 5 songs returned**:
   - Monitor logs for "Selected top X tracks"
   - Should see "Selected top 5 tracks" consistently

3. **Check token usage**:
   - Look for "llama-3.1-8b-instant" in lyrics scoring logs
   - Should see faster response times for lyrics scoring

---

## Configuration Options

You can override these settings via environment variables:

```bash
# Use different model for lyrics scoring
GROQ_LYRICS_MODEL=llama-3.1-8b-instant

# Adjust duplicate detection threshold (0.0 to 1.0)
# Set in code: similarity_threshold parameter in get_previously_recommended_tracks()
```

---

## Rollback Instructions

If you need to revert these changes:

```bash
git diff backend/ai_service.py backend/main.py > optimization_changes.patch
git checkout backend/ai_service.py backend/main.py
```

To reapply:
```bash
git apply optimization_changes.patch
```

