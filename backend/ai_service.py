import os
from groq import Groq
from dotenv import load_dotenv
from pathlib import Path

env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

class GroqRecommendationService:
    def __init__(self):
        self.client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        # Use llama-3.3-70b-versatile (latest stable Groq model with good JSON support)
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
    
    def get_recommendations(self, user_message, user_profile, conversation_history=None):
        """Get AI DJ recommendations: returns both intro text and song list"""
        
        # Build conversation history
        messages = []
        
        # System prompt - AI DJ that recommends songs
        system_prompt = """You are an AI DJ specializing in music recommendations. Your job is to:
1. Analyze the user's music taste from their Spotify data (genres, artists, audio features)
2. Match their taste with their specific request
3. Recommend exactly 20 songs that exist on Spotify (we'll filter to best matches based on audio features)
4. Provide a brief DJ-style introduction (2-3 sentences)

Return your response as a JSON object with this exact structure:
{
  "intro": "Your DJ-style introduction here (2-3 sentences)",
  "songs": [
    {"title": "Song Title", "artist": "Artist Name"},
    {"title": "Song Title", "artist": "Artist Name"},
    ... (exactly 20 songs)
  ]
}

IMPORTANT:
- Only recommend songs that actually exist on Spotify (popular, well-known songs)
- Match the user's request AND their music taste
- Ensure songs are relevant to what they asked for
- Provide variety in your recommendations (we'll filter to best matches)
- Return ONLY valid JSON, no other text"""
        
        if conversation_history and len(conversation_history) > 0:
            messages = [{"role": "system", "content": system_prompt}] + conversation_history
        else:
            messages.append({"role": "system", "content": system_prompt})
        
        # Build detailed user profile context
        top_artists_names = [a['name'] for a in user_profile.get('top_artists', [])[:10]]
        top_tracks_names = [t['name'] for t in user_profile.get('top_tracks', [])[:10]]
        
        # Get audio features with fallback display
        audio_features_avg = user_profile.get('audio_features_avg', {})
        has_audio_features = audio_features_avg and len(audio_features_avg) > 0
        
        if has_audio_features:
            energy_str = f"{audio_features_avg.get('energy', 0):.2f} (0=calm, 1=energetic)"
            danceability_str = f"{audio_features_avg.get('danceability', 0):.2f} (0=not danceable, 1=danceable)"
            valence_str = f"{audio_features_avg.get('valence', 0):.2f} (0=sad, 1=happy)"
        else:
            energy_str = "Not available (audio features API access restricted)"
            danceability_str = "Not available (audio features API access restricted)"
            valence_str = "Not available (audio features API access restricted)"
        
        context = f"""User's Music Profile:
- Genres: {', '.join(user_profile.get('genres', [])[:10]) or 'Various'}
- Top Artists: {', '.join(top_artists_names) or 'Various'}
- Top Tracks: {', '.join(top_tracks_names) if top_tracks_names else 'None'}
- Energy Level: {energy_str}
- Danceability: {danceability_str}
- Mood (Valence): {valence_str}

User's Request: {user_message}

Based on this profile and request, recommend exactly 20 songs that match their taste and request. We'll filter these to find the best matches based on audio features. Return as JSON."""
        
        messages.append({
            "role": "user",
            "content": context
        })
        
        # Print complete prompt and context being sent to LLM
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
            print(f"Calling Groq API with model: {self.model}")
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.8,
                max_tokens=1500  # Increased for JSON response
            )
            
            content = response.choices[0].message.content
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
            
            # Check if it's a model decommissioned error
            if "decommissioned" in error_msg.lower() or "model" in error_msg.lower():
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

