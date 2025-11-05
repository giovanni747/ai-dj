# AI DJ - Spotify Login Integration

## Overview
This app has been integrated with Spotify OAuth authentication. Users must log in with Spotify before using the AI DJ features.

## Setup Instructions

### 1. Start the Flask Backend
```bash
cd backend
source ../venv/bin/activate  # Or use: cd venv && source bin/activate
python main.py
```

The Flask server will run on `http://127.0.0.1:5001`

### 2. Start the Next.js Frontend
```bash
npm run dev
```

The Next.js app will run on `http://localhost:3000`

### 3. Configuration
Make sure you have a `.env` file in the root directory with:
```
CLIENT_ID=your_spotify_client_id
CLIENT_SECRET=your_spotify_client_secret
GROQ_API_KEY=your_groq_api_key
```

And update the Spotify redirect URI in the Spotify Dashboard to:
```
http://127.0.0.1:5001/callback
```

## How It Works

1. **User visits the app**: First-time users see the Spotify login screen
2. **Click "Continue with Spotify"**: Redirects to Flask backend OAuth endpoint
3. **Spotify Authentication**: User authorizes the app on Spotify
4. **Callback**: Spotify redirects back to Flask with auth code
5. **Session Created**: Flask stores auth token in session
6. **Frontend Check**: Next.js checks if user is authenticated via `/api/spotify-auth`
7. **AI DJ Interface**: If authenticated, user sees the AI DJ chat interface

## Flow Diagram

```
User → Next.js Page (not authenticated)
     ↓
Spotify Login Component
     ↓
Click "Continue with Spotify"
     ↓
Redirect to Flask OAuth: http://127.0.0.1:5001/
     ↓
Flask redirects to Spotify OAuth
     ↓
User authorizes on Spotify
     ↓
Spotify redirects to Flask callback: http://127.0.0.1:5001/callback
     ↓
Flask creates session, stores auth token
     ↓
Flask redirects to: http://127.0.0.1:5001/get_playlists
     ↓
User's browser now has session cookie
     ↓
Next.js can now call Flask API with credentials
     ↓
User sees AI DJ interface
```

## API Endpoints

### Flask Backend
- `GET /` - OAuth login (redirects to Spotify)
- `GET /callback` - OAuth callback from Spotify
- `GET /get_user` - Get current authenticated user info
- `POST /dj_recommend` - Get AI DJ recommendations
- `POST /clear_conversation` - Clear chat history

### Next.js API Routes
- `GET /api/spotify-auth` - Check if user is authenticated
- `POST /api/dj-recommend` - Proxy to Flask DJ recommendations
- `POST /api/clear-conversation` - Proxy to Flask clear conversation

## Adding Playlist Creation

To add the ability to create playlists and push them to Spotify accounts, you need to:

1. **Update OAuth Scopes** in `backend/main.py`:
```python
scope = '...playlist-modify-public playlist-modify-private'
```

2. **Re-authenticate** users (they'll be prompted on next login)

3. **Add route** to create playlists:
```python
@app.route('/create_playlist', methods=['POST'])
def create_playlist():
    sp, redirect_response = get_authenticated_spotify()
    if redirect_response:
        return redirect_response
    
    data = request.json
    user = sp.current_user()
    playlist = sp.user_playlist_create(
        user=user['id'],
        name=data['name'],
        description=data['description'],
        public=False
    )
    
    track_ids = data.get('track_ids', [])
    if track_ids:
        sp.playlist_add_items(playlist['id'], track_ids)
    
    return jsonify({
        'playlist_id': playlist['id'],
        'playlist_url': playlist['external_urls']['spotify']
    })
```

## Testing

1. Start Flask backend: `python backend/main.py`
2. Start Next.js frontend: `npm run dev`
3. Visit `http://localhost:3000`
4. Click "Continue with Spotify"
5. Authorize the app
6. You should see the AI DJ interface

## Troubleshooting

### CORS Errors
Make sure Flask-CORS is installed and configured in `backend/main.py`

### Session Not Persisting
- Flask uses server-side sessions with session cookies
- Make sure `supports_credentials=True` in CORS config
- Use `credentials: 'include'` in fetch calls

### Authentication Not Working
- Check that Flask redirect URL matches Spotify app settings
- Verify CLIENT_ID and CLIENT_SECRET in .env
- Check browser console for errors

