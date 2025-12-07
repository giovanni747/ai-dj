import os
import sys
from pathlib import Path
import json
import requests
from typing import Optional
import concurrent.futures
import time

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

# Translation cache to avoid redundant API calls
_translation_cache = {}

def quick_language_detect(lyrics: str) -> Optional[str]:
    """
    Fast language detection using simple heuristics before LLM call.
    Returns language code if confident, None if needs LLM detection.
    
    More strict criteria to avoid false positives on English songs with few foreign words.
    """
    if not lyrics or len(lyrics) < 100:  # Increased minimum length
        return None
    
    # Get first 300 words for analysis (increased from 200)
    words = lyrics.lower().split()[:300]
    sample = ' '.join(words)
    total_words = len(words)
    
    # Common indicators for different languages
    spanish_indicators = ['que', 'con', 'por', 'para', 'esta', 'está', 'son', 'del', 'una', 'las', 'los', 'el', 'la', 'mi', 'tu', 'sus', 'como', 'pero', 'cuando', 'donde']
    french_indicators = ['que', 'de', 'la', 'le', 'et', 'les', 'des', 'un', 'une', 'est', 'dans', 'pour', 'pas', 'ce', 'qui', 'il', 'elle', 'nous', 'vous', 'sont']
    portuguese_indicators = ['que', 'de', 'para', 'com', 'uma', 'os', 'das', 'pelo', 'pela', 'não', 'mais', 'meu', 'teu', 'seu', 'está', 'são', 'foi', 'porque', 'quando', 'onde']
    
    # Count matches (case-insensitive, whole words)
    spanish_count = sum(1 for word in spanish_indicators if f' {word} ' in f' {sample} ')
    french_count = sum(1 for word in french_indicators if f' {word} ' in f' {sample} ')
    portuguese_count = sum(1 for word in portuguese_indicators if f' {word} ' in f' {sample} ')
    
    # Calculate percentage of foreign words (more strict)
    spanish_percentage = (spanish_count / total_words * 100) if total_words > 0 else 0
    french_percentage = (french_count / total_words * 100) if total_words > 0 else 0
    portuguese_percentage = (portuguese_count / total_words * 100) if total_words > 0 else 0
    
    # Only mark as non-English if:
    # 1. High absolute count (>10 matches) AND
    # 2. High percentage (>15% of words are foreign indicators)
    if spanish_count > 10 and spanish_percentage > 15 and spanish_count > french_count and spanish_count > portuguese_count:
        return "es"
    elif portuguese_count > 10 and portuguese_percentage > 15 and portuguese_count > spanish_count:
        return "pt"
    elif french_count > 10 and french_percentage > 15 and french_count > spanish_count:
        return "fr"
    
    return None  # Need LLM detection (or likely English)

def batch_detect_and_translate(lyrics_list: list) -> list:
    """
    Batch detect languages and translate non-English lyrics in ONE API call.
    This replaces sequential detect->translate calls for massive speedup.
    
    Args:
        lyrics_list: List of lyrics strings to process
    
    Returns:
        List of tuples: [(translated_lyrics, detected_language), ...]
    """
    if not lyrics_list:
        return []
    
    from groq import Groq
    groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    
    # Quick pre-check with heuristics
    pre_detected = [quick_language_detect(lyrics) for lyrics in lyrics_list]
    
    # Build batch prompt for combined detection + translation
    # Truncate to 1200 chars for faster, more reliable translation
    # (captures chorus + key verses while keeping batch size manageable)
    prompt_parts = []
    truncated_lyrics = []
    
    for i, (lyrics, pre_lang) in enumerate(zip(lyrics_list, pre_detected)):
        # Truncate to 1200 chars at word boundary (keeps key content, faster processing)
        if len(lyrics) > 1200:
            # Find the last space before 1200 chars to avoid cutting mid-word
            truncate_point = lyrics.rfind(' ', 0, 1200)
            # If no space found (unlikely), just truncate at 1200
            lyrics_truncated = lyrics[:truncate_point] if truncate_point > 0 else lyrics[:1200]
        else:
            lyrics_truncated = lyrics
        
        truncated_lyrics.append(lyrics_truncated)
        
        if pre_lang:
            # Pre-detected language
            prompt_parts.append(f'\n=== Text {i+1} ===\nLanguage: {pre_lang}\n{lyrics_truncated}')
        else:
            # Need LLM to detect
            prompt_parts.append(f'\n=== Text {i+1} ===\n{lyrics_truncated}')
    
    # Combined detection and translation prompt
    prompt = f"""For each text below, detect the language and translate to English if non-English.

CRITICAL RULES:
1. Preserve ALL line breaks, spacing, and formatting EXACTLY
2. If language is English (en), return the EXACT same text
3. If non-English, translate COMPLETELY while preserving structure
4. Do NOT skip lines or return partial translations

Return JSON format:
{{"results": [
  {{"index": 1, "language": "es", "translated": "English translation with preserved line breaks"}},
  {{"index": 2, "language": "en", "translated": "exact same English text"}},
  ...
]}}

Language codes: es (Spanish), en (English), fr (French), pt (Portuguese), it (Italian), de (German)

Texts to process:
{chr(10).join(prompt_parts)}

Return ONLY the JSON object."""
    
    try:
        # Calculate dynamic max_tokens based on TRUNCATED input length
        total_chars = sum(len(l) for l in truncated_lyrics)
        estimated_tokens = int(total_chars * 2.5)  # Translation can be longer, increased multiplier
        max_tokens = max(4000, min(estimated_tokens, 8000))  # Increased range: 4k-8k tokens to prevent truncation
        
        response = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",  # Fast model
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,  # Lower for more consistent formatting
            max_tokens=max_tokens,
            response_format={"type": "json_object"}
        )
        
        response_text = response.choices[0].message.content
        
        # Try to parse JSON, with fallback for partial/incomplete JSON
        try:
            result_json = json.loads(response_text)
        except json.JSONDecodeError as json_err:
            # Try to extract partial JSON if response was truncated
            print(f"    ⚠️  JSON parse error, attempting to extract partial results: {json_err}")
            # Try to find and parse just the results array
            import re
            results_match = re.search(r'"results"\s*:\s*\[(.*?)\]', response_text, re.DOTALL)
            if results_match:
                try:
                    # Try to reconstruct valid JSON from partial response
                    partial_json = '{"results": [' + results_match.group(1) + ']}'
                    result_json = json.loads(partial_json)
                    print(f"    ✅ Successfully parsed partial JSON")
                except:
                    # If that fails, try to extract individual result objects
                    result_objects = re.findall(r'\{"index":\s*(\d+),\s*"language":\s*"([^"]+)",\s*"translated":\s*"(.*?)"\}', response_text, re.DOTALL)
                    if result_objects:
                        results = []
                        for idx, lang, trans in result_objects:
                            # Clean up translation text (remove escape sequences)
                            trans_clean = trans.replace('\\n', '\n').replace('\\"', '"').replace('\\\'', "'")
                            results.append({"index": int(idx), "language": lang, "translated": trans_clean})
                        result_json = {"results": results}
                        print(f"    ✅ Extracted {len(results)} partial results from incomplete JSON")
                    else:
                        raise json_err
            else:
                raise json_err
        
        results = result_json.get("results", [])
            
        # Map results back to original list
        output = []
        for i, (full_lyrics, truncated) in enumerate(zip(lyrics_list, truncated_lyrics)):
            # Find result for this index
            result = next((r for r in results if r.get("index") == i+1), None)
            
            if result:
                lang = result.get("language", "en").lower().strip()
                translated_preview = result.get("translated", "").strip()
                
                # Validate translation
                if not translated_preview:  # Empty translation
                    print(f"    ⚠️  Translation {i+1} empty, using original")
                    output.append((full_lyrics, lang if lang else "en"))
                elif lang == "en":
                    # English - use original full lyrics to preserve exact formatting
                    output.append((full_lyrics, "en"))
                elif len(translated_preview) < 100:  # Translation too short (likely failed)
                    print(f"    ⚠️  Translation {i+1} too short ({len(translated_preview)} chars), using original")
                    output.append((full_lyrics, lang))
                else:
                    # Non-English with valid translation
                    # Use the translated preview (it has the key content: chorus + verses)
                    output.append((translated_preview, lang))
            else:
                # Fallback - no result found, use pre-detected language if available
                pre_lang = pre_detected[i] if i < len(pre_detected) else None
                if pre_lang:
                    print(f"    ⚠️  No result for lyrics {i+1}, using pre-detected language: {pre_lang}")
                    output.append((full_lyrics, pre_lang))
                else:
                    print(f"    ⚠️  No result for lyrics {i+1}, assuming English")
                    output.append((full_lyrics, "en"))
        
        return output
        
    except Exception as e:
        print(f"    ⚠️  Batch translation error: {e}")
        # Use pre-detected languages as fallback instead of marking everything as English
        output = []
        for i, (lyrics, pre_lang) in enumerate(zip(lyrics_list, pre_detected)):
            if pre_lang:
                # Use pre-detected language (keep original lyrics since translation failed)
                output.append((lyrics, pre_lang))
                print(f"    ⚠️  Lyrics {i+1}: Using pre-detected language '{pre_lang}' (translation API failed)")
            else:
                # Assume English if no pre-detection
                output.append((lyrics, "en"))
        return output

def translate_lyrics(lyrics: str) -> tuple[str, Optional[str]]:
    """
    DEPRECATED: Single lyrics translation (kept for compatibility).
    Use batch_detect_and_translate() for better performance.
    """
    if not lyrics:
        return lyrics, None
    
    # Check cache first
    import hashlib
    lyrics_hash = hashlib.md5(lyrics[:500].encode()).hexdigest()
    if lyrics_hash in _translation_cache:
        cached = _translation_cache[lyrics_hash]
        print(f"    💾 Using cached translation")
        return cached
    
    # Use batch function for single item
    result = batch_detect_and_translate([lyrics])
    if result:
        translated, lang = result[0]
        _translation_cache[lyrics_hash] = (translated, lang)
        return translated, lang
    
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
                    similarity_threshold=0.85  # Less strict - allow duplicates but not too frequently
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
        
        # ⏱️ TIMING: Main AI recommendation generation
        start_time = time.time()
        ai_response_raw = ai_service.get_recommendations(
            user_message,
            user_profile,
            conversation_history,
            weather_data=weather_data
        )
        ai_recommendation_time = time.time() - start_time
        print(f"⏱️  [TIMING] AI Recommendations: {ai_recommendation_time:.2f}s")
        
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
        for i, song in enumerate(llm_songs[:6], 1):  # Show first 6 (we requested 6)
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
        # ⏱️ TIMING: Spotify search
        spotify_search_start = time.time()
        tracks = []
        found_count = 0
        
        print(f"\n=== SPOTIFY SEARCH (keeping duplicates, will select best 5) ===")
        if previously_recommended_track_ids:
            print(f"ℹ️  Found {len(previously_recommended_track_ids)} tracks from similar prompts - duplicates allowed (will select best 5)")
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
                    
                    # Keep duplicates - we'll remove the worst one later if we have more than 5
                    # Previously skipped, now we keep all tracks to ensure we get 5
                    
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
                        
                        # Keep duplicates - we'll remove the worst one later if we have more than 5
                        
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
        if found_count < len(llm_songs):
            print(f"⚠️  Could not find {len(llm_songs) - found_count} song(s) on Spotify")
        print(f"==============================\n")
        
        spotify_search_time = time.time() - spotify_search_start
        print(f"⏱️  [TIMING] Spotify Search: {spotify_search_time:.2f}s")
        
        # Try to fetch audio features for recommended tracks
        # Note: Audio features API may not be available for new apps (deprecated Nov 2024)
        # Skip audio features fetch if API is restricted (403) - not critical for recommendations
        print(f"\n=== FETCHING AUDIO FEATURES FOR RECOMMENDED TRACKS ===")
        if tracks:
            track_ids = [track['id'] for track in tracks]
            try:
                # Try to fetch audio features in batches (Spotify limit is 100 per request)
                print(f"  Attempting to fetch audio features for {len(track_ids)} tracks...")
                audio_features = sp.audio_features(track_ids)
                
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
                    
                    if features_count > 0:
                        print(f"  ✅ Successfully fetched audio features for {features_count}/{len(tracks)} tracks")
                    else:
                        print(f"  ℹ️  No audio features returned (API may be restricted)")
                        for track in tracks:
                            track['audio_features'] = None
                else:
                    print(f"  ℹ️  Audio features API returned empty response - continuing without audio features")
                    for track in tracks:
                        track['audio_features'] = None
                        
            except Exception as e:
                # Silently skip audio features if API is restricted or unavailable
                error_msg = str(e)
                if '403' in error_msg or 'Forbidden' in error_msg or 'HTTP Error' in error_msg:
                    print(f"  ℹ️  Audio features API is restricted (403) - skipping this step")
                    print(f"  ℹ️  Will use database audio profile for similarity scoring if available")
                else:
                    print(f"  ℹ️  Audio features unavailable - continuing without them")
                
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
        # Check if we have enough tracks (we requested 6, need at least 5)
        if len(tracks) < 5:
            print(f"⚠️  Only found {len(tracks)} tracks out of {len(llm_songs)} requested. May not reach minimum of 5 tracks.")
        
        # ⏱️ TIMING: Lyrics fetching (now using BATCH translation)
        lyrics_fetch_start = time.time()
        # Fetch lyrics for all tracks with BATCH translation (should be up to 6, will select top 5 later)
        print(f"\n=== FETCHING LYRICS & BATCH TRANSLATION + SCORING ===")
        print(f"Processing {len(tracks)} tracks (will select best 5)")
        
        # Step 1: Fetch all lyrics from Genius in parallel (no translation yet)
        def fetch_genius_lyrics(track_data):
            """Fetch raw lyrics from Genius (no translation)"""
            i, track = track_data
            try:
                print(f"\n[{i}/{len(tracks)}] Fetching lyrics: {track['name']} by {track['artist']}")
                
                if not genius:
                    return (track, None, False)
                
                primary_artist = track['artist'].split(',')[0].strip() if ',' in track['artist'] else track['artist'].strip()
                print(f"    🔍 Searching Genius for: '{track['name']}' by {primary_artist}")
                
                song = genius.search_song(track['name'], primary_artist)
                
                if song and song.lyrics:
                    # Clean up lyrics
                    lyrics = song.lyrics
                    if lyrics.startswith("Lyrics"):
                        lyrics = lyrics.split("\n", 1)[1] if "\n" in lyrics else lyrics
                    lyrics = lyrics.strip()
                    
                    print(f"    ✅ Found lyrics ({len(lyrics)} chars)")
                    return (track, lyrics, True)
                else:
                    print(f"    ⚠️  No lyrics found")
                    return (track, None, False)
                    
            except Exception as e:
                print(f"    ❌ Error fetching lyrics: {e}")
                return (track, None, False)
        
        # Fetch all lyrics in parallel
        tracks_with_raw_lyrics = []
        lyrics_to_translate = []
        lyrics_indices = []
        non_english_tracks = []
        
        track_indices = [(i+1, track) for i, track in enumerate(tracks)]
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            results = executor.map(fetch_genius_lyrics, track_indices)
            
            for track, lyrics, found in results:
                if found and lyrics:
                    tracks_with_raw_lyrics.append(track)
                    lyrics_to_translate.append(lyrics)
                    lyrics_indices.append(len(tracks_with_raw_lyrics) - 1)
                else:
                    # No lyrics available
                    track['lyrics'] = None
                    track['lyrics_original'] = None
                    track['lyrics_language'] = None
                    track['lyrics_score'] = 3  # Default score (1-5 scale)
                    tracks_with_raw_lyrics.append(track)
        
        print(f"\n✅ Fetched {len(lyrics_to_translate)} lyrics from Genius")
        
        # Step 2: BATCH translate all lyrics in ONE API call
        if lyrics_to_translate:
            print(f"\n🌐 Batch translating {len(lyrics_to_translate)} lyrics...")
            
            # Use batch translation function
            translation_results = batch_detect_and_translate(lyrics_to_translate)
            
            # Apply results back to tracks
            for idx, (translated_lyrics, detected_lang) in zip(lyrics_indices, translation_results):
                track = tracks_with_raw_lyrics[idx]
                original_lyrics = lyrics_to_translate[lyrics_indices.index(idx)]
                
                # ALWAYS store the original fetched lyrics
                track['lyrics_original'] = original_lyrics
                track['lyrics_language'] = detected_lang
                
                # For English lyrics, both will be the same (so toggle button won't show)
                # For non-English, translated will be different (toggle button will show)
                if detected_lang == 'en':
                    # English song - no translation needed
                    # Set lyrics to original, and lyrics_original to None to prevent toggle
                    track['lyrics'] = original_lyrics
                    track['lyrics_original'] = None  # No original needed for English
                    print(f"    ✅ [{track['name']}]: English (no translation needed)")
                else:
                    # Non-English song - use translated version for lyrics field
                    track['lyrics'] = translated_lyrics
                    was_translated = translated_lyrics != original_lyrics
                    non_english_tracks.append({
                        'name': track['name'],
                        'artist': track['artist'],
                        'language': detected_lang,
                        'was_translated': was_translated
                    })
                    print(f"    ✅ [{track['name']}]: {detected_lang} → en {'(translated)' if was_translated else '(kept original)'}")
        
        tracks_with_lyrics = tracks_with_raw_lyrics
        
        lyrics_fetch_time = time.time() - lyrics_fetch_start
        print(f"⏱️  [TIMING] Lyrics Fetching (Parallel): {lyrics_fetch_time:.2f}s")
        
        # Print summary of non-English tracks
        if non_english_tracks:
            print(f"\n{'='*60}")
            print(f"🌍 NON-ENGLISH TRACKS SUMMARY ({len(non_english_tracks)} found)")
            print(f"{'='*60}")
            for t in non_english_tracks:
                print(f"  🎵 {t['name']} by {t['artist']}")
                print(f"     Language: {t['language']} | Translated: {t['was_translated']}")
            print(f"{'='*60}\n")
        
        # ⏱️ TIMING: Batch lyrics scoring
        batch_score_start = time.time()
        batch_score_time = 0
        # Batch score all tracks with lyrics in a single API call
        # Filter to only tracks that actually have lyrics (not None)
        tracks_with_valid_lyrics = [track for track in tracks_with_lyrics if track.get('lyrics')]
        
        if tracks_with_valid_lyrics:
            print(f"\n📊 Batch scoring {len(tracks_with_valid_lyrics)} tracks with lyrics...")
            batch_data = [
                {
                    'track_id': track['id'],
                    'lyrics': track['lyrics'],
                    'track_name': track['name'],
                    'artist_name': track['artist']
                }
                for track in tracks_with_valid_lyrics
            ]
            
            scores_by_id = ai_service.batch_score_lyrics_relevance(batch_data, user_message)
            batch_score_time = time.time() - batch_score_start
            print(f"⏱️  [TIMING] Batch Lyrics Scoring: {batch_score_time:.2f}s")
            
            # Apply scores to tracks
            for track in tracks:
                if track['id'] in scores_by_id:
                    score = scores_by_id[track['id']]
                    # Ensure score is between 1 and 5
                    score = max(1, min(5, int(score)))
                    track['lyrics_score'] = score
                    print(f"  📊 {track['name']}: lyrics score {track['lyrics_score']}/5")
        
        # Collect all tracks
        tracks_with_scores = tracks
        
        # Combine audio feature match score with lyrics score
        print(f"\n=== COMBINING AUDIO FEATURES & LYRICS SCORES ===")
        for track in tracks_with_scores:
            # Get existing match_score from audio features (0-1 scale, lower is better)
            audio_match_score = track.get('match_score', 0.5)
            # Convert to 0-10 scale (invert so higher is better)
            audio_score = (1 - audio_match_score) * 10
            
            # Get lyrics score (1-5 scale) - ensure it's clamped
            lyrics_score_raw = track.get('lyrics_score', 3)  # Default to 3 (midpoint)
            lyrics_score_raw = max(1, min(5, int(lyrics_score_raw)))  # Clamp to 1-5
            track['lyrics_score'] = lyrics_score_raw  # Update with clamped value
            # Normalize lyrics score to 0-10 scale for combination with audio score
            lyrics_score = ((lyrics_score_raw - 1) / 4) * 10  # Convert 1-5 to 0-10
            
            # Weighted combination: 40% audio features, 60% lyrics (lyrics is more important for strict selection)
            combined_score = (audio_score * 0.4) + (lyrics_score * 0.6)
            track['combined_score'] = combined_score
            
            print(f"  {track['name']}: Audio={audio_score:.1f}, Lyrics={lyrics_score_raw}/5 (normalized: {lyrics_score:.1f}), Combined={combined_score:.1f}")
        
        # Sort by combined score (highest first) - best scores first
        tracks_with_scores.sort(key=lambda x: x.get('combined_score', 0), reverse=True)
        
        # Always select exactly 5 tracks (remove worst ones if we have more than 5)
        # If we have duplicates, they'll be included, but worst one gets removed
        selected_tracks = tracks_with_scores[:5]
        
        # Ensure we have exactly 5 tracks
        if len(selected_tracks) < 5 and len(tracks_with_scores) > len(selected_tracks):
            # If we don't have enough, try to take more (shouldn't happen with 6 requested)
            print(f"⚠️  Only found {len(selected_tracks)} tracks, needed 5. Taking all available.")
            selected_tracks = tracks_with_scores[:min(5, len(tracks_with_scores))]
        
        # Log which tracks were selected and which were removed
        if len(tracks_with_scores) > 5:
            removed_count = len(tracks_with_scores) - 5
            print(f"\n✅ Selected top 5 tracks (removed {removed_count} lowest scoring track(s))")
            if removed_count > 0:
                print(f"   Removed tracks: {', '.join([t['name'] for t in tracks_with_scores[5:]])}")
        else:
            print(f"\n✅ Selected {len(selected_tracks)} tracks (all available)")
        
        for i, track in enumerate(selected_tracks, 1):
            print(f"  {i}. {track['name']} - Score: {track.get('combined_score', 0):.1f}")
        
        # ⏱️ TIMING: Explanations generation (parallel)
        explanations_start = time.time()
        # ⏱️ TIMING: Explanations generation (parallel)
        explanations_start = time.time()
        # Generate explanations only for the final 5 selected tracks (PARALLEL)
        print(f"\n=== GENERATING EXPLANATIONS FOR SELECTED TRACKS (PARALLEL) ===")
        print(f"Processing {len(selected_tracks)} tracks for explanations in parallel...")
        
        def generate_track_explanation(track_data):
            """Helper function to generate explanation for a single track in parallel"""
            track, user_message, ai_service = track_data
            track_id = track['id']
            track_name = track['name']
            
            result = {
                'track_id': track_id,
                'explanation': None,
                'highlighted_terms': [],
                'highlighted_terms_original': [],
                'error': None
            }
            
            if not track.get('lyrics'):
                print(f"  ⚠️ {track_name}: No lyrics available")
                return result
            
            try:
                # Generate explanation from English lyrics
                explanation, highlighted_terms = ai_service.explain_lyrics_relevance(
                    lyrics=track['lyrics'],
                    track_name=track_name,
                    artist_name=track['artist'],
                    user_prompt=user_message
                )
                result['explanation'] = explanation
                result['highlighted_terms'] = highlighted_terms if highlighted_terms else []
                
                # If original lyrics exist and are different, generate highlighted terms for them too
                if track.get('lyrics_original') and track['lyrics_original'] != track['lyrics']:
                    try:
                        _, highlighted_terms_original = ai_service.explain_lyrics_relevance(
                            lyrics=track['lyrics_original'],
                            track_name=track_name,
                            artist_name=track['artist'],
                            user_prompt=user_message
                        )
                        result['highlighted_terms_original'] = highlighted_terms_original if highlighted_terms_original else []
                    except Exception as e:
                        print(f"  ⚠️ {track_name}: Could not generate terms for original lyrics: {e}")
                        result['highlighted_terms_original'] = []
                
                if explanation:
                    print(f"  ✅ {track_name}: Generated explanation ({len(explanation)} chars) with {len(result['highlighted_terms'])} terms")
                else:
                    print(f"  ⚠️ {track_name}: Explanation returned None")
                
            except Exception as e:
                print(f"  ❌ {track_name}: Error generating explanation: {e}")
                result['error'] = str(e)
            
            return result
        
        # Execute all explanations in parallel using ThreadPoolExecutor
        track_data_list = [(track, user_message, ai_service) for track in selected_tracks]
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            # Submit all tasks and get results
            results = list(executor.map(generate_track_explanation, track_data_list))
        
        explanations_time = time.time() - explanations_start
        print(f"⏱️  [TIMING] Explanations Generation (Parallel): {explanations_time:.2f}s")
        
        # Apply results back to tracks
        for result in results:
            track = next((t for t in selected_tracks if t['id'] == result['track_id']), None)
            if track:
                track['lyrics_explanation'] = result['explanation']
                track['highlighted_terms'] = result['highlighted_terms']
                track['highlighted_terms_original'] = result['highlighted_terms_original']
        
        print(f"\n✅ Finished generating explanations for {len(selected_tracks)} tracks in parallel")
        
        # ⏱️ Print total timing summary (with flush to ensure it appears in logs)
        total_time = time.time() - start_time
        print(f"\n{'='*60}")
        print(f"⏱️  [TIMING SUMMARY]")
        print(f"{'='*60}")
        print(f"  AI Recommendations:      {ai_recommendation_time:.2f}s ({ai_recommendation_time/total_time*100:.1f}%)")
        print(f"  Spotify Search:          {spotify_search_time:.2f}s ({spotify_search_time/total_time*100:.1f}%)")
        print(f"  Lyrics Fetching:         {lyrics_fetch_time:.2f}s ({lyrics_fetch_time/total_time*100:.1f}%)")
        print(f"  Batch Lyrics Scoring:    {batch_score_time:.2f}s ({batch_score_time/total_time*100:.1f}%)")
        print(f"  Explanations:            {explanations_time:.2f}s ({explanations_time/total_time*100:.1f}%)")
        print(f"  ───────────────────────────────────────────")
        print(f"  TOTAL:                   {total_time:.2f}s")
        print(f"{'='*60}\n")
        
        # Force flush to ensure timing summary appears in logs before response
        sys.stdout.flush()
        
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