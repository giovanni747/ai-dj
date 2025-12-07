# 🎙️ ElevenLabs TTS Integration - Setup Guide

## ✅ Why ElevenLabs Instead of VAPI?

**VAPI** is designed for **conversational voice AI** (real-time calls, voice widgets), not simple TTS.

**ElevenLabs** is perfect for TTS:
- ✅ **Simple API** - Direct text-to-speech conversion
- ✅ **Excellent Quality** - Natural, human-like voices
- ✅ **Fast & Reliable** - Optimized for TTS use cases
- ✅ **100+ Voices** - Many options to choose from
- ✅ **Good Pricing** - $5/month gets you 30,000 characters (~100-200 DJ responses)

---

## 🚀 Quick Setup

### Step 1: Get Your ElevenLabs API Key

1. **Sign up** at [elevenlabs.io](https://elevenlabs.io)
2. **Go to Profile** → **API Key**
3. **Copy your API key** (starts with your account identifier)

### Step 2: Add to Environment Variables

Add to your `.env.local` file:

```env
# ElevenLabs Text-to-Speech
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
```

⚠️ **Note:** This is a **server-side key** (stays secure on your backend)

### Step 3: Restart Your Dev Server

```bash
# Stop server (Ctrl+C)
npm run dev
```

---

## 🎤 Available Voices

ElevenLabs has 100+ voices. Here are popular ones:

### Female Voices:
- `21m00Tcm4TlvDq8ikWAM` - **Rachel** (Default) - Warm, professional
- `EXAVITQu4vr4xnSDxMaL` - **Bella** - Soft, calm
- `ThT5KcBeYPX3keUQqHPh` - **Dorothy** - Clear, energetic
- `VR6AewLTigWG4xSOukaG` - **Arnold** - Deep, authoritative (actually male)

### Male Voices:
- `VR6AewLTigWG4xSOukaG` - **Arnold** - Deep, strong
- `pNInz6obpgDQGcFmaJgB` - **Adam** - Natural, conversational
- `TxGEqnHWrfWFTfGW9XjX` - **Josh** - Energetic, young

### Multilingual Voices:
- All voices support multiple languages
- Model `eleven_multilingual_v2` handles 28 languages

### Browse All Voices:
Visit [elevenlabs.io/voice-library](https://elevenlabs.io/voice-library)

---

## 🎛️ How to Change Voice

Edit in `components/ui/ai-input-demo.tsx`:

```typescript
const { speak, cancel, isMuted, toggleMute, isSpeaking } = useElevenLabsTTS({
  voiceId: 'EXAVITQu4vr4xnSDxMaL', // Change to any voice ID
  modelId: 'eleven_multilingual_v2' // Best quality model
});
```

---

## 💰 Pricing

### Free Tier:
- **10,000 characters/month** (~30-50 DJ responses)
- **Great for testing!**

### Starter ($5/month):
- **30,000 characters/month** (~100-200 DJ responses)
- **Perfect for personal use**

### Creator ($22/month):
- **100,000 characters/month** (~300-600 DJ responses)
- **Good for small apps**

### Pro ($99/month):
- **500,000 characters/month** (~1,500-3,000 DJ responses)
- **For production apps**

**Estimate:** Each DJ message ≈ 150-300 characters

---

## 🔧 How It Works

```
User receives DJ message
        ↓
Frontend calls speak(text)
        ↓
Sends request to /api/elevenlabs-tts
        ↓
Backend calls ElevenLabs API with secure key
        ↓
ElevenLabs generates high-quality audio
        ↓
Backend streams audio to frontend
        ↓
Frontend plays audio through avatar
        ↓
Avatar animates while speaking (isSpeaking = true)
```

---

## ✨ Features

✅ **High Quality**: Professional AI voices (not robotic)  
✅ **Fast**: ~1-2 seconds to generate audio  
✅ **Reliable**: Direct TTS API (not conversational AI)  
✅ **Secure**: Private key stays on server  
✅ **Seamless**: Drop-in replacement for VAPI  
✅ **Avatar Sync**: Works perfectly with Rive avatar animations  
✅ **Fallback**: Auto-falls back to browser TTS if not configured  

---

## 🧪 Test It

1. Add your ElevenLabs API key to `.env.local`
2. Restart the server: `npm run dev`
3. Send a message to your DJ
4. Listen to the **professional AI voice**! 🎉

---

## 🆚 Comparison: VAPI vs ElevenLabs

| Feature | VAPI | ElevenLabs |
|---------|------|------------|
| **Primary Use** | Conversational AI | Text-to-Speech |
| **API Complexity** | Complex (calls, assistants) | Simple (text → audio) |
| **Voice Quality** | Good (uses ElevenLabs) | Excellent |
| **Setup** | Complex | Simple |
| **Cost** | Higher | Lower |
| **Best For** | Voice widgets, calls | TTS (your use case) |

**Verdict:** ✅ **ElevenLabs is the right choice for your DJ app!**

---

## 📚 Resources

- [ElevenLabs Documentation](https://docs.elevenlabs.io)
- [Voice Library](https://elevenlabs.io/voice-library)
- [API Reference](https://docs.elevenlabs.io/api-reference/text-to-speech)
- [Pricing](https://elevenlabs.io/pricing)

---

## 🎉 You're All Set!

Your AI DJ now uses **ElevenLabs professional TTS**! Test it and enjoy the high-quality voice! 🎵🎧

