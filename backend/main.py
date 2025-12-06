import os
import sys
from pathlib import Path
import json
import requests
from typing import Optional

from flask import Flask, session, url_for, redirect, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

from spotipy import Spotify
from spotipy.oauth2 import SpotifyOAuth
from spotipy.cache_handler import CacheHandler
from ai_service import GroqRecommendationService
from db import store_token, get_token, delete_token
from chat_db import chat_db
from rate_limiter import get_rate_limit_status

# Genius API for lyrics
try:
    import lyricsgenius
    GENIUS_API_KEY = os.getenv("GENIUS_API_KEY")
    genius = lyricsgenius.Genius(GENIUS_API_KEY, timeout=10, remove_section_headers=True) if GENIUS_API_KEY else None
    if genius:
        genius.verbose = False  # Disable verbose output
        print("✅ Genius API initialized")
    else:
        print("⚠️  GENIUS_API_KEY not found - lyrics will not be available")
except ImportError:
    genius = None
    print("⚠️  lyricsgenius not installed - lyrics will not be available")

# Weather API (OpenWeatherMap)
WEATHER_API_KEY = os.getenv("WEATHER_API_KEY")
WEATHER_BASE_URL = "http://api.openweathermap.org/data/2.5/weather"

def get_weather_data(lat=None, lon=None, city=None):
    """
    Fetch weather data from OpenWeatherMap API.
    
    Args:
        lat: Latitude (optional)
        lon: Longitude (optional)
        city: City name (optional, e.g., "London,UK")
    
    Returns:
        Dict with weather info or None if error
    """
    print(f"🌤️ [WEATHER DEBUG] get_weather_data called with: lat={lat}, lon={lon}, city={city}", flush=True)
    sys.stdout.flush()
    
    if not WEATHER_API_KEY:
        print("🌤️ [WEATHER DEBUG] ⚠️  WEATHER_API_KEY not found - weather data will not be available", flush=True)
        sys.stdout.flush()
        return None
    
    try:
        params = {
            'appid': WEATHER_API_KEY,
            'units': 'metric'  # Use 'imperial' for Fahrenheit
        }
        
        if lat and lon:
            params['lat'] = lat
            params['lon'] = lon
            print(f"🌤️ [WEATHER DEBUG] Using coordinates: {lat}, {lon}", flush=True)
        elif city:
            params['q'] = city
            print(f"🌤️ [WEATHER DEBUG] Using city: {city}", flush=True)
        else:
            # Default to New York if no location provided
            params['q'] = 'New York,US'
            print(f"🌤️ [WEATHER DEBUG] Using default location: New York,US", flush=True)
        
        print(f"🌤️ [WEATHER DEBUG] Making API request to: {WEATHER_BASE_URL}", flush=True)
        print(f"🌤️ [WEATHER DEBUG] Request params: {dict((k, v if k != 'appid' else '***') for k, v in params.items())}", flush=True)
        sys.stdout.flush()
        
        response = requests.get(WEATHER_BASE_URL, params=params, timeout=5)
        print(f"🌤️ [WEATHER DEBUG] API response status: {response.status_code}", flush=True)
        sys.stdout.flush()
        
        response.raise_for_status()
        data = response.json()
        
        weather_result = {
            'temperature': data['main']['temp'],
            'feels_like': data['main']['feels_like'],
            'description': data['weather'][0]['description'],
            'condition': data['weather'][0]['main'],  # e.g., "Rain", "Clear", "Clouds"
            'humidity': data['main']['humidity'],
            'city': data['name'],
            'country': data['sys']['country']
        }
        
        print(f"🌤️ [WEATHER DEBUG] ✅ Weather data retrieved successfully:", flush=True)
        print(f"   - City: {weather_result['city']}, {weather_result['country']}", flush=True)
        print(f"   - Temperature: {weather_result['temperature']}°C (feels like {weather_result['feels_like']}°C)", flush=True)
        print(f"   - Condition: {weather_result['condition']} ({weather_result['description']})", flush=True)
        print(f"   - Humidity: {weather_result['humidity']}%", flush=True)
        sys.stdout.flush()
        
        return weather_result
    except Exception as e:
        print(f"🌤️ [WEATHER DEBUG] ⚠️  Error fetching weather: {type(e).__name__}: {e}", flush=True)
        import traceback
        print(f"🌤️ [WEATHER DEBUG] Traceback: {traceback.format_exc()}", flush=True)
        sys.stdout.flush()
        return None


env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.urandom(24).hex()  # Convert bytes to hex string

# Development mode flag for testing without full Spotify auth
DEV_MODE = os.getenv('DEV_MODE', 'false').lower() == 'true'
if DEV_MODE:
    print("⚠️  WARNING: Running in DEV_MODE - using mock data for restricted accounts")

# Enable CORS for Next.js frontend
CORS(app, supports_credentials=True, origins=['http://127.0.0.1:3000', 'http://localhost:3000']) 

client_id = os.getenv("CLIENT_ID").strip()  # Remove any whitespace
client_secret = os.getenv("CLIENT_SECRET").strip()
# Redirect URI - must match EXACTLY what's set in Spotify Developer Dashboard
# Use environment variable if set, otherwise default to 127.0.0.1
redirect_url = os.getenv("SPOTIFY_REDIRECT_URI", "http://127.0.0.1:5001/callback")
nextjs_url = "http://127.0.0.1:3000"  # Next.js frontend URL

scope = 'user-read-private user-read-email playlist-read-private playlist-read-collaborative user-top-read user-read-recently-played playlist-modify-public playlist-modify-private'

# Use database-based cache handler
class DBCacheHandler(CacheHandler):
    def __init__(self, session_id):
        self.session_id = session_id
    
    def get_cached_token(self):
        return get_token(self.session_id)
    
    def save_token_to_cache(self, token_info):
        store_token(self.session_id, token_info)

# We'll get session_id from request
def get_session_id():
    # Try to get from cookie or header
    session_id = request.cookies.get('spotify_session_id')
    if not session_id:
        # Generate new session ID
        import uuid
        session_id = str(uuid.uuid4())
    return session_id

def get_clerk_user_id():
    """Get Clerk user ID from request header"""
    clerk_id = request.headers.get('X-Clerk-User-Id')
    if not clerk_id:
        raise ValueError("Clerk user ID not found in request headers")
    return clerk_id

# Initialize AI service
ai_service = GroqRecommendationService()

def create_spotify_oauth(session_id):
    """Create Spotify OAuth instance"""
    cache_handler = DBCacheHandler(session_id)
    return SpotifyOAuth(
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=redirect_url,
        scope=scope,
        cache_handler=cache_handler,
        show_dialog=True
    )

def get_authenticated_spotify():
    """
    Helper function to get authenticated Spotify client.
    Returns tuple: (Spotify client, None) or (None, error_response)
    """
    session_id = get_session_id()
    sp_oauth = create_spotify_oauth(session_id)
    token_info = get_token(session_id)
    
    if not token_info or not sp_oauth.validate_token(token_info):
        # Return error dict instead of redirect
        return None, {'error': 'Not authenticated'}
    
    sp = Spotify(auth_manager=sp_oauth)
    return sp, None

def is_authenticated():
    """
    Check if user is authenticated without creating Spotify client.
    Returns True if authenticated, False otherwise.
    """
    try:
        session_id = get_session_id()
        token_info = get_token(session_id)
        return token_info is not None
    except:
        return False

def translate_lyrics(lyrics: str) -> tuple[str, Optional[str]]:
    """
    Translate lyrics to English if they're in a different language.
    
    Args:
        lyrics: Original lyrics text
    
    Returns:
        Tuple of (translated_lyrics, detected_language) or (original_lyrics, None) if already English or error
    """
    if not lyrics:
        return lyrics, None
    
    try:
        # Use Groq API for translation (since we're already using it)
        from groq import Groq
        groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        
        # First, detect language using a small sample
        sample = lyrics[:500]  # Use first 500 chars for detection
        
        detect_prompt = f"""Detect the language of this text. Return ONLY the ISO 639-1 language code (e.g., "es", "fr", "en", "de", "pt", "it").
If the text is in English, return "en". If you're unsure, return "en".

Text: {sample}

Language code:"""
        
        detection_response = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",  # Fast model for detection
            messages=[{"role": "user", "content": detect_prompt}],
            temperature=0.1,
            max_tokens=10
        )
        
        detected_lang = detection_response.choices[0].message.content.strip().lower()
        # Clean up response (remove quotes, periods, etc.)
        detected_lang = detected_lang.strip('"\'.,;:').lower()
        
        # If already English, return original
        if detected_lang in ["en", "english"]:
            print(f"    ℹ️  Lyrics already in English")
            return lyrics, "en"
        
        print(f"    🌐 Detected language: {detected_lang}, translating to English...")
        
        # Translate to English using current Groq model
        translate_prompt = f"""Translate the following song lyrics to English. 
Preserve the line breaks and structure. Do not add any explanations or commentary, only return the translated lyrics.

Original lyrics ({detected_lang}):
{lyrics}

English translation:"""
        
        try:
            translation_response = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",  # Updated to current model
                messages=[{"role": "user", "content": translate_prompt}],
                temperature=0.3,
                max_tokens=2000
            )
            
            translated = translation_response.choices[0].message.content.strip()
            
            # Clean up translation (remove any extra text the model might add)
            if translated.startswith("English translation:"):
                translated = translated.split("English translation:", 1)[1].strip()
            if translated.startswith("Translation:"):
                translated = translated.split("Translation:", 1)[1].strip()
            
            print(f"    ✅ Translated lyrics ({len(translated)} chars)")
            return translated, detected_lang
            
        except Exception as translation_error:
            # If translation fails, return original lyrics BUT preserve the detected language
            print(f"    ⚠️  Translation error: {translation_error}, keeping original lyrics")
            print(f"    ℹ️  Preserving detected language: {detected_lang}")
            return lyrics, detected_lang  # Return detected language, not None!
        
    except Exception as e:
        print(f"    ⚠️  Language detection or translation error: {e}, using original lyrics")
        # If we can't even detect language, return None (will default to 'en' later)
        return lyrics, None

def get_lyrics(track_name, artist_name):
    """
    Fetch lyrics from Genius API and translate to English if needed.
    
    Args:
        track_name: Name of the track
        artist_name: Name of the artist (can be comma-separated)
    
    Returns:
        Dict with keys: 'original', 'translated', 'language', or None if not found
    """
    if not genius:
        return None
    
    try:
        # Get primary artist (first one if comma-separated)
        primary_artist = artist_name.split(',')[0].strip() if ',' in artist_name else artist_name.strip()
        
        print(f"    🔍 Searching Genius for: '{track_name}' by {primary_artist}")
        
        # Search for the song
        song = genius.search_song(track_name, primary_artist)
        
        if song and song.lyrics:
            # Clean up lyrics (remove "Lyrics" header and extra whitespace)
            lyrics = song.lyrics
            # Remove common headers
            if lyrics.startswith("Lyrics"):
                lyrics = lyrics.split("\n", 1)[1] if "\n" in lyrics else lyrics
            lyrics = lyrics.strip()
            
            print(f"    ✅ Found lyrics ({len(lyrics)} chars)")
            
            # Translate if needed
            translated_lyrics, detected_lang = translate_lyrics(lyrics)
            
            # If detected_lang is None (error during detection), default to 'en'
            # But if detected_lang is set, use it even if translation failed
            final_language = detected_lang if detected_lang else 'en'
            
            # Check if translation actually happened (original ≠ translated)
            was_translated = translated_lyrics != lyrics
            
            if was_translated:
                print(f"    ✅ Translation successful: {final_language} → en")
            elif detected_lang and detected_lang != 'en':
                print(f"    ⚠️  Translation failed, but detected language is: {final_language}")
            else:
                print(f"    ℹ️  Lyrics are in English or could not detect language")
            
            result = {
                'original': lyrics,
                'translated': translated_lyrics,
                'language': final_language
            }
            
            return result
        else:
            print(f"    ⚠️  No lyrics found")
            return None
            
    except Exception as e:
        print(f"    ❌ Error fetching lyrics: {e}")
        return None

def get_itunes_preview_url(track_name, artist_name):
    """
    Fetch 30-second preview URL from iTunes API as fallback when Spotify preview is unavailable.
    
    Args:
        track_name: Name of the track
        artist_name: Name of the artist (can be comma-separated for multiple artists)
    
    Returns:
        Preview URL string or None if not found
    """
    try:
        # Clean artist name - take first artist if comma-separated
        primary_artist = artist_name.split(',')[0].strip() if ',' in artist_name else artist_name.strip()
        
        # Build search query: "artist track" format works best
        search_term = f"{primary_artist} {track_name}"
        
        # iTunes Search API endpoint
        url = "https://itunes.apple.com/search"
        params = {
            'term': search_term,
            'media': 'music',
            'entity': 'song',
            'limit': 1
        }
        
        # Make request (no authentication needed)
        response = requests.get(url, params=params, timeout=3)
        response.raise_for_status()
        
        data = response.json()
        
        # Check if results exist
        if data.get('resultCount', 0) > 0:
            result = data['results'][0]
            preview_url = result.get('previewUrl')
            
            if preview_url:
                print(f"    ✓ iTunes preview found: {preview_url[:50]}...")
                return preview_url
            else:
                print(f"    ⚠️  iTunes found track but no preview URL")
                return None
        else:
            print(f"    ⚠️  iTunes: No results found")
            return None
            
    except requests.exceptions.Timeout:
        print(f"    ⚠️  iTunes API timeout")
        return None
    except requests.exceptions.RequestException as e:
        print(f"    ⚠️  iTunes API error: {e}")
        return None
    except Exception as e:
        print(f"    ⚠️  Unexpected error fetching iTunes preview: {e}")
        return None

@app.route('/')
def home():
    # This is the OAuth entry point for Next.js
    if not is_authenticated():
        session_id = get_session_id()
        print(f"Starting OAuth with session_id: {session_id}")
        sp_oauth = create_spotify_oauth(session_id)
        auth_url = sp_oauth.get_authorize_url(state=session_id)
        return redirect(auth_url)
    
    # If already authenticated, redirect back to Next.js
    return redirect(nextjs_url)



@app.route('/callback')
def callback():
    try:
        # Check for error parameter from Spotify
        if 'error' in request.args:
            return redirect(f"{nextjs_url}/?error=access_denied")
        
        # Get authorization code
        if 'code' not in request.args:
            return redirect(f"{nextjs_url}/?error=missing_code")
        
        # IMPORTANT: Get session_id from the state parameter or generate new one
        # Spotify OAuth state can be used to pass session_id
        session_id = request.args.get('state') or get_session_id()
        
        print(f"\n=== CALLBACK DEBUG ===")
        print(f"Received state param: {request.args.get('state')}")
        print(f"Using session_id: {session_id}")
        print(f"Request cookies: {dict(request.cookies)}")
        
        sp_oauth = create_spotify_oauth(session_id)
        token_info = sp_oauth.get_access_token(request.args['code'])
        
        # Store token in database
        store_token(session_id, token_info)
        
        print(f"Token stored for session_id: {session_id}")
        print(f"Token info: {token_info.keys() if isinstance(token_info, dict) else 'token_info type: ' + str(type(token_info))}")
        
        # Pass session_id in URL so Next.js can set the cookie
        response = redirect(f"{nextjs_url}/?auth=success&session_id={session_id}")
        
        print(f"Redirecting with session_id in URL: {session_id}")
        import sys
        sys.stdout.flush()
        
        # DEBUG: After setting cookie
        print(f"Response headers: {dict(response.headers)}")
        set_cookie_headers = response.headers.getlist('Set-Cookie')
        print(f"Set-Cookie header: {set_cookie_headers}")
        
        if not set_cookie_headers:
            print("ERROR: No Set-Cookie header found in response!")
        else:
            print(f"SUCCESS: Cookie header is: {set_cookie_headers[0][:100]}")
        
        sys.stdout.flush()
        return response
    except Exception as e:
        print(f"Error in callback: {e}")
        import traceback
        traceback.print_exc()
        return redirect(f"{nextjs_url}/?error=auth_failed")

@app.route('/get_playlists')
def get_playlists():
    sp, redirect_response = get_authenticated_spotify()
    if redirect_response:
        return redirect_response
    
    playlists = sp.current_user_playlists()
    playlists_info = [(pl['name'], pl['external_urls']['spotify']) for pl in playlists['items']]
    playlist_html = '<br>'.join(f'{name}: {url}' for name, url in playlists_info)

    return playlist_html

@app.route('/get_user', methods=['GET', 'POST'])
def get_user():
    try:
        # DEBUG: Log all cookies received
        print(f"\n=== GET_USER DEBUG ===")
        print(f"Request cookies: {dict(request.cookies)}")
        
        session_id = get_session_id()
        print(f"Session ID from get_session_id(): {session_id}")
        
        # Get session_id from cookie header if present
        cookie_header = request.headers.get('Cookie', '')
        print(f"Cookie header: {cookie_header[:100]}")
        
        # Try to extract session_id from Cookie header if not in cookies
        if session_id not in request.cookies:
            if 'spotify_session_id=' in cookie_header:
                parts = cookie_header.split('spotify_session_id=')
                if len(parts) > 1:
                    session_id_from_header = parts[1].split(';')[0].strip()
                    print(f"Extracted session_id from Cookie header: {session_id_from_header}")
                    session_id = session_id_from_header
        
        token_info = get_token(session_id)
        print(f"Has token: {token_info is not None}")
        if token_info:
            print(f"Token expires at: {token_info.get('expires_at', 'N/A')}")
        
        sp, error = get_authenticated_spotify()
        if error:
            print(f"ERROR: {error}")
            return jsonify({'authenticated': False, 'error': 'Not authenticated'}), 401
        
        user = sp.current_user()
        print(f"SUCCESS: Authenticated user: {user['display_name']}")
        return jsonify({
            'authenticated': True,
            'display_name': user['display_name'],
            'email': user['email'],
            'id': user['id'],
            'profile_image_url': user['images'][0]['url'] if user['images'] else None,
            'followers': user['followers']['total'],
            'country': user['country'],
        })
    except Exception as e:
        print(f"Error in get_user: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'authenticated': False, 'error': str(e)}), 401


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('home'))

@app.route('/playlist/<playlist_id>/tracks')
def get_playlist_tracks(playlist_id):
    sp, redirect_response = get_authenticated_spotify()
    if redirect_response:
        return redirect_response
    
    playlist = sp.playlist(playlist_id)
    result = sp.playlist_tracks(playlist_id, limit=50)
    tracks_data = []
    for item in result['items']:
        track = item['track']
        if track and track['id']: 
            tracks_data.append({
                'name': track['name'],
                'artist': ', '.join([artist['name'] for artist in track['artists']]),
                'album': track['album']['name'],
                'preview_url': track['preview_url'],
                'external_url': track['external_urls']['spotify'],
                'duration_ms': track['duration_ms'],
                'popularity': track['popularity'],
                'track_id': track['id']
            })
    return {
        'playlist_name': playlist['name'],
        'playlist_description': playlist['description'],
        'total_tracks': playlist['tracks']['total'],
        'tracks': tracks_data
    }

@app.route('/track/<track_id>/audio_features')
def get_audio_features(track_id):
    """Audio features endpoint - tries to fetch from Spotify API, falls back to defaults"""
    sp, redirect_response = get_authenticated_spotify()
    if redirect_response:
        return redirect_response
    
    try:
        # Try to fetch audio features from Spotify API
        audio_features = sp.audio_features([track_id])
        if audio_features and audio_features[0]:
            features = audio_features[0]
            return {
                'energy': features.get('energy'),
                'danceability': features.get('danceability'),
                'valence': features.get('valence'),
                'tempo': features.get('tempo'),
                'acousticness': features.get('acousticness'),
                'instrumentalness': features.get('instrumentalness'),
                'liveness': features.get('liveness'),
                'speechiness': features.get('speechiness'),
                'loudness': features.get('loudness')
            }
    except Exception as e:
        # Handle 403 Forbidden (deprecated API) or other errors gracefully
        error_msg = str(e)
        if '403' in error_msg or 'Forbidden' in error_msg:
            print(f"  ℹ️  Audio features API not available for track {track_id} (403 Forbidden)")
        else:
            print(f"  ⚠️  Error fetching audio features for track {track_id}: {e}")
    
    # Return default values if API is not available
    return {
        'energy': 0.5,
        'danceability': 0.5,
        'valence': 0.5,
        'tempo': 120.0,
        'acousticness': 0.5,
        'instrumentalness': 0.5,
        'liveness': 0.5,
        'speechiness': 0.5,
        'loudness': -10.0
    }

@app.route('/track/audio-features')
def get_batch_audio_features():
    """Batch audio features endpoint - tries to fetch from Spotify API, falls back to defaults"""
    sp, redirect_response = get_authenticated_spotify()
    if redirect_response:
        return redirect_response
    
    track_ids = request.args.getlist('ids')
    if len(track_ids) > 100:
        return {'error': 'Maximum 100 tracks allowed'}, 400
    
    try:
        # Try to fetch audio features from Spotify API
        audio_features = sp.audio_features(track_ids)
        if audio_features and len(audio_features) > 0:
            # Return actual audio features
            features_list = []
            for i, track_id in enumerate(track_ids):
                if i < len(audio_features) and audio_features[i]:
                    features = audio_features[i]
                    features_list.append({
                        'energy': features.get('energy'),
                        'danceability': features.get('danceability'),
                        'valence': features.get('valence'),
                        'tempo': features.get('tempo'),
                        'acousticness': features.get('acousticness'),
                        'instrumentalness': features.get('instrumentalness'),
                        'liveness': features.get('liveness'),
                        'speechiness': features.get('speechiness'),
                        'loudness': features.get('loudness')
                    })
                else:
                    # Return defaults for tracks without features
                    features_list.append({
                        'energy': 0.5,
                        'danceability': 0.5,
                        'valence': 0.5,
                        'tempo': 120.0,
                        'acousticness': 0.5,
                        'instrumentalness': 0.5,
                        'liveness': 0.5,
                        'speechiness': 0.5,
                        'loudness': -10.0
                    })
            return {'audio_features': features_list}
    except Exception as e:
        # Handle 403 Forbidden (deprecated API) or other errors gracefully
        error_msg = str(e)
        if '403' in error_msg or 'Forbidden' in error_msg:
            print(f"  ℹ️  Audio features API not available (403 Forbidden)")
        else:
            print(f"  ⚠️  Error fetching audio features: {e}")
    
    # Return default values if API is not available
    default_features = {
        'energy': 0.5,
        'danceability': 0.5,
        'valence': 0.5,
        'tempo': 120.0,
        'acousticness': 0.5,
        'instrumentalness': 0.5,
        'liveness': 0.5,
        'speechiness': 0.5,
        'loudness': -10.0
    }
    
    # Return default features for each track
    features = [default_features.copy() for _ in track_ids]
    return {'audio_features': features}

@app.route('/get_top_tracks')
def get_top_tracks():
    sp, redirect_response = get_authenticated_spotify()
    if redirect_response:
        return redirect_response
    
    time_range = request.args.get('time_range', 'medium_term')  # short_term, medium_term, long_term
    limit = int(request.args.get('limit', 50))
    
    try:
        top_tracks = sp.current_user_top_tracks(time_range=time_range, limit=limit)
        tracks_data = []
        for track in top_tracks['items']:
            tracks_data.append({
                'name': track['name'],
                'artist': ', '.join([artist['name'] for artist in track['artists']]),
                'album': track['album']['name'],
                'preview_url': track['preview_url'],
                'external_url': track['external_urls']['spotify'],
                'duration_ms': track['duration_ms'],
                'popularity': track['popularity'],
                'track_id': track['id'],
                'images': track['album']['images']
            })
        return {'tracks': tracks_data, 'total': top_tracks['total']}
    except Exception as e:
        return {'error': str(e)}, 500

@app.route('/get_recently_played')
def get_recently_played():
    sp, redirect_response = get_authenticated_spotify()
    if redirect_response:
        return redirect_response
    
    limit = int(request.args.get('limit', 50))
    
    try:
        recent_tracks = sp.current_user_recently_played(limit=limit)
        tracks_data = []
        for item in recent_tracks['items']:
            track = item['track']
            tracks_data.append({
                'name': track['name'],
                'artist': ', '.join([artist['name'] for artist in track['artists']]),
                'album': track['album']['name'],
                'preview_url': track['preview_url'],
                'external_url': track['external_urls']['spotify'],
                'duration_ms': track['duration_ms'],
                'popularity': track['popularity'],
                'track_id': track['id'],
                'played_at': item['played_at'],
                'images': track['album']['images']
            })
        return {'tracks': tracks_data}
    except Exception as e:
        return {'error': str(e)}, 500

@app.route('/get_user_profile')
def get_user_profile():
    sp, redirect_response = get_authenticated_spotify()
    if redirect_response:
        return redirect_response
    
    try:
        # Get user info
        user = sp.current_user()
        
        # Get top tracks (short, medium, long term)
        top_tracks_short = sp.current_user_top_tracks(time_range='short_term', limit=10)
        top_tracks_medium = sp.current_user_top_tracks(time_range='medium_term', limit=20)
        
        # Get recently played
        recent_tracks = sp.current_user_recently_played(limit=20)
        
        # Get playlists
        playlists = sp.current_user_playlists(limit=50)
        
        # Audio features are no longer available from Spotify API (deprecated Nov 2024)
        # Return empty dict - will use database audio profile if available
        avg_features = {}
        
        # Extract genres from top artists
        top_artists = sp.current_user_top_artists(time_range='medium_term', limit=20)
        genres = []
        for artist in top_artists['items']:
            genres.extend(artist.get('genres', []))
        
        return {
            'user': {
                'display_name': user['display_name'],
                'email': user['email'],
                'id': user['id'],
                'followers': user['followers']['total']
            },
            'listening_patterns': {
                'top_tracks_short_term': len(top_tracks_short['items']),
                'top_tracks_medium_term': len(top_tracks_medium['items']),
                'recently_played': len(recent_tracks['items']),
                'playlists_count': len(playlists['items'])
            },
            'audio_features_avg': avg_features,
            'genres': list(set(genres))[:20],  # Unique genres, top 20
            'top_artists': [
                {
                    'name': artist['name'],
                    'popularity': artist['popularity'],
                    'genres': artist.get('genres', []),
                    'images': artist.get('images', [])
                }
                for artist in top_artists['items'][:10]
            ]
        }
    except Exception as e:
        return {'error': str(e)}, 500

def get_user_profile_data(sp, clerk_id=None):
    """
    Helper to get user profile data for AI recommendations
    Uses Redis caching to reduce API calls and improve speed
    """
    from redis_cache import get_cached_user_profile, cache_user_profile
    
    # Try to get from cache first
    if clerk_id:
        cached_profile = get_cached_user_profile(clerk_id)
        if cached_profile:
            print(f"✅ Using cached user profile for {clerk_id}")
            return cached_profile
    
    try:
        print(f"\n=== FETCHING REAL SPOTIFY USER PROFILE ===")
        
        # Get top tracks
        print("Fetching top tracks...")
        top_tracks = sp.current_user_top_tracks(time_range='medium_term', limit=20)
        print(f"  Found {len(top_tracks.get('items', []))} top tracks")
        
        # Get top artists
        print("Fetching top artists...")
        top_artists = sp.current_user_top_artists(time_range='medium_term', limit=20)
        print(f"  Found {len(top_artists.get('items', []))} top artists")
        
        # Log actual artists
        if top_artists.get('items'):
            artist_names = [a['name'] for a in top_artists['items'][:10]]
            print(f"  Top Artists: {artist_names}")
        
        # Audio features are no longer available from Spotify API (deprecated Nov 2024)
        # We'll use database-stored audio features from liked tracks instead
        avg_features = {}
        print(f"  ℹ️  Skipping Spotify audio features API (deprecated) - will use database audio profile if available")
        
        # Extract genres from artists
        genres = []
        for artist in top_artists['items']:
            genres.extend(artist.get('genres', []))
        
        profile_data = {
            'genres': list(set(genres))[:20],
            'top_artists': [
                {'name': a['name'], 'popularity': a['popularity']}
                for a in top_artists['items'][:10]
            ],
            'top_tracks': [
                {'name': t['name'], 'artist': ', '.join([a['name'] for a in t['artists']])}
                for t in top_tracks['items'][:10]
            ],
            'audio_features_avg': avg_features
        }
        
        print(f"=== RETURNING REAL SPOTIFY DATA ===")
        print(f"  Artists: {[a['name'] for a in profile_data['top_artists']]}")
        print(f"  Tracks: {[t['name'] for t in profile_data['top_tracks'][:5]]}")
        print(f"  Genres: {profile_data['genres'][:10]}")
        print(f"====================================\n")
        
        # Cache the profile for future requests
        if clerk_id:
            cache_user_profile(clerk_id, profile_data)
            print(f"✅ Cached user profile for {clerk_id}")
        
        return profile_data
        
    except Exception as e:
        print(f"\n❌ ERROR: Failed to get user profile from Spotify")
        print(f"Error details: {e}")
        import traceback
        traceback.print_exc()
        print(f"====================================\n")
        
        # DO NOT return mock data - raise the error instead
        raise ValueError(f"Failed to fetch user profile from Spotify: {str(e)}. Please check your Spotify authentication and permissions.")

@app.route('/chat', methods=['POST'])
def chat():
    sp, redirect_response = get_authenticated_spotify()
    if redirect_response:
        return redirect_response
    
    try:
        data = request.json
        user_message = data.get('message')
        
        if not user_message:
            return jsonify({"error": "Message is required"}), 400
        
        # Get Clerk user ID for caching
        clerk_id = session.get('clerk_user_id')
        
        # Get conversation history from session
        conversation_history = session.get('conversation_history', [])
        
        # Get user profile - MUST use real Spotify data (with caching)
        try:
            user_profile = get_user_profile_data(sp, clerk_id)
        except ValueError as e:
            print(f"❌ Failed to get user profile: {e}")
            return jsonify({"error": str(e)}), 500
        
        # Get AI recommendation
        ai_response = ai_service.get_recommendations(
            user_message,
            user_profile,
            conversation_history
        )
        
        # Update conversation history
        conversation_history.append({"role": "user", "content": user_message})
        conversation_history.append({"role": "assistant", "content": ai_response})
        session['conversation_history'] = conversation_history[-6:]  # Keep last 6 messages (optimized for token usage)
        
        return jsonify({
            "response": ai_response,
            "user_profile": user_profile
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/clear_conversation', methods=['POST'])
def clear_conversation():
    session.pop('conversation_history', None)
    return jsonify({"message": "Conversation cleared"})

@app.route('/analyze_profile')
def analyze_profile():
    sp, redirect_response = get_authenticated_spotify()
    if redirect_response:
        return redirect_response
    
    try:
        # Get Clerk user ID for caching
        clerk_id = session.get('clerk_user_id')
        
        # Get user profile - MUST use real Spotify data (with caching)
        try:
            user_profile = get_user_profile_data(sp, clerk_id)
        except ValueError as e:
            print(f"❌ Failed to get user profile: {e}")
            return jsonify({"error": str(e)}), 500
        
        # Get AI analysis
        analysis = ai_service.analyze_profile(user_profile)
        
        return jsonify({
            "analysis": analysis,
            "profile": user_profile
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/status', methods=['GET'])
def api_status():
    """Get current API status and rate limits"""
    try:
        status = get_rate_limit_status()
        return jsonify(status)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/dj_recommend', methods=['POST'])
def dj_recommend():
    """Get AI DJ recommendations: LLM recommends songs, then we fetch from Spotify"""
    sp, redirect_response = get_authenticated_spotify()
    if redirect_response:
        return redirect_response
    
    try:
        import json
        
        data = request.json
        user_message = data.get('message', 'recommend me some great songs')
        selected_tool = data.get('tool')
        
        # Get weather data if weather tool is selected
        weather_data = None
        print(f"🌤️ [WEATHER DEBUG] Checking tool: selected_tool={selected_tool}", flush=True)
        sys.stdout.flush()
        
        if selected_tool == 'weather':
            print("🌤️ [WEATHER DEBUG] ✅ Weather tool selected - fetching weather data...", flush=True)
            sys.stdout.flush()
            # Get location from request if available
            location = data.get('location')
            print(f"🌤️ [WEATHER DEBUG] Location from request: {location}", flush=True)
            print(f"🌤️ [WEATHER DEBUG] Location type: {type(location)}", flush=True)
            sys.stdout.flush()
            
            lat = location.get('lat') if location and isinstance(location, dict) else None
            lon = location.get('lon') if location and isinstance(location, dict) else None
            
            print(f"🌤️ [WEATHER DEBUG] Extracted coordinates: lat={lat}, lon={lon}", flush=True)
            sys.stdout.flush()
            
            if lat and lon:
                print(f"🌤️ [WEATHER DEBUG] 📍 Using user location: {lat}, {lon}", flush=True)
                sys.stdout.flush()
                weather_data = get_weather_data(lat=lat, lon=lon)
            else:
                print("🌤️ [WEATHER DEBUG] 📍 No user location provided, using default (New York)", flush=True)
                sys.stdout.flush()
                weather_data = get_weather_data()
            
            if weather_data:
                print(f"🌤️ [WEATHER DEBUG] ✅ Weather data fetched successfully:", flush=True)
                print(f"   - {weather_data['description']}, {weather_data['temperature']}°C in {weather_data['city']}", flush=True)
                print(f"🌤️ [WEATHER DEBUG] Weather data object: {weather_data}", flush=True)
                sys.stdout.flush()
            else:
                print("🌤️ [WEATHER DEBUG] ⚠️  Failed to fetch weather data - weather_data is None", flush=True)
                sys.stdout.flush()
        else:
            print(f"🌤️ [WEATHER DEBUG] Weather tool not selected (tool: {selected_tool}), skipping weather fetch", flush=True)
            sys.stdout.flush()
        
        # Get Clerk user ID for caching
        clerk_id = session.get('clerk_user_id')
        
        # Get user profile - MUST use real Spotify data (with caching)
        try:
            user_profile = get_user_profile_data(sp, clerk_id)
        except ValueError as e:
            # If get_user_profile_data fails, return error (no mock data)
            print(f"❌ Failed to get user profile: {e}")
            return jsonify({"error": str(e)}), 500
        
        # Get Clerk user ID for database operations
        clerk_id = None
        try:
            clerk_id = get_clerk_user_id()
        except Exception as e:
            print(f"⚠️  Could not get Clerk user ID: {e}")
        
        # Get previously recommended tracks for similar prompts (to avoid duplicates)
        previously_recommended_track_ids = set()
        if chat_db and clerk_id:
            try:
                previously_recommended_track_ids = chat_db.get_previously_recommended_tracks(
                    user_id=clerk_id,
                    user_message=user_message,
                    similarity_threshold=0.7  # 70% word overlap threshold
                )
            except Exception as e:
                print(f"⚠️  Could not load previously recommended tracks: {e}")
                # Continue without duplicate prevention
        
        # Get audio profile from database (liked tracks) as fallback
        if chat_db and clerk_id:
            try:
                db_audio_profile = chat_db.get_user_audio_profile(clerk_id)
                if db_audio_profile:
                    user_profile['db_audio_profile'] = db_audio_profile
                    print(f"✅ Loaded database audio profile: {db_audio_profile['track_count']} liked tracks")
                    print(f"   Energy: {db_audio_profile.get('energy', 0):.2f}, "
                          f"Danceability: {db_audio_profile.get('danceability', 0):.2f}, "
                          f"Valence: {db_audio_profile.get('valence', 0):.2f}")
                else:
                    print("⚠️  No database audio profile available (user has no liked tracks with audio features)")
            except Exception as e:
                print(f"⚠️  Could not load database audio profile: {e}")
                # Continue without database profile
        
        # Log user profile data
        print(f"\n=== USER PROFILE DATA ===")
        print(f"User message: {user_message}")
        print(f"Genres: {user_profile.get('genres', [])[:10]}")
        print(f"Top Artists: {[a['name'] for a in user_profile.get('top_artists', [])[:5]]}")
        print(f"Top Tracks: {[t['name'] for t in user_profile.get('top_tracks', [])[:5]]}")
        print(f"Audio Features (Spotify): {user_profile.get('audio_features_avg', {})}")
        print(f"Audio Features (Database): {user_profile.get('db_audio_profile', {})}")
        print(f"=========================\n")
        
        # Get conversation history
        conversation_history = session.get('conversation_history', [])
        
        # Get AI recommendations (JSON with intro + songs list)
        print(f"🌤️ [WEATHER DEBUG] Calling AI service with weather_data: {weather_data is not None}", flush=True)
        if weather_data:
            print(f"🌤️ [WEATHER DEBUG] Weather data being passed to AI: {weather_data}", flush=True)
        sys.stdout.flush()
        
        ai_response_raw = ai_service.get_recommendations(
            user_message,
            user_profile,
            conversation_history,
            weather_data=weather_data
        )
        
        # Log raw AI response
        print(f"\n=== AI RAW RESPONSE ===")
        print(f"{ai_response_raw}")
        print(f"=======================\n")
        
        # Parse JSON response from LLM
        try:
            # Try to extract JSON from response (in case LLM adds extra text)
            ai_response_json = json.loads(ai_response_raw)
        except json.JSONDecodeError as e:
            print(f"JSON decode error: {e}")
            print(f"Response length: {len(ai_response_raw)}")
            print(f"Response type: {type(ai_response_raw)}")
            
            # Try to extract JSON from markdown code blocks or plain text
            import re
            json_match = re.search(r'\{.*\}', ai_response_raw, re.DOTALL)
            if json_match:
                try:
                    json_str = json_match.group()
                    # Try to fix common JSON issues: unescaped quotes in strings
                    # This is a simple fix - replace unescaped quotes in string values
                    # More robust would be to use a JSON repair library, but this should handle most cases
                    ai_response_json = json.loads(json_str)
                except json.JSONDecodeError as e2:
                    print(f"Failed to parse extracted JSON: {e2}")
                    print(f"Extracted text: {json_str[:500]}")
                    # Try to manually fix common issues
                    try:
                        # Replace unescaped quotes in the intro field
                        fixed_json = re.sub(
                            r'"intro":\s*"([^"]*(?:\\.[^"]*)*)"',
                            lambda m: f'"intro": {json.dumps(m.group(1))}',
                            json_str,
                            flags=re.DOTALL
                        )
                        ai_response_json = json.loads(fixed_json)
                        print("✅ Fixed JSON by escaping quotes in intro field")
                    except Exception as e3:
                        print(f"Failed to fix JSON: {e3}")
                        # Last resort: try to extract just the intro and songs manually
                        # More flexible regex to handle unescaped quotes
                        intro_match = re.search(r'"intro":\s*"((?:[^"\\]|\\.|"(?!"))*(?:"|$))', json_str, re.DOTALL)
                        if not intro_match:
                            # Try even more flexible: find intro field and extract until we hit ", "songs"
                            intro_start = json_str.find('"intro":')
                            if intro_start != -1:
                                intro_start = json_str.find('"', intro_start + 8) + 1
                                songs_start = json_str.find('"songs":', intro_start)
                                if songs_start != -1:
                                    intro_text = json_str[intro_start:songs_start-2].strip().rstrip('",')
                                    # Clean up the intro text
                                    intro_text = intro_text.strip('"').replace('\\"', '"').replace('\\n', '\n')
                                    intro_match = type('obj', (object,), {'group': lambda self, n: intro_text if n == 1 else None})()
                        
                        songs_match = re.search(r'"songs":\s*\[(.*?)\]', json_str, re.DOTALL)
                        
                        if intro_match and songs_match:
                            intro_text = intro_match.group(1) if hasattr(intro_match, 'group') else intro_match
                            intro_text = intro_text.replace('\\"', '"').replace('\\n', '\n').strip('"')
                            # Try to parse songs array
                            try:
                                songs_str = '[' + songs_match.group(1) + ']'
                                songs = json.loads(songs_str)
                                ai_response_json = {"intro": intro_text, "songs": songs}
                                print("✅ Manually extracted intro and songs")
                            except Exception as e4:
                                print(f"Failed to parse songs: {e4}")
                                # If songs parsing fails, at least return the intro
                                ai_response_json = {"intro": intro_text, "songs": []}
                                print("⚠️  Extracted intro but failed to parse songs, using empty list")
                        else:
                            raise ValueError(f"Could not parse JSON from LLM response. Response was: {ai_response_raw[:500]}")
            else:
                raise ValueError(f"Could not find JSON in LLM response. Response was: {ai_response_raw[:500]}")
        
        # Extract intro and songs
        dj_intro = ai_response_json.get('intro', 'Check out these amazing tracks!')
        llm_songs = ai_response_json.get('songs', [])
        
        print(f"\n=== PARSED LLM RECOMMENDATIONS ===")
        print(f"DJ Intro: {dj_intro}")
        print(f"Songs to search: {len(llm_songs)}")
        for i, song in enumerate(llm_songs[:5], 1):
            print(f"  {i}. {song.get('title', 'Unknown')} by {song.get('artist', 'Unknown')}")
        print(f"==================================\n")
        
        # Get user's country for market parameter
        country = None
        try:
            me = sp.current_user()
            country = (me or {}).get('country')
        except Exception:
            country = None
        
        # Search Spotify for each recommended song
        # Exclude previously recommended tracks to avoid duplicates
        tracks = []
        found_count = 0
        skipped_duplicates = 0
        
        print(f"\n=== CHECKING FOR PREVIOUSLY RECOMMENDED TRACKS ===")
        if previously_recommended_track_ids:
            print(f"⚠️  Found {len(previously_recommended_track_ids)} tracks from similar prompts - will exclude duplicates")
        else:
            print(f"ℹ️  No similar prompts found - all recommendations will be new")
        print(f"================================================\n")
        
        for song_data in llm_songs:
            title = song_data.get('title', '').strip()
            artist = song_data.get('artist', '').strip()
            
            if not title or not artist:
                continue
            
            try:
                # Search for the song using both title and artist
                query = f"track:{title} artist:{artist}"
                print(f"Searching Spotify: {query}")
                
                search_results = sp.search(
                    q=query,
                    type='track',
                    limit=1,
                    market=country or 'US'
                )
                
                if search_results['tracks']['items']:
                    track = search_results['tracks']['items'][0]
                    track_id = track['id']
                    
                    # Skip if this track was previously recommended for a similar prompt
                    if track_id in previously_recommended_track_ids:
                        skipped_duplicates += 1
                        print(f"  ⏭️  Skipped (previously recommended): {track['name']} by {', '.join([a['name'] for a in track['artists']])}")
                        continue
                    
                    found_count += 1
                    
                    preview_url = track.get('preview_url')
                    print(f"  ✓ Found: {track['name']} by {', '.join([a['name'] for a in track['artists']])}")
                    print(f"    Preview URL: {preview_url if preview_url else 'NULL/None'}")
                    
                    # If Spotify preview is missing, try iTunes as fallback
                    if not preview_url:
                        print(f"    Trying iTunes API fallback...")
                        artist_name = ', '.join([a['name'] for a in track['artists']])
                        itunes_preview = get_itunes_preview_url(track['name'], artist_name)
                        if itunes_preview:
                            preview_url = itunes_preview
                    
                    tracks.append({
                        'position': len(tracks) + 1,
                        'id': track['id'],
                        'name': track['name'],
                        'artist': ', '.join([a['name'] for a in track['artists']]),
                        'artists': [{'name': a['name'], 'id': a['id']} for a in track['artists']],
                        'album': {
                            'name': track['album']['name'],
                            'images': track['album']['images']
                        },
                        'preview_url': preview_url,  # This will be Spotify or iTunes URL
                        'external_url': track['external_urls']['spotify'],
                        'duration_ms': track['duration_ms'],
                        'popularity': track['popularity']
                    })
                else:
                    # Try searching with just the title
                    search_results = sp.search(
                        q=f"track:{title}",
                        type='track',
                        limit=1,
                        market=country or 'US'
                    )
                    
                    if search_results['tracks']['items']:
                        track = search_results['tracks']['items'][0]
                        track_id = track['id']
                        
                        # Skip if this track was previously recommended for a similar prompt
                        if track_id in previously_recommended_track_ids:
                            skipped_duplicates += 1
                            print(f"  ⏭️  Skipped (previously recommended): {track['name']} by {', '.join([a['name'] for a in track['artists']])}")
                            continue
                        
                        found_count += 1
                        
                        preview_url = track.get('preview_url')
                        print(f"  ✓ Found (title only): {track['name']} by {', '.join([a['name'] for a in track['artists']])}")
                        print(f"    Preview URL: {preview_url if preview_url else 'NULL/None'}")
                        
                        # If Spotify preview is missing, try iTunes as fallback
                        if not preview_url:
                            print(f"    Trying iTunes API fallback...")
                            artist_name = ', '.join([a['name'] for a in track['artists']])
                            itunes_preview = get_itunes_preview_url(track['name'], artist_name)
                            if itunes_preview:
                                preview_url = itunes_preview
                        
                        tracks.append({
                            'position': len(tracks) + 1,
                            'id': track['id'],
                            'name': track['name'],
                            'artist': ', '.join([a['name'] for a in track['artists']]),
                            'artists': [{'name': a['name'], 'id': a['id']} for a in track['artists']],
                            'album': {
                                'name': track['album']['name'],
                                'images': track['album']['images']
                            },
                            'preview_url': preview_url,  # This will be Spotify or iTunes URL
                            'external_url': track['external_urls']['spotify'],
                            'duration_ms': track['duration_ms'],
                            'popularity': track['popularity']
                        })
                    else:
                        print(f"  ✗ Not found: {title} by {artist}")
                        
            except Exception as e:
                print(f"  ✗ Error searching for {title} by {artist}: {e}")
                continue
        
        print(f"\n=== SPOTIFY SEARCH RESULTS ===")
        print(f"Found {found_count} out of {len(llm_songs)} recommended songs")
        if skipped_duplicates > 0:
            print(f"Skipped {skipped_duplicates} duplicate(s) from similar prompts")
        print(f"==============================\n")
        
        # Try to fetch audio features for recommended tracks
        # Note: Audio features API may not be available for new apps (deprecated Nov 2024)
        # But we'll try anyway and gracefully handle errors
        print(f"\n=== FETCHING AUDIO FEATURES FOR RECOMMENDED TRACKS ===")
        if tracks:
            track_ids = [track['id'] for track in tracks]
            try:
                # Try to fetch audio features in batches (Spotify limit is 100 per request)
                audio_features = sp.audio_features(track_ids)
                print(f"  Attempting to fetch audio features for {len(track_ids)} tracks...")
                
                if audio_features and len(audio_features) > 0:
                    # Create a mapping of track_id to audio features
                    features_map = {}
                    for i, track_id in enumerate(track_ids):
                        if audio_features and i < len(audio_features) and audio_features[i]:
                            features_map[track_id] = audio_features[i]
                    
                    # Add audio features to each track
                    features_count = 0
                    for track in tracks:
                        if track['id'] in features_map:
                            features = features_map[track['id']]
                            track['audio_features'] = {
                                'energy': features.get('energy'),
                                'danceability': features.get('danceability'),
                                'valence': features.get('valence'),
                                'tempo': features.get('tempo'),
                                'acousticness': features.get('acousticness'),
                                'instrumentalness': features.get('instrumentalness'),
                                'liveness': features.get('liveness'),
                                'speechiness': features.get('speechiness'),
                                'loudness': features.get('loudness')
                            }
                            features_count += 1
                            print(f"  ✅ Added audio features for: {track['name']}")
                        else:
                            print(f"  ⚠️ No audio features available for: {track['name']}")
                            track['audio_features'] = None
                    
                    print(f"  ✅ Successfully fetched audio features for {features_count}/{len(tracks)} tracks")
                else:
                    print(f"  ⚠️ Audio features API returned empty response")
                    for track in tracks:
                        track['audio_features'] = None
                        
            except Exception as e:
                # Handle 403 Forbidden (deprecated API) or other errors gracefully
                error_msg = str(e)
                if '403' in error_msg or 'Forbidden' in error_msg:
                    print(f"  ℹ️  Audio features API not available (403 Forbidden - likely deprecated for new apps)")
                    print(f"  ℹ️  Will use database audio profile for similarity scoring")
                else:
                    print(f"  ⚠️  Error fetching audio features: {e}")
                    print(f"  ℹ️  Will continue without audio features")
                
                # Set audio_features to None for all tracks
                for track in tracks:
                    track['audio_features'] = None
        
        print(f"===============================\n")
        
        # Filter tracks based on user's audio feature preferences
        print(f"\n=== FILTERING TRACKS BY AUDIO FEATURES ===")
        user_avg = user_profile.get('audio_features_avg', {})
        
        # If Spotify API doesn't have audio features, try database profile
        if not user_avg or len(user_avg) == 0:
            db_audio_profile = user_profile.get('db_audio_profile')
            if db_audio_profile and db_audio_profile.get('track_count', 0) > 0:
                # Use database averages
                user_avg = {
                    'energy': db_audio_profile.get('energy'),
                    'danceability': db_audio_profile.get('danceability'),
                    'valence': db_audio_profile.get('valence')
                }
                print(f"✅ Using database audio profile for similarity scoring (from {db_audio_profile['track_count']} liked tracks)")
        
        # Check if user has audio features available (from Spotify or database)
        if not user_avg or len(user_avg) == 0:
            print(f"⚠️  User audio features not available - skipping audio feature filtering")
            print(f"   Will use all found tracks (no filtering by audio features)")
            # Just use all tracks without filtering
            tracks = tracks[:10] if len(tracks) > 10 else tracks
            for i, track in enumerate(tracks, 1):
                track['position'] = i
        else:
            # User has audio features - proceed with filtering
            user_energy = user_avg.get('energy', 0.5)
            user_danceability = user_avg.get('danceability', 0.5)
            user_valence = user_avg.get('valence', 0.5)
            
            print(f"User's average preferences:")
            print(f"  Energy: {user_energy:.2f}")
            print(f"  Danceability: {user_danceability:.2f}")
            print(f"  Valence: {user_valence:.2f}")
            
            # Check if tracks have audio features available
            tracks_with_features = [t for t in tracks if t.get('audio_features')]
            
            if tracks_with_features and len(tracks_with_features) > 0:
                # We have audio features for some or all tracks - use them for filtering
                print(f"✅ Found {len(tracks_with_features)} tracks with audio features")
                print(f"   Calculating match scores based on audio features...")
                
                # Calculate match score for each track
                tracks_with_scores = []
                for track in tracks:
                    if track.get('audio_features'):
                        features = track['audio_features']
                        track_energy = features.get('energy', 0.5) or 0.5
                        track_danceability = features.get('danceability', 0.5) or 0.5
                        track_valence = features.get('valence', 0.5) or 0.5
                        
                        # Calculate weighted match score (lower difference = better match)
                        energy_diff = abs(track_energy - user_energy)
                        danceability_diff = abs(track_danceability - user_danceability)
                        valence_diff = abs(track_valence - user_valence)
                        
                        # Match score: lower is better (0 = perfect match, 1 = worst match)
                        match_score = (
                            energy_diff * 0.4 +      # 40% weight on energy
                            danceability_diff * 0.4 +  # 40% weight on danceability
                            valence_diff * 0.2         # 20% weight on valence
                        )
                        
                        track['match_score'] = match_score
                        tracks_with_scores.append(track)
                        print(f"  {track['name']}: Energy={track_energy:.2f}, Danceability={track_danceability:.2f}, Valence={track_valence:.2f}, Match={match_score:.3f}")
                    else:
                        # Track without audio features gets a penalty score
                        track['match_score'] = 1.0
                        tracks_with_scores.append(track)
                        print(f"  {track['name']}: No audio features (match_score=1.0)")
                
                # Sort by match score (best matches first)
                tracks_with_scores.sort(key=lambda x: x.get('match_score', 1.0))
                
                # Keep all tracks for now - we'll score and keep top 8 based on lyrics
                tracks = tracks_with_scores
                print(f"\n✅ Audio feature filtering complete - {len(tracks)} tracks sorted by match score")
            else:
                # No audio features available - skip audio feature filtering
                print(f"⚠️  Tracks don't have audio features (Spotify API may not be available)")
                print(f"   Using all tracks without audio feature filtering")
                tracks = tracks[:10] if len(tracks) > 10 else tracks
                for i, track in enumerate(tracks, 1):
                    track['position'] = i
            
            print(f"===============================\n")
        
        # If we found fewer than 5 tracks, add a warning
        if len(tracks) < 5:
            print(f"WARNING: Only found {len(tracks)} tracks. Consider adding fallback logic.")
        
        # Fetch lyrics for all tracks (should be 6), then batch score
        print(f"\n=== FETCHING LYRICS & BATCH SCORING RELEVANCE ===")
        print(f"Processing {len(tracks)} tracks (expecting 6)")
        
        # First, fetch all lyrics
        tracks_with_lyrics = []
        non_english_tracks = []
        
        for i, track in enumerate(tracks, 1):
            print(f"\n[{i}/{len(tracks)}] Fetching lyrics: {track['name']} by {track['artist']}")
            
            try:
                lyrics_data = get_lyrics(track['name'], track['artist'])
                
                if lyrics_data:
                    print(f"  ✅ Lyrics found (original: {len(lyrics_data['original'])} chars, language: {lyrics_data['language']})")
                    # Store translated lyrics for AI analysis
                    track['lyrics'] = lyrics_data['translated']
                    # Store original lyrics for display
                    track['lyrics_original'] = lyrics_data['original']
                    # Store detected language
                    track['lyrics_language'] = lyrics_data['language']
                    
                    # Check if lyrics were actually translated
                    lyrics_changed = lyrics_data['original'] != lyrics_data['translated']
                    is_non_english = lyrics_data['language'] != 'en'
                    
                    # Debug: Show first 100 chars of each
                    print(f"  🔍 Original preview: {lyrics_data['original'][:100]}...")
                    print(f"  🔍 Translated preview: {lyrics_data['translated'][:100]}...")
                    print(f"  🔍 Are different: {lyrics_changed}, Is non-English: {is_non_english}")
                    
                    print(f"  🌐 Language: {lyrics_data['language']} | Non-English: {is_non_english} | Translated: {lyrics_changed}")
                    
                    if is_non_english or lyrics_changed:
                        non_english_tracks.append({
                            'name': track['name'],
                            'artist': track['artist'],
                            'language': lyrics_data['language'],
                            'was_translated': lyrics_changed
                        })
                        print(f"  ⭐ NON-ENGLISH TRACK DETECTED - Will show EN button")
                    else:
                        print(f"  ✓ English track - No translation needed")
                    
                    tracks_with_lyrics.append(track)
                else:
                    print(f"  ⚠️ No lyrics available, using default score")
                    track['lyrics'] = None
                    track['lyrics_original'] = None
                    track['lyrics_language'] = None
                    track['lyrics_score'] = 5  # Default score for no lyrics
            except Exception as e:
                print(f"  ❌ Error fetching lyrics: {e}")
                track['lyrics'] = None
                track['lyrics_original'] = None
                track['lyrics_language'] = None
                track['lyrics_score'] = 5  # Default score on error
        
        # Print summary of non-English tracks
        if non_english_tracks:
            print(f"\n{'='*60}")
            print(f"🌍 NON-ENGLISH TRACKS SUMMARY ({len(non_english_tracks)} found)")
            print(f"{'='*60}")
            for t in non_english_tracks:
                print(f"  🎵 {t['name']} by {t['artist']}")
                print(f"     Language: {t['language']} | Translated: {t['was_translated']}")
            print(f"{'='*60}\n")
        
        # Batch score all tracks with lyrics in a single API call
        if tracks_with_lyrics:
            print(f"\n📊 Batch scoring {len(tracks_with_lyrics)} tracks with lyrics...")
            batch_data = [
                {
                    'track_id': track['id'],
                    'lyrics': track['lyrics'],
                    'track_name': track['name'],
                    'artist_name': track['artist']
                }
                for track in tracks_with_lyrics
            ]
            
            scores_by_id = ai_service.batch_score_lyrics_relevance(batch_data, user_message)
            
            # Apply scores to tracks
            for track in tracks:
                if track['id'] in scores_by_id:
                    track['lyrics_score'] = scores_by_id[track['id']]
                    print(f"  📊 {track['name']}: lyrics score {track['lyrics_score']}/10")
        
        # Collect all tracks
        tracks_with_scores = tracks
        
        # Combine audio feature match score with lyrics score
        print(f"\n=== COMBINING AUDIO FEATURES & LYRICS SCORES ===")
        for track in tracks_with_scores:
            # Get existing match_score from audio features (0-1 scale, lower is better)
            audio_match_score = track.get('match_score', 0.5)
            # Convert to 0-10 scale (invert so higher is better)
            audio_score = (1 - audio_match_score) * 10
            
            # Get lyrics score (0-10)
            lyrics_score = track.get('lyrics_score', 0)
            
            # Weighted combination: 40% audio features, 60% lyrics (lyrics is more important for strict selection)
            combined_score = (audio_score * 0.4) + (lyrics_score * 0.6)
            track['combined_score'] = combined_score
            
            print(f"  {track['name']}: Audio={audio_score:.1f}, Lyrics={lyrics_score:.1f}, Combined={combined_score:.1f}")
        
        # Sort by combined score (highest first) and take top 6 (safety measure in case we got more than 6)
        tracks_with_scores.sort(key=lambda x: x.get('combined_score', 0), reverse=True)
        selected_tracks = tracks_with_scores[:6]
        
        print(f"\n✅ Selected top {len(selected_tracks)} tracks based on lyrics + audio features")
        for i, track in enumerate(selected_tracks, 1):
            print(f"  {i}. {track['name']} - Score: {track.get('combined_score', 0):.1f}")
        
        # Generate explanations only for the final 6 selected tracks
        print(f"\n=== GENERATING EXPLANATIONS FOR SELECTED TRACKS ===")
        print(f"Processing {len(selected_tracks)} tracks for explanations...")
        for i, track in enumerate(selected_tracks, 1):
            print(f"\n[{i}/{len(selected_tracks)}] Generating explanation for: {track['name']} by {track['artist']}")
            if track.get('lyrics'):
                try:
                    # Generate explanation from English lyrics
                    explanation, highlighted_terms = ai_service.explain_lyrics_relevance(
                        lyrics=track['lyrics'],
                        track_name=track['name'],
                        artist_name=track['artist'],
                        user_prompt=user_message
                    )
                    track['lyrics_explanation'] = explanation
                    track['highlighted_terms'] = highlighted_terms if highlighted_terms else []
                    
                    # Debug: Check lyrics data
                    has_original = bool(track.get('lyrics_original'))
                    has_translated = bool(track.get('lyrics'))
                    are_different = track.get('lyrics_original') != track.get('lyrics') if has_original and has_translated else False
                    print(f"  🔍 Lyrics check: has_original={has_original}, has_translated={has_translated}, are_different={are_different}")
                    if has_original and has_translated:
                        print(f"     Original length: {len(track['lyrics_original'])} chars, Translated length: {len(track['lyrics'])} chars")
                        print(f"     Language: {track.get('lyrics_language', 'unknown')}")
                    
                    # If original lyrics exist and are different, generate highlighted terms for them too
                    if track.get('lyrics_original') and track['lyrics_original'] != track['lyrics']:
                        print(f"  🌐 Generating highlighted terms for original language lyrics...")
                        try:
                            _, highlighted_terms_original = ai_service.explain_lyrics_relevance(
                                lyrics=track['lyrics_original'],
                                track_name=track['name'],
                                artist_name=track['artist'],
                                user_prompt=user_message
                            )
                            track['highlighted_terms_original'] = highlighted_terms_original if highlighted_terms_original else []
                            print(f"  ✅ Generated {len(highlighted_terms_original) if highlighted_terms_original else 0} highlighted terms for original lyrics")
                            if highlighted_terms_original:
                                print(f"     Original terms: {highlighted_terms_original[:5]}")
                        except Exception as e:
                            print(f"  ⚠️ Could not generate terms for original lyrics: {e}")
                            track['highlighted_terms_original'] = []
                    else:
                        track['highlighted_terms_original'] = []
                    
                    if explanation:
                        print(f"  ✅ Generated explanation ({len(explanation)} chars) with {len(highlighted_terms) if highlighted_terms else 0} highlighted terms")
                        if highlighted_terms:
                            print(f"     Highlighted terms: {highlighted_terms[:5]}")
                    else:
                        print(f"  ⚠️ Failed to generate explanation (returned None)")
                except Exception as e:
                    print(f"  ❌ Error generating explanation: {e}")
                    import traceback
                    traceback.print_exc()
                    track['lyrics_explanation'] = None
                    track['highlighted_terms'] = []
                    track['highlighted_terms_original'] = []
            else:
                print(f"  ⚠️ No lyrics available for explanation")
                track['lyrics_explanation'] = None
                track['highlighted_terms'] = []
                track['highlighted_terms_original'] = []
        
        print(f"\n✅ Finished generating explanations for {len(selected_tracks)} tracks")
        
        # Update positions for final tracks
        for i, track in enumerate(selected_tracks, 1):
            track['position'] = i
        
        tracks = selected_tracks
        print(f"================================================\n")
        
        # Update conversation history
        conversation_history.append({"role": "user", "content": user_message})
        conversation_history.append({"role": "assistant", "content": dj_intro})
        session['conversation_history'] = conversation_history[-6:]  # Keep last 6 messages (optimized for token usage)
        
        # Save messages to database
        user_message_db_id = None
        assistant_message_db_id = None
        
        if chat_db:
            try:
                # Get Clerk user ID from header
                clerk_id = get_clerk_user_id()
                session_id = get_session_id()
                
                # Save user message
                user_message_db_id = chat_db.save_message(
                    user_id=None,  # No longer using Spotify user_id
                    session_id=session_id,
                    role='user',
                    content=user_message,
                    tracks=None,
                    clerk_id=clerk_id  # Use Clerk ID
                )
                
                # Save assistant message with tracks
                assistant_message_db_id = chat_db.save_message(
                    user_id=None,  # No longer using Spotify user_id
                    session_id=session_id,
                    role='assistant',
                    content=dj_intro,
                    tracks=tracks,
                    clerk_id=clerk_id  # Use Clerk ID
                )
                
                print(f"✅ Saved messages to database (user: {user_message_db_id}, assistant: {assistant_message_db_id})")
            except Exception as e:
                print(f"⚠️  Failed to save messages to database: {e}")
        
        return jsonify({
            "dj_response": dj_intro,
            "tracks": tracks,
            "total_tracks": len(tracks),
            "user_message_db_id": user_message_db_id,
            "assistant_message_db_id": assistant_message_db_id
        })
    except Exception as e:
        print(f"Error in dj_recommend: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# === CHAT HISTORY & LIKES ENDPOINTS ===

@app.route('/message_feedback', methods=['POST'])
def message_feedback():
    """Save or update message feedback (like/dislike)"""
    if not chat_db:
        return jsonify({"error": "Database not configured"}), 500
    
    try:
        # Get Clerk user ID from header
        clerk_id = get_clerk_user_id()
        
        data = request.json
        message_id = data.get('message_id')
        feedback_type = data.get('feedback_type')  # 'like', 'dislike', or None to remove
        
        if not message_id:
            return jsonify({"error": "message_id is required"}), 400
        
        if feedback_type is None or feedback_type == '':
            # Remove feedback
            success = chat_db.remove_message_feedback(message_id, clerk_id)
        elif feedback_type in ['like', 'dislike']:
            # Save feedback
            success = chat_db.save_message_feedback(message_id, clerk_id, feedback_type)
        else:
            return jsonify({"error": "feedback_type must be 'like', 'dislike', or null"}), 400
        
        if success:
            return jsonify({"success": True})
        else:
            return jsonify({"error": "Failed to save feedback"}), 500
            
    except Exception as e:
        print(f"Error in message_feedback: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/track_like', methods=['POST'])
def track_like():
    """Toggle track like (add or remove) - fetches and stores audio features and highlighted_terms when liking"""
    if not chat_db:
        return jsonify({"error": "Database not configured"}), 500
    
    try:
        # Get Clerk user ID from header
        clerk_id = get_clerk_user_id()
        
        data = request.json
        track_id = data.get('track_id')
        track_name = data.get('track_name')
        track_artist = data.get('track_artist')
        track_image_url = data.get('track_image_url')
        highlighted_terms = data.get('highlighted_terms')  # List of highlighted terms from lyrics
        
        if not track_id or not track_name or not track_artist:
            return jsonify({"error": "track_id, track_name, and track_artist are required"}), 400
        
        # Check if we're liking (adding) or unliking (removing)
        # We need to check before toggling to know if we should fetch audio features
        is_currently_liked = chat_db.is_track_liked(clerk_id, track_id)
        
        # Audio features are no longer available from Spotify API (deprecated Nov 2024)
        # Set to None - audio features will be populated from database when available
        energy = None
        danceability = None
        valence = None
        
        if not is_currently_liked:
            print(f"ℹ️  Audio features not available from Spotify API (deprecated) - storing track without features")
            print(f"   Audio features will be available once user has liked tracks with features in database")
            if highlighted_terms:
                print(f"   Storing {len(highlighted_terms)} highlighted terms for track: {track_name}")
        
        # Toggle the like (with audio features and highlighted_terms if provided)
        is_liked = chat_db.toggle_track_like(
            user_id=clerk_id,  # Use Clerk ID
            track_id=track_id,
            track_name=track_name,
            track_artist=track_artist,
            track_image_url=track_image_url,
            energy=energy,
            danceability=danceability,
            valence=valence,
            highlighted_terms=highlighted_terms
        )
        
        if is_liked is not None:
            return jsonify({"success": True, "liked": is_liked})
        else:
            return jsonify({"error": "Failed to toggle track like"}), 500
            
    except Exception as e:
        print(f"Error in track_like: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/chat_history', methods=['GET'])
def get_chat_history():
    """Get chat history for the current user"""
    sp, redirect_response = get_authenticated_spotify()
    if redirect_response:
        return redirect_response
    
    if not chat_db:
        return jsonify({"error": "Database not configured"}), 500
    
    try:
        user = sp.current_user()
        user_id = user['id']
        
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))
        
        messages = chat_db.get_user_messages(user_id, limit=limit, offset=offset)
        
        return jsonify({
            "messages": messages,
            "total": len(messages)
        })
        
    except Exception as e:
        print(f"Error in get_chat_history: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/session_chat_history', methods=['GET'])
def get_session_chat_history():
    """Get chat history for the current session (DEPRECATED: use clerk_chat_history)"""
    print(f"\n=== SESSION CHAT HISTORY REQUEST (DEPRECATED) ===")
    
    sp, redirect_response = get_authenticated_spotify()
    if redirect_response:
        print(f"❌ Not authenticated")
        return redirect_response
    
    if not chat_db:
        print(f"❌ Database not configured")
        return jsonify({"error": "Database not configured"}), 500
    
    try:
        session_id = get_session_id()
        limit = int(request.args.get('limit', 50))
        
        print(f"Session ID: {session_id}")
        print(f"Limit: {limit}")
        
        messages = chat_db.get_session_messages(session_id, limit=limit)
        
        print(f"Found {len(messages)} messages for session")
        if messages:
            print(f"First message: {messages[0].get('content', '')[:50]}...")
        
        return jsonify({
            "messages": messages,
            "total": len(messages)
        })
        
    except Exception as e:
        print(f"❌ Error in get_session_chat_history: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/clerk_chat_history', methods=['GET'])
def get_clerk_chat_history():
    """Get chat history for the current Clerk user"""
    print(f"\n=== CLERK CHAT HISTORY REQUEST ===")
    
    if not chat_db:
        print(f"❌ Database not configured")
        return jsonify({"error": "Database not configured"}), 500
    
    try:
        # Get Clerk user ID from header
        clerk_id = get_clerk_user_id()
        limit = int(request.args.get('limit', 50))
        
        print(f"Clerk ID: {clerk_id}")
        print(f"Limit: {limit}")
        
        # Get messages by clerk_id using the existing user messages method
        messages = chat_db.get_user_messages(clerk_id, limit=limit)
        
        print(f"Found {len(messages)} messages for clerk user")
        if messages:
            print(f"First message: {messages[0].get('content', '')[:50]}...")
        
        return jsonify({
            "messages": messages,
            "total": len(messages)
        })
        
    except ValueError as e:
        print(f"❌ Error: {e}")
        return jsonify({"error": str(e)}), 401
    except Exception as e:
        print(f"❌ Error in get_clerk_chat_history: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/liked_tracks', methods=['GET'])
def get_liked_tracks():
    """Get all tracks liked by the current user"""
    if not chat_db:
        return jsonify({"error": "Database not configured"}), 500
    
    try:
        # Get Clerk user ID from header
        clerk_id = get_clerk_user_id()
        
        limit = int(request.args.get('limit', 100))
        offset = int(request.args.get('offset', 0))
        
        tracks = chat_db.get_user_liked_tracks(clerk_id, limit=limit, offset=offset)
        
        return jsonify({
            "tracks": tracks,
            "total": len(tracks)
        })
        
    except Exception as e:
        print(f"Error in get_liked_tracks: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/liked_track_ids', methods=['GET'])
def get_liked_track_ids():
    """Get all track IDs liked by the current user (for quick lookups)"""
    if not chat_db:
        return jsonify({"error": "Database not configured"}), 500
    
    try:
        # Get Clerk user ID from header
        clerk_id = get_clerk_user_id()
        
        track_ids = chat_db.get_user_liked_track_ids(clerk_id)
        
        return jsonify({
            "track_ids": list(track_ids),
            "total": len(track_ids)
        })
        
    except Exception as e:
        print(f"Error in get_liked_track_ids: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/frequently_liked_terms', methods=['GET'])
def get_frequently_liked_terms():
    """Get highlighted terms that appear frequently in liked tracks"""
    if not chat_db:
        return jsonify({"error": "Database not configured"}), 500
    
    try:
        # Get Clerk user ID from header
        clerk_id = get_clerk_user_id()
        
        # Get min_occurrences from query params (default: 2)
        min_occurrences = int(request.args.get('min_occurrences', 2))
        
        frequently_liked_terms = chat_db.get_frequently_liked_terms(clerk_id, min_occurrences=min_occurrences)
        
        # Convert set to list for JSON serialization
        return jsonify({
            "terms": list(frequently_liked_terms),
            "count": len(frequently_liked_terms)
        })
        
    except Exception as e:
        print(f"Error in get_frequently_liked_terms: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5001)