"""
Streaming response support for AI DJ
Allows the frontend to receive partial responses as they're generated
"""

import json
from flask import Response, stream_with_context
from typing import Generator, Any

def stream_json_response(data_generator: Generator[dict, None, None]) -> Response:
    """
    Stream JSON objects as Server-Sent Events (SSE)
    
    Usage:
        def generate_data():
            yield {"type": "intro", "content": "Hello"}
            yield {"type": "song", "data": {...}}
        
        return stream_json_response(generate_data())
    """
    @stream_with_context
    def generate():
        try:
            for data in data_generator:
                # Format as Server-Sent Event
                json_data = json.dumps(data)
                yield f"data: {json_data}\n\n"
        except Exception as e:
            # Send error event
            error_data = json.dumps({"type": "error", "message": str(e)})
            yield f"data: {error_data}\n\n"
        finally:
            # Send completion event
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
    
    return Response(
        generate(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',  # Disable nginx buffering
            'Connection': 'keep-alive'
        }
    )


def stream_dj_recommendation(
    ai_service,
    user_message: str,
    user_profile: dict,
    conversation_history: list,
    weather_data: dict = None
) -> Generator[dict, None, None]:
    """
    Generator that yields DJ recommendation data in chunks
    
    Yields:
        {"type": "status", "message": "Generating recommendations..."}
        {"type": "intro", "content": "DJ intro text"}
        {"type": "songs", "data": [song1, song2, ...]}
        {"type": "progress", "current": 1, "total": 6}
        {"type": "track", "data": {...}}
    """
    try:
        # Step 1: Get AI recommendations
        yield {"type": "status", "message": "🎵 Getting AI recommendations..."}
        
        ai_response_raw = ai_service.get_recommendations(
            user_message,
            user_profile,
            conversation_history,
            weather_data=weather_data
        )
        
        # Parse AI response
        import json
        import re
        
        # Try to parse JSON
        try:
            ai_response_json = json.loads(ai_response_raw)
        except json.JSONDecodeError:
            # Try to extract JSON from markdown code blocks
            json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', ai_response_raw, re.DOTALL)
            if json_match:
                ai_response_json = json.loads(json_match.group(1))
            else:
                # Try to find JSON object directly
                json_match = re.search(r'\{.*\}', ai_response_raw, re.DOTALL)
                if json_match:
                    ai_response_json = json.loads(json_match.group(0))
                else:
                    raise ValueError("Could not parse JSON from LLM response")
        
        dj_intro = ai_response_json.get('intro', 'Check out these amazing tracks!')
        llm_songs = ai_response_json.get('songs', [])
        
        # Step 2: Send intro immediately
        yield {"type": "intro", "content": dj_intro}
        
        # Step 3: Send song list
        yield {"type": "songs", "count": len(llm_songs)}
        
        # Step 4: Stream each track as it's found
        for i, song_data in enumerate(llm_songs, 1):
            yield {
                "type": "progress",
                "current": i,
                "total": len(llm_songs),
                "message": f"Finding {song_data.get('title')}..."
            }
            
            # This would integrate with the actual Spotify search
            # For now, just yield the song data
            yield {
                "type": "song_found",
                "data": song_data,
                "index": i - 1
            }
        
        yield {"type": "status", "message": "✅ All tracks found!"}
        
    except Exception as e:
        yield {"type": "error", "message": str(e)}


def create_streaming_route(app, ai_service):
    """
    Add streaming endpoint to Flask app
    
    Usage:
        from streaming import create_streaming_route
        create_streaming_route(app, ai_service)
    """
    @app.route('/dj_recommend_stream', methods=['POST'])
    def dj_recommend_stream():
        """Streaming version of DJ recommendations"""
        from flask import request, session
        from main import get_authenticated_spotify
        
        sp, redirect_response = get_authenticated_spotify()
        if redirect_response:
            return redirect_response
        
        try:
            data = request.json
            user_message = data.get('message', 'recommend me some great songs')
            selected_tool = data.get('tool')
            
            # Get user profile
            from main import get_user_profile_data
            clerk_id = session.get('clerk_user_id')
            user_profile = get_user_profile_data(sp, clerk_id)
            
            # Get conversation history
            conversation_history = session.get('conversation_history', [])
            
            # Get weather data if needed
            weather_data = None
            if selected_tool == 'weather':
                location = data.get('location')
                if location:
                    # Fetch weather (simplified)
                    pass
            
            # Stream the response
            return stream_json_response(
                stream_dj_recommendation(
                    ai_service,
                    user_message,
                    user_profile,
                    conversation_history,
                    weather_data
                )
            )
        
        except Exception as e:
            return {"error": str(e)}, 500
    
    print("✅ Streaming endpoint registered: /dj_recommend_stream")


if __name__ == "__main__":
    # Test streaming
    def test_generator():
        import time
        for i in range(5):
            yield {"type": "progress", "value": i}
            time.sleep(0.5)
    
    # This would be used in a Flask app
    print("Streaming module loaded successfully")

