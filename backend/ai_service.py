import os
from groq import Groq
from dotenv import load_dotenv
from pathlib import Path
from rate_limiter import groq_rate_limiter

env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

# Debug mode - set to False in production to reduce logging
DEBUG_MODE = os.getenv("AI_SERVICE_DEBUG", "false").lower() == "true"

class GroqRecommendationService:
    def __init__(self):
        self.client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        # Use the specified model (llama-3.3-70b-versatile recommended for complex JSON tasks)
        self.model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        
    def analyze_profile(self, user_data):
        """Analyze user's music profile"""
        prompt = f"""
        Analyze this user's music taste based on their Spotify data:
        
        Genres: {', '.join(user_data.get('genres', [])[:10])}
        Top Artists: {', '.join([a['name'] for a in user_data.get('top_artists', [])[:5]])}
        Audio Features:
        - Energy: {user_data.get('audio_features_avg', {}).get('energy', 0):.2f}
        - Danceability: {user_data.get('audio_features_avg', {}).get('danceability', 0):.2f}
        - Valence: {user_data.get('audio_features_avg', {}).get('valence', 0):.2f}
        
        Provide a brief analysis of their music taste in 2-3 sentences.
        """
        
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=200
        )
        
        return response.choices[0].message.content
    
    def get_recommendations(self, user_message, user_profile, conversation_history=None, weather_data=None):
        """Get AI DJ recommendations: returns both intro text and song list"""
        
        print(f"🌤️ [WEATHER DEBUG AI] get_recommendations called with weather_data: {weather_data is not None}", flush=True)
        if weather_data:
            print(f"🌤️ [WEATHER DEBUG AI] Weather data received: {weather_data}", flush=True)
        import sys
        sys.stdout.flush()
        
        # Build conversation history
        messages = []
        
        # System prompt - AI DJ that recommends songs
        weather_instruction = ""
        if weather_data:
            print(f"🌤️ [WEATHER DEBUG AI] Adding weather instructions to system prompt", flush=True)
            import sys
            sys.stdout.flush()
            weather_instruction = """
5. Consider the current weather conditions when recommending songs:
   - Match the mood and energy of the music to the weather
   - Rainy/cloudy weather → cozy, introspective, or calming songs
   - Sunny/clear weather → upbeat, energetic, or happy songs
   - Cold weather → warm, comforting, or nostalgic songs
   - Hot weather → refreshing, tropical, or breezy songs
   - Stormy weather → dramatic, intense, or powerful songs
   - Snow → peaceful, ambient, or winter-themed songs
   The weather should influence the song selection to create a perfect atmosphere."""
        
        system_prompt = f"""You are an AI DJ specializing in music recommendations. Your job is to:
1. Analyze the user's music taste from their Spotify data (genres, artists, audio features)
2. Match their taste with their specific request
3. Recommend exactly 5 songs that exist on Spotify (we'll verify these are the best matches)
4. Provide a brief DJ-style introduction (2-3 sentences){weather_instruction}

Return your response as a JSON object with this exact structure:
{{
  "intro": "Your DJ-style introduction here (3-5 sentences, make it longer and more engaging)",
  "songs": [
    {{"title": "Song Title", "artist": "Artist Name"}},
    {{"title": "Song Title", "artist": "Artist Name"}},
    ... (exactly 5 songs)
  ]
}}

IMPORTANT:
- Only recommend songs that actually exist on Spotify (popular, well-known songs)
- Match the user's request AND their music taste
- Ensure songs are relevant to what they asked for
- Provide variety in your recommendations
- The intro should be 3-5 sentences long and engaging
- Escape all quotes in the intro text using backslashes (e.g., use \\" for quotes inside strings)
- Return ONLY valid JSON, no other text, no markdown code blocks"""
        
        if conversation_history and len(conversation_history) > 0:
            messages = [{"role": "system", "content": system_prompt}] + conversation_history
        else:
            messages.append({"role": "system", "content": system_prompt})
        
        # Build detailed user profile context
        top_artists_names = [a['name'] for a in user_profile.get('top_artists', [])[:10]]
        top_tracks_names = [t['name'] for t in user_profile.get('top_tracks', [])[:10]]
        
        # Get audio features - try Spotify API first, then fallback to database
        audio_features_avg = user_profile.get('audio_features_avg', {})
        has_audio_features = audio_features_avg and len(audio_features_avg) > 0
        
        # If Spotify API doesn't have audio features, try database profile
        if not has_audio_features:
            db_audio_profile = user_profile.get('db_audio_profile')
            if db_audio_profile and db_audio_profile.get('track_count', 0) > 0:
                # Use database averages
                audio_features_avg = {
                    'energy': db_audio_profile.get('energy'),
                    'danceability': db_audio_profile.get('danceability'),
                    'valence': db_audio_profile.get('valence')
                }
                has_audio_features = True
                print(f"✅ Using database audio profile (from {db_audio_profile['track_count']} liked tracks)")
        
        if has_audio_features:
            energy_str = f"{audio_features_avg.get('energy', 0):.2f} (0=calm, 1=energetic)"
            danceability_str = f"{audio_features_avg.get('danceability', 0):.2f} (0=not danceable, 1=danceable)"
            valence_str = f"{audio_features_avg.get('valence', 0):.2f} (0=sad, 1=happy)"
        else:
            # Default values when no audio features available (from Spotify or database)
            # Use neutral defaults: 0.5 for all features
            energy_str = "0.50 (default - no audio profile data available)"
            danceability_str = "0.50 (default - no audio profile data available)"
            valence_str = "0.50 (default - no audio profile data available)"
            audio_features_avg = {'energy': 0.5, 'danceability': 0.5, 'valence': 0.5}
            print("⚠️  No audio features available from Spotify API or database - using defaults (0.5)")
        
        # Build weather context if available
        weather_info = ""
        if weather_data:
            print(f"🌤️ [WEATHER DEBUG AI] Building weather context for prompt", flush=True)
            import sys
            sys.stdout.flush()
            weather_info = f"""
Current Weather:
- Location: {weather_data.get('city', 'Unknown')}, {weather_data.get('country', 'Unknown')}
- Temperature: {weather_data.get('temperature', 'N/A')}°C (feels like {weather_data.get('feels_like', 'N/A')}°C)
- Condition: {weather_data.get('description', 'N/A').title()} ({weather_data.get('condition', 'N/A')})
- Humidity: {weather_data.get('humidity', 'N/A')}%

Use this weather information to select songs that match the mood and atmosphere. For example:
- Rainy/cloudy → cozy, introspective, calming, or melancholic songs
- Sunny/clear → upbeat, energetic, happy, or uplifting songs
- Cold → warm, comforting, nostalgic, or intimate songs
- Hot → refreshing, tropical, breezy, or chill songs
- Stormy → dramatic, intense, powerful, or emotional songs
- Snow → peaceful, ambient, winter-themed, or contemplative songs
"""
            print(f"🌤️ [WEATHER DEBUG AI] Weather info length: {len(weather_info)} chars", flush=True)
            import sys
            sys.stdout.flush()
        else:
            print(f"🌤️ [WEATHER DEBUG AI] No weather data, skipping weather context", flush=True)
            import sys
            sys.stdout.flush()
        
        context = f"""User's Music Profile:
- Genres: {', '.join(user_profile.get('genres', [])[:10]) or 'Various'}
- Top Artists: {', '.join(top_artists_names) or 'Various'}
- Top Tracks: {', '.join(top_tracks_names) if top_tracks_names else 'None'}
- Energy Level: {energy_str}
- Danceability: {danceability_str}
- Mood (Valence): {valence_str}
{weather_info}
User's Request: {user_message}

Based on this profile and request, recommend exactly 5 songs that match their taste and request. These should be the best matches for the user's request. Return as JSON."""
        
        messages.append({
            "role": "user",
            "content": context
        })
        
        # Print complete prompt and context being sent to LLM (only in debug mode)
        if DEBUG_MODE:
            print(f"\n{'='*80}")
            print(f"=== LLM PROMPT & CONTEXT ===")
            print(f"{'='*80}")
            print(f"\n[SYSTEM PROMPT]")
            print(f"{system_prompt}")
            print(f"\n[CONVERSATION HISTORY]")
            if conversation_history and len(conversation_history) > 0:
                for i, msg in enumerate(conversation_history):
                    print(f"  {i+1}. {msg.get('role', 'unknown')}: {msg.get('content', '')[:100]}...")
            else:
                print(f"  (none)")
            print(f"\n[USER PROFILE CONTEXT]")
            print(f"  Genres: {user_profile.get('genres', [])[:10]}")
            print(f"  Top Artists: {top_artists_names[:10]}")
            print(f"  Top Tracks: {top_tracks_names[:10] if top_tracks_names else 'None'}")
            print(f"  Audio Features:")
            audio_features_avg = user_profile.get('audio_features_avg', {})
            if audio_features_avg and len(audio_features_avg) > 0:
                print(f"    - Energy: {audio_features_avg.get('energy', 0):.2f}")
                print(f"    - Danceability: {audio_features_avg.get('danceability', 0):.2f}")
                print(f"    - Valence (Mood): {audio_features_avg.get('valence', 0):.2f}")
            else:
                print(f"    ⚠️  Audio features not available (API may be restricted)")
            print(f"\n[WEATHER DATA]")
            if weather_data:
                print(f"  Location: {weather_data.get('city', 'Unknown')}, {weather_data.get('country', 'Unknown')}")
                print(f"  Temperature: {weather_data.get('temperature', 'N/A')}°C")
                print(f"  Condition: {weather_data.get('description', 'N/A')}")
            else:
                print(f"  (none)")
            print(f"\n[USER MESSAGE]")
            print(f"  {user_message}")
            print(f"\n[FULL USER CONTEXT SENT TO LLM]")
            print(f"{context}")
            print(f"\n[COMPLETE MESSAGES ARRAY]")
            for i, msg in enumerate(messages):
                role = msg.get('role', 'unknown')
                content_preview = msg.get('content', '')[:200].replace('\n', ' ')
                print(f"  {i+1}. {role}: {content_preview}...")
            print(f"\n{'='*80}\n")
        
        try:
            if DEBUG_MODE:
                print(f"Calling Groq API with model: {self.model}")
            
            # Wait for rate limit if needed (estimate 2000 tokens for main recommendation)
            groq_rate_limiter.wait_if_needed(estimated_tokens=2000)
            
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=0.8,
                    max_tokens=1500,  # Increased for JSON response
                    response_format={"type": "json_object"}  # Force JSON output
                )
            except Exception as e:
                error_str = str(e)
                # If strict JSON validation fails, retry without it (some models struggle with it)
                if "json_validate_failed" in error_str or "400" in error_str:
                    print(f"⚠️ JSON validation failed with strict mode. Retrying without response_format...")
                    response = self.client.chat.completions.create(
                        model=self.model,
                        messages=messages,
                        temperature=0.8,
                        max_tokens=1500
                    )
                else:
                    raise e
            
            content = response.choices[0].message.content
            if DEBUG_MODE:
                print(f"Groq API response length: {len(content) if content else 0}")
            
            if not content:
                raise ValueError(f"Groq API returned empty response. Check if model '{self.model}' is valid and available.")
            
            return content
        except Exception as e:
            error_msg = str(e)
            print(f"\n{'='*80}")
            print(f"ERROR calling Groq API:")
            print(f"  Model: {self.model}")
            print(f"  Error: {error_msg}")
            print(f"{'='*80}\n")
            
            # Check if it's a rate limit error first (before checking for model errors)
            if "rate_limit" in error_msg.lower() or "429" in error_msg or "rate limit" in error_msg.lower():
                raise ValueError(f"Groq API rate limit reached. Please wait a few minutes or upgrade your tier. Error: {error_msg}")
            
            # Check if it's a model decommissioned/unavailable error
            if "decommissioned" in error_msg.lower() or ("model" in error_msg.lower() and "not found" in error_msg.lower()):
                raise ValueError(f"Model '{self.model}' is not available. Please check Groq's available models. Error: {error_msg}")
            raise
    
    def generate_seed_tracks(self, user_profile, user_message):
        """Generate seed tracks/artists for Spotify recommendations API"""
        prompt = f"""
        Based on this music profile, suggest 2-3 seed tracks (song titles) that would work well with Spotify's recommendation algorithm:
        
        Genres: {', '.join(user_profile.get('genres', [])[:10])}
        Top Artists: {', '.join([a['name'] for a in user_profile.get('top_artists', [])[:5]])}
        User Request: {user_message}
        
        Return ONLY a comma-separated list of 2-3 song titles, nothing else.
        """
        
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=100
        )
        
        seed_tracks = response.choices[0].message.content.strip().split(',')
        return [track.strip() for track in seed_tracks]
    
    def batch_score_lyrics_relevance(self, tracks_data, user_prompt):
        """
        Score multiple songs' lyrics in a single API call (more efficient)
        
        Args:
            tracks_data: List of dicts with keys: 'lyrics', 'track_name', 'artist_name', 'track_id'
            user_prompt: User's original request/prompt
        
        Returns:
            Dict mapping track_id to score (0-10), or None if error
        """
        if not tracks_data:
            return {}
        
        # Build batch prompt with all tracks
        tracks_text = ""
        for i, track in enumerate(tracks_data, 1):
            lyrics = track.get('lyrics', '')
            # Truncate lyrics if too long (keep first 600 chars to reduce tokens)
            lyrics_preview = lyrics[:600] if len(lyrics) > 600 else lyrics
            if len(lyrics) > 600:
                lyrics_preview += "\n[... truncated ...]"
            
            tracks_text += f"""
Track {i}: "{track['track_name']}" by {track['artist_name']}
Lyrics:
{lyrics_preview}

"""
        
        prompt = f"""Rate how well each song's lyrics match the user's request on a scale of 1-5 (where 1 = poor match, 3 = decent match, 5 = perfect match).

User's Request: "{user_prompt}"

{tracks_text}

Consider for each track:
- How well the themes, emotions, or messages in the lyrics align with the user's request
- The relevance of the lyrical content to what they're looking for
- The overall match quality

Return your response as a JSON object with track numbers as keys and scores as values (1-5):
{{"1": score, "2": score, "3": score, ...}}

Return ONLY valid JSON, no other text."""

        try:
            if DEBUG_MODE:
                print(f"    📊 Batch scoring {len(tracks_data)} tracks")
            
            # Wait for rate limit if needed (estimate based on number of tracks)
            estimated_tokens = len(tracks_data) * 150 + 200  # ~150 tokens per track + prompt
            groq_rate_limiter.wait_if_needed(estimated_tokens=estimated_tokens)
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,  # Lower temperature for more consistent scoring
                max_tokens=100,
                response_format={"type": "json_object"}  # Force JSON output
            )
            score_text = response.choices[0].message.content.strip()
            
            # Parse JSON response
            import json
            scores_by_index = json.loads(score_text)
            
            # Map back to track IDs
            scores_by_id = {}
            for i, track in enumerate(tracks_data, 1):
                score_key = str(i)
                if score_key in scores_by_index:
                    score = int(scores_by_index[score_key])
                    # Clamp to 1-5
                    score = max(1, min(5, score))
                    scores_by_id[track['track_id']] = score
                else:
                    scores_by_id[track['track_id']] = 3  # Default if missing (midpoint of 1-5)
            
            if DEBUG_MODE:
                print(f"    ✅ Batch scored {len(scores_by_id)} tracks")
            
            return scores_by_id
        except Exception as e:
            print(f"    ❌ Error in batch scoring: {e}")
            # Fallback: return default scores (midpoint of 1-5)
            return {track['track_id']: 3 for track in tracks_data}

    def score_lyrics_relevance(self, lyrics, track_name, artist_name, user_prompt):
        """
        Score how well song lyrics match the user's prompt (0-10 scale)
        [DEPRECATED: Use batch_score_lyrics_relevance for better efficiency]
        
        Args:
            lyrics: Full lyrics text
            track_name: Name of the track
            artist_name: Name of the artist
            user_prompt: User's original request/prompt
        
        Returns:
            Score (0-10) or None if error
        """
        # Truncate lyrics if too long (keep first 600 chars to reduce tokens)
        lyrics_preview = lyrics[:600] if len(lyrics) > 600 else lyrics
        if len(lyrics) > 600:
            lyrics_preview += "\n[... lyrics truncated ...]"
        
        prompt = f"""Rate how well these song lyrics match the user's request on a scale of 0-10.

User's Request: "{user_prompt}"

Song: "{track_name}" by {artist_name}

Lyrics:
{lyrics_preview}

Consider:
- How well the themes, emotions, or messages in the lyrics align with the user's request
- The relevance of the lyrical content to what they're looking for
- The overall match quality

Return ONLY a single number from 1-5 (where 1 = poor match, 3 = decent match, 5 = perfect match), nothing else."""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,  # Lower temperature for more consistent scoring
                max_tokens=10
            )
            score_text = response.choices[0].message.content.strip()
            # Extract number from response
            import re
            score_match = re.search(r'\d+', score_text)
            if score_match:
                score = int(score_match.group())
                # Clamp to 1-5
                score = max(1, min(5, score))
                return score
            return 3  # Default score if parsing fails (midpoint of 1-5)
        except Exception as e:
            print(f"    ❌ Error scoring lyrics: {e}")
            return 3  # Default score on error (midpoint of 1-5)
    
    def explain_lyrics_relevance(self, lyrics, track_name, artist_name, user_prompt):
        """
        Generate explanation of how song lyrics relate to user's prompt and identify highlighted terms
        
        Args:
            lyrics: Full lyrics text
            track_name: Name of the track
            artist_name: Name of the artist
            user_prompt: User's original request/prompt
        
        Returns:
            Tuple of (explanation string, highlighted_terms list) or (None, None) if error
        """
        # Truncate lyrics if too long (keep first 600 chars to reduce tokens)
        lyrics_preview = lyrics[:600] if len(lyrics) > 600 else lyrics
        if len(lyrics) > 600:
            lyrics_preview += "\n[... lyrics truncated ...]"
        
        prompt = f"""Analyze how these song lyrics relate to the user's request and explain why this song is a good match.

User's Request: "{user_prompt}"

Song: "{track_name}" by {artist_name}

Lyrics:
{lyrics_preview}

Provide:
1. A brief, engaging explanation (2-3 sentences) of how the themes, emotions, or messages in these lyrics connect to the user's request and why this song is a perfect match.
2. A list of specific words, phrases, or terms from the lyrics that directly relate to the user's request or preferences. These should be EXACT matches from the lyrics text.

Return your response as a JSON object with this exact structure:
{{
  "explanation": "Your explanation here (2-3 sentences)",
  "highlighted_terms": ["exact word or phrase from lyrics", "another term", "etc"]
}}

CRITICAL RULES FOR highlighted_terms:
- Extract ONLY exact words or phrases as they appear in the lyrics text above
- Do NOT include any explanation text, commentary, or descriptions
- Do NOT include phrases like "is not present" or "terms like"
- Each term must be a direct quote from the lyrics
- Include 3-8 terms that are most relevant to the user's request
- Terms can be single words or short phrases (2-4 words max)
- Copy the terms exactly as they appear in the lyrics (preserve capitalization and spacing)
- Return ONLY valid JSON, no other text"""

        try:
            if DEBUG_MODE:
                print(f"    🤖 Generating lyrics explanation for: {track_name}")
            
            # Wait for rate limit if needed (estimate 510 tokens for explanation - reduced by 30%)
            groq_rate_limiter.wait_if_needed(estimated_tokens=510)
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=280,  # Reduced by 30% from 400 to save tokens
                response_format={"type": "json_object"}  # Force JSON output
            )
            response_text = response.choices[0].message.content.strip()
            
            # Parse JSON response
            import json
            import re
            
            try:
                # Try to extract JSON from response (in case LLM adds extra text)
                result = json.loads(response_text)
            except json.JSONDecodeError:
                # Try to extract JSON from markdown code blocks or plain text
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    result = json.loads(json_match.group())
                else:
                    if DEBUG_MODE:
                        print(f"    ⚠️ Could not parse JSON, using fallback")
                    # Fallback: use response as explanation, no highlighted terms
                    return response_text, []
            
            explanation = result.get('explanation', response_text)
            highlighted_terms = result.get('highlighted_terms', [])
            
            # Clean up highlighted terms - remove any that contain explanation text
            # Filter out terms that look like they contain commentary or aren't from lyrics
            cleaned_terms = []
            for term in highlighted_terms:
                if isinstance(term, str):
                    # Remove terms that contain explanation markers
                    if any(marker in term.lower() for marker in ['is not present', 'terms like', 'relate to', 'such as', 'including']):
                        continue
                    # Remove terms that are too long (likely explanation text)
                    if len(term) > 50:
                        continue
                    # Clean and add
                    cleaned_term = term.strip().strip('"').strip("'")
                    if cleaned_term and len(cleaned_term) > 0:
                        cleaned_terms.append(cleaned_term)
            
            highlighted_terms = cleaned_terms
            
            if DEBUG_MODE:
                print(f"    ✅ Generated explanation ({len(explanation)} chars)")
                print(f"    ✅ Identified {len(highlighted_terms)} highlighted terms: {highlighted_terms[:5]}")
            
            return explanation, highlighted_terms
        except Exception as e:
            print(f"    ❌ Error generating lyrics explanation: {e}")
            return None, None

