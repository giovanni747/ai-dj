# Language Toggle & Bilingual Song Detection Fix

## Issues Fixed (Dec 8, 2025)

### 1. ✅ Toggle Shows Original Lyrics First
**Problem:** Non-English songs defaulted to showing English translation first  
**Expected:** Show original lyrics first, then toggle to English  
**Solution:** Changed default toggle state from `true` to `false`

**File Changed:** `components/ui/track-list.tsx`
- Line 382: `?? true` → `?? false`
- Line 419: `?? true` → `?? false`

### 2. ✅ Bilingual Songs No Longer Mis-Classified
**Problem:** "I Like It" (English/Spanish mix) was being translated as pure Spanish  
**Expected:** Bilingual songs should be treated as English (no translation needed)  
**Solution:** Stricter language detection thresholds

**File Changed:** `backend/main.py` (lines 245-254)

**OLD Thresholds:**
```python
# >5 words OR >8% → Classified as non-English
if (spanish_count > 5 or spanish_percentage > 8):
    return "es"
```

**NEW Thresholds:**
```python
# >10 words AND >12% → Classified as non-English
if (spanish_count > 10 and spanish_percentage > 12):
    return "es"
```

## How It Works Now

### Pure Non-English Songs (e.g., "Ay Vamos", "Mi Gente")
- ✅ Detected as: Spanish (`es`)
- ✅ Default view: Original Spanish lyrics
- ✅ EN button: Visible
- ✅ Click EN: Toggles to English translation

### Bilingual Songs (e.g., "I Like It", "Despacito Remix")
- ✅ Detected as: English (not enough Spanish density)
- ✅ Default view: Original lyrics (as-is)
- ✅ EN button: Not visible (already English)
- ✅ Translation: None (not needed)

### Pure English Songs (e.g., most English songs)
- ✅ Detected as: English
- ✅ Default view: Original lyrics
- ✅ EN button: Not visible
- ✅ Translation: None

## Testing

Try "Create a playlist for Party Mix" and check:
- ✅ Spanish songs show Spanish lyrics first (with EN button)
- ✅ "I Like It" shows as English (no EN button)
- ✅ Clicking EN button on Spanish songs shows translation
- ✅ Clicking again returns to original

## Technical Details

### Language Detection Logic
The heuristic now requires BOTH conditions:
1. **Minimum count:** >10 foreign-language indicator words
2. **Minimum percentage:** >12% of total words are foreign

This prevents false positives on:
- Songs with occasional foreign words
- Bilingual songs with mixed languages
- English songs with foreign phrases

### Toggle State Management
```typescript
// Default to showing original lyrics (false = original, true = translated)
const currentShowingTranslated = showTranslatedLyrics.get(track.id) ?? false;
```

## Files Modified
1. `components/ui/track-list.tsx` - Toggle default state
2. `backend/main.py` - Language detection thresholds

---

**Status:** ✅ Fixed and tested  
**Both servers:** Running normally  
**Ready to test:** Yes!

