# Testing Checklist - AI DJ Constraints

Use this checklist to verify that all constraints are working correctly.

---

## 🚀 Setup

- [ ] Backend running on port 5001
- [ ] Frontend running on port 3000
- [ ] Spotify authenticated
- [ ] Browser console open (F12) to check responses

---

## ✅ DJ Response Constraints

### Test 1: Response Length
**Prompt:** "Give me some music"

- [ ] DJ response is 2-3 sentences (not a long paragraph)
- [ ] DJ response does NOT list songs
- [ ] DJ response is enthusiastic and conversational

**Expected:**
> "Let's get you some fresh tunes! Based on your taste, I've got a killer mix that'll keep you vibing. Check out these tracks!"

**Not Expected:**
> "Here are some songs: 1. Song A, 2. Song B, 3. Song C..."

---

### Test 2: Music-Only Conversations

#### Test 2a: Weather Question
**Prompt:** "What's the weather like?"

- [ ] DJ redirects to music
- [ ] DJ maintains personality
- [ ] DJ suggests music-related alternative

**Expected:**
> "Hey, I'm all about the music! But speaking of weather, how about some sunny vibes or rainy day tunes? What mood are you in?"

---

#### Test 2b: Math Question
**Prompt:** "What's 2+2?"

- [ ] DJ redirects to music
- [ ] DJ doesn't answer the math question
- [ ] DJ suggests music instead

**Expected:**
> "I'm here for the music, not the math! How about I calculate the perfect playlist for you instead? What vibe are you feeling?"

---

#### Test 2c: General Knowledge
**Prompt:** "Tell me about the Eiffel Tower"

- [ ] DJ redirects to music
- [ ] DJ might reference French music
- [ ] DJ stays on topic

**Expected:**
> "I'm all about the beats, not the sights! But since you mentioned Paris, how about some French house or indie pop? Let's explore some international sounds!"

---

## 🎵 Track Constraints

### Test 3: Track Count
**Prompt:** "Recommend me some songs"

- [ ] Exactly 10 tracks returned
- [ ] No more, no less
- [ ] All tracks have position numbers (1-10)

**Check API response:**
```json
{
  "tracks": [...],
  "total_tracks": 10  // Must be 10
}
```

---

### Test 4: Track Structure
**Prompt:** "Give me workout music"

For each track, verify:
- [ ] Has `position` field (1-10)
- [ ] Has `id` (Spotify track ID)
- [ ] Has `name` (song title)
- [ ] Has `artist` (comma-separated string)
- [ ] Has `artists` array with objects
- [ ] Has `album` object with `name` and `images`
- [ ] Has `external_url` (Spotify link)
- [ ] Has `duration_ms` (number)
- [ ] Has `popularity` (number 0-100)
- [ ] Has `preview_url` (string or null)

---

### Test 5: Track Display
**Prompt:** "I want chill music"

In the UI, verify each track shows:
- [ ] Position number (1-10)
- [ ] Album art thumbnail
- [ ] Song name
- [ ] Artist name
- [ ] Duration (MM:SS format)
- [ ] Popularity badge (if popularity ≥ 70)
- [ ] Spotify link (appears on hover)

---

## 🎨 UI/UX Tests

### Test 6: Animations
**Prompt:** "Surprise me with music"

- [ ] DJ intro fades in smoothly
- [ ] Playlist card appears after intro
- [ ] Tracks appear with staggered animation
- [ ] Hover effects work on tracks
- [ ] Album art shows play button overlay on hover

---

### Test 7: Responsiveness
**Prompt:** "Give me party music"

- [ ] Layout works on desktop
- [ ] Layout works on tablet (if applicable)
- [ ] Layout works on mobile (if applicable)
- [ ] Tracks are readable at all sizes
- [ ] Album art scales properly

---

## 🔄 Conversation Flow

### Test 8: Context Awareness
**Prompt 1:** "I like rock music"
**Prompt 2:** "Give me more like that"

- [ ] DJ remembers previous context
- [ ] Second response references rock music
- [ ] Tracks are related to rock genre

---

### Test 9: Multiple Requests
**Prompt 1:** "Give me workout music"
**Prompt 2:** "Now give me chill music"
**Prompt 3:** "Something upbeat"

- [ ] Each response is independent
- [ ] Each response has 10 tracks
- [ ] DJ adapts to each request
- [ ] Previous playlists remain visible

---

## 📊 Data Format Tests

### Test 10: JSON Structure
**Prompt:** "Recommend me songs"

Open browser console and check API response:

```javascript
// Should match this structure
{
  "dj_response": "string (2-3 sentences)",
  "tracks": [
    {
      "position": 1,
      "id": "string",
      "name": "string",
      "artist": "string",
      "artists": [{"name": "string", "id": "string"}],
      "album": {
        "name": "string",
        "images": [{"url": "string"}]
      },
      "preview_url": "string or null",
      "external_url": "string",
      "duration_ms": number,
      "popularity": number
    }
    // ... 9 more
  ],
  "total_tracks": 10
}
```

- [ ] Structure matches exactly
- [ ] All fields are present
- [ ] Data types are correct

---

### Test 11: CSV Export (if implemented)
**Prompt:** "Give me music"

If you've implemented CSV export:
- [ ] CSV download works
- [ ] CSV has correct headers
- [ ] CSV has 10 rows (plus header)
- [ ] CSV data is properly escaped
- [ ] CSV opens in Excel/Google Sheets

---

## 🚨 Error Handling

### Test 12: No Authentication
**Setup:** Clear cookies and refresh

- [ ] Shows authentication dialog
- [ ] Provides clear instructions
- [ ] Redirects to Spotify auth
- [ ] Returns to app after auth

---

### Test 13: Network Error
**Setup:** Stop backend server

- [ ] Shows error message
- [ ] Error message is user-friendly
- [ ] Suggests checking backend
- [ ] Doesn't crash the app

---

### Test 14: Invalid Request
**Prompt:** Send empty message

- [ ] Handles gracefully
- [ ] Shows appropriate error
- [ ] Doesn't break conversation

---

## 🎯 Edge Cases

### Test 15: Very Long Prompt
**Prompt:** "I want music that is upbeat and energetic and makes me want to dance and has a fast tempo and is perfect for working out and has motivational lyrics and is from the 2000s and is similar to Eminem and has a hip-hop vibe and is popular and has a good beat..."

- [ ] DJ responds appropriately
- [ ] Still returns 10 tracks
- [ ] Doesn't timeout
- [ ] Response is still concise

---

### Test 16: Obscure Genre
**Prompt:** "Give me some vaporwave"

- [ ] DJ handles gracefully
- [ ] Returns 10 tracks (even if not exact match)
- [ ] Explains the genre if needed
- [ ] Doesn't return error

---

### Test 17: Rapid Requests
**Action:** Send 5 requests quickly

- [ ] All requests are handled
- [ ] Responses don't overlap
- [ ] Loading states work correctly
- [ ] No race conditions

---

## 📱 Cross-Browser Tests

### Test 18: Browser Compatibility
Test in multiple browsers:

**Chrome:**
- [ ] All features work
- [ ] Animations smooth
- [ ] No console errors

**Firefox:**
- [ ] All features work
- [ ] Animations smooth
- [ ] No console errors

**Safari:**
- [ ] All features work
- [ ] Animations smooth
- [ ] No console errors

---

## 🔒 Security Tests

### Test 19: XSS Prevention
**Prompt:** "Give me <script>alert('xss')</script> music"

- [ ] Script doesn't execute
- [ ] Text is properly escaped
- [ ] No security warnings in console

---

### Test 20: API Key Exposure
**Action:** Check network tab and source code

- [ ] API keys not visible in frontend
- [ ] API keys not in network responses
- [ ] Environment variables properly secured

---

## ✅ Final Checklist

### Functionality
- [ ] DJ gives short intros (2-3 sentences)
- [ ] DJ only discusses music
- [ ] Exactly 10 tracks per response
- [ ] Tracks display with album art
- [ ] Spotify links work
- [ ] Animations work smoothly

### Data Quality
- [ ] All track data is complete
- [ ] Album art loads correctly
- [ ] Durations are accurate
- [ ] Popularity scores are present
- [ ] Spotify links are valid

### User Experience
- [ ] Interface is intuitive
- [ ] Loading states are clear
- [ ] Errors are user-friendly
- [ ] Conversations flow naturally
- [ ] Performance is good

### Code Quality
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] No linter warnings
- [ ] Code is well-documented
- [ ] Types are properly defined

---

## 📝 Test Results

### Date: ___________
### Tester: ___________

**Tests Passed:** ___ / 20

**Issues Found:**
1. ___________________________________________
2. ___________________________________________
3. ___________________________________________

**Notes:**
___________________________________________
___________________________________________
___________________________________________

---

## 🎉 Success Criteria

All tests should pass with:
- ✅ DJ responses are 2-3 sentences
- ✅ Exactly 10 tracks every time
- ✅ Music-only conversations
- ✅ Beautiful track display
- ✅ No errors or crashes
- ✅ Smooth user experience

If all criteria are met, your AI DJ is ready to rock! 🎵

