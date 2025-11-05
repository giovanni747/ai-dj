# Spotify API Setup Guide

## The Problem: "User Not Registered" Error

If you're getting a **403 error** saying "the user may not be registered", it's because your Spotify app is in **Development Mode**.

In Development Mode:
- ❌ Only explicitly allowlisted users can access your app
- ❌ Other Spotify accounts get 403 Forbidden errors
- ⚠️ Maximum 25 users allowed

---

## Solutions

### **Option 1: Add Users to Allowlist (Quick Fix)**

**Best for:** Testing with a few specific users

**Steps:**
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click on your app
3. Go to **Settings** → **User Management**
4. Click **"Add New User"**
5. Enter the user's **name** and **Spotify email address**
6. Click **Save**

**Limitations:**
- Maximum 25 users
- Manual process for each user
- Users must have a Spotify account

---

### **Option 2: Enable Development Mode (Testing)**

**Best for:** Development and testing with mock data

**Steps:**

1. Add this to your `.env` file:
   ```bash
   DEV_MODE=true
   ```

2. Restart the Flask server:
   ```bash
   cd backend
   source ../venv/bin/activate
   python main.py
   ```

**What this does:**
- ✅ App works with ANY Spotify account for auth
- ✅ Uses mock data when real user data isn't available
- ✅ Perfect for testing UI and features
- ⚠️ Mock data includes: The Weeknd, Dua Lipa, Harry Styles, etc.

---

### **Option 3: Request Quota Extension (25+ Users)**

**Best for:** Apps with 25-100 users

**Steps:**
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click on your app
3. Click **"Request Extension"**
4. Fill out the form:
   - App name and description
   - Use case explanation
   - Expected number of users

**Timeline:** 3-5 business days

---

### **Option 4: Submit for Production (Unlimited Users)**

**Best for:** Public apps available to everyone

**Requirements:**
- Privacy Policy (hosted URL)
- Terms of Service (hosted URL)
- App description and screenshots
- Detailed use case

**Steps:**
1. Prepare required documents
2. Go to your [Spotify Dashboard](https://developer.spotify.com/dashboard)
3. Click **"Request Quota Extension"**
4. Submit the full application

**Timeline:** 5-10 business days

**Resources:**
- [Spotify App Review Guide](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- [Privacy Policy Generator](https://www.privacypolicygenerator.info/)
- [Terms of Service Generator](https://www.termsofservicegenerator.net/)

---

## Current App Configuration

### ✅ What's Working:
- Session storage (in-memory fallback)
- Mock data for recommendations
- UI and chat interface
- LLM integration with Groq

### ⚠️ What Requires Real Spotify Data:
- User's actual listening history
- Personalized recommendations based on taste
- Real top artists and genres

### 🎭 Mock Data Provided:
- Genres: pop, rock, indie, electronic, hip hop
- Artists: The Weeknd, Dua Lipa, Harry Styles, Billie Eilish, Post Malone
- Audio features: Energy 0.65, Danceability 0.70, Valence 0.55
- 10 popular tracks for recommendations

---

## Recommended Approach

**For Development/Testing:**
1. ✅ Use `DEV_MODE=true` in your `.env` file
2. ✅ Test with any Spotify account
3. ✅ Mock data will be used automatically when needed

**For Limited Release (Friends/Beta Testers):**
1. Add up to 25 users to your app's allowlist
2. They'll get real personalized recommendations

**For Public Release:**
1. Submit for Quota Extension
2. Provide privacy policy and terms
3. Wait for Spotify approval

---

## Testing Your Setup

Run both servers:
```bash
# Terminal 1: Flask Backend
cd backend
source ../venv/bin/activate
python main.py

# Terminal 2: Next.js Frontend
PORT=3000 npm run dev
```

Then:
1. Open http://localhost:3000
2. Click "Connect with Spotify"
3. Authorize with ANY Spotify account
4. Start chatting with the AI DJ!

If you see the 403 error, the mock data will automatically kick in! 🎉

