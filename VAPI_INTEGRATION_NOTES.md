# 🎙️ VAPI Integration Notes

## ⚠️ Important: VAPI API Structure

VAPI is primarily designed for **conversational AI** (voice assistants, phone calls), not standalone Text-to-Speech.

### Current Implementation

The current implementation tries to use VAPI's TTS endpoint. However, **VAPI's exact API structure may vary** based on:
- Your VAPI account type
- Your configured assistants
- Whether you have phone numbers set up

### Options

#### Option 1: Use VAPI (if you have a configured assistant)
If you have a VAPI assistant configured, you may need to:
1. Update the endpoint in `app/api/vapi-tts/route.ts`
2. Adjust the request body format to match VAPI's actual API

#### Option 2: Use ElevenLabs Directly (Recommended for TTS)
Since VAPI uses ElevenLabs under the hood, you might prefer using ElevenLabs directly for simpler TTS:

**Benefits:**
- ✅ Direct API (well-documented)
- ✅ No assistant setup needed
- ✅ Same voice quality
- ✅ Simpler integration

**To switch to ElevenLabs:**
1. Replace `use-vapi-tts.ts` with an ElevenLabs implementation
2. Use endpoint: `https://api.elevenlabs.io/v1/text-to-speech/{voiceId}`
3. Add `NEXT_PUBLIC_ELEVENLABS_API_KEY` to `.env.local`

#### Option 3: Keep Current Setup (with fallback)
The current implementation has built-in fallback:
- ✅ Tries VAPI API first
- ✅ Falls back to browser TTS if VAPI fails
- ✅ Graceful error handling

### Getting VAPI Working

1. **Sign up at [vapi.ai](https://vapi.ai)**
2. **Check your VAPI dashboard** for:
   - Available API endpoints
   - Voice configuration options
   - API documentation specific to your account

3. **Update the endpoint** in `app/api/vapi-tts/route.ts` based on VAPI's actual API structure

### Testing

The code will automatically fall back to browser TTS if VAPI is not configured or fails, so you can:
- Test without VAPI keys (uses browser TTS)
- Add VAPI keys when ready
- Adjust the endpoint as needed

### Environment Variables Needed

```env
# For VAPI (current implementation)
NEXT_PUBLIC_VAPI_PUBLIC_KEY=pk_your_key_here
VAPI_PRIVATE_KEY=sk_your_key_here

# OR for ElevenLabs (alternative)
NEXT_PUBLIC_ELEVENLABS_API_KEY=your_elevenlabs_key_here
```

---

## 🎯 Current Status

✅ **Code compiles and runs**  
✅ **Has graceful fallback to browser TTS**  
⚠️ **VAPI endpoint may need adjustment** based on your VAPI account setup  
✅ **No breaking errors** - will work with browser TTS until VAPI is configured  

---

## 📚 Resources

- [VAPI Documentation](https://docs.vapi.ai)
- [ElevenLabs API Docs](https://elevenlabs.io/docs/api-reference/text-to-speech)
- [VAPI Dashboard](https://dashboard.vapi.ai)

