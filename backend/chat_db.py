"""
Database operations for chat messages and likes
"""
import os
import json
import psycopg2
from datetime import datetime, timezone
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

DATABASE_URL = os.getenv('DATABASE_URL')

class ChatDatabase:
    def __init__(self, db_url):
        self.db_url = db_url
    
    def _get_connection(self):
        conn = psycopg2.connect(self.db_url)
        conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_READ_COMMITTED)
        return conn
    
    # === CHAT MESSAGES ===
    
    def save_message(self, user_id, session_id, role, content, tracks=None, clerk_id=None):
        """
        Save a chat message to the database
        
        Args:
            user_id: Spotify user ID (deprecated, can be None)
            session_id: Session ID (for Spotify session tracking)
            role: 'user' or 'assistant'
            content: Message content
            tracks: Optional list of track dicts
            clerk_id: Clerk user ID (required for user identification)
        
        Returns:
            message_id: ID of the saved message
        """
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    tracks_json = json.dumps(tracks) if tracks else None
                    
                    cur.execute('''
                        INSERT INTO chat_messages (session_id, role, content, tracks, clerk_id)
                        VALUES (%s, %s, %s, %s, %s)
                        RETURNING id
                    ''', (session_id, role, content, tracks_json, clerk_id))
                    
                    message_id = cur.fetchone()[0]
                    conn.commit()
                    
                    user_display = clerk_id[:10] if clerk_id else (user_id[:10] if user_id else "unknown")
                    print(f"✅ Saved message (ID: {message_id}) for user {user_display}...")
                    return message_id
                    
        except Exception as e:
            print(f"❌ Error saving message: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def get_user_messages(self, clerk_id_or_user_id, limit=50, offset=0):
        """
        Get chat messages for a user (by clerk_id or legacy user_id)
        
        Args:
            clerk_id_or_user_id: Clerk user ID (preferred) or Spotify user ID (legacy)
            limit: Number of messages to retrieve
            offset: Offset for pagination
        
        Returns:
            List of message dicts
        """
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    # Query by clerk_id only (user_id column has been dropped)
                    cur.execute('''
                        SELECT id, session_id, role, content, tracks, created_at, clerk_id
                        FROM chat_messages
                        WHERE clerk_id = %s
                        ORDER BY created_at ASC
                        LIMIT %s OFFSET %s
                    ''', (clerk_id_or_user_id, limit, offset))
                    
                    rows = cur.fetchall()
                    messages = []
                    
                    for row in rows:
                        messages.append({
                            'id': row[0],
                            'session_id': row[1],
                            'role': row[2],
                            'content': row[3],
                            'tracks': row[4],  # Already parsed by psycopg2 for JSONB columns
                            'created_at': row[5].isoformat() if row[5] else None,
                            'clerk_id': row[6]
                        })
                    
                    return messages
                    
        except Exception as e:
            print(f"❌ Error getting user messages: {e}")
            return []
    
    def get_session_messages(self, session_id, limit=50):
        """
        Get chat messages for a session
        
        Args:
            session_id: Session ID
            limit: Number of messages to retrieve
        
        Returns:
            List of message dicts
        """
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute('''
                        SELECT id, user_id, session_id, role, content, tracks, created_at
                        FROM chat_messages
                        WHERE session_id = %s
                        ORDER BY created_at ASC
                        LIMIT %s
                    ''', (session_id, limit))
                    
                    rows = cur.fetchall()
                    messages = []
                    
                    for row in rows:
                        messages.append({
                            'id': row[0],
                            'user_id': row[1],
                            'session_id': row[2],
                            'role': row[3],
                            'content': row[4],
                            'tracks': row[5],  # Already parsed by psycopg2 for JSONB columns
                            'created_at': row[6].isoformat() if row[6] else None
                        })
                    
                    return messages
                    
        except Exception as e:
            print(f"❌ Error getting session messages: {e}")
            return []
    
    # === MESSAGE FEEDBACK ===
    
    def save_message_feedback(self, message_id, user_id, feedback_type):
        """
        Save or update message feedback (like/dislike)
        
        Args:
            message_id: ID of the message
            user_id: Clerk user ID (kept as user_id for backwards compatibility)
            feedback_type: 'like' or 'dislike'
        
        Returns:
            True if successful, False otherwise
        """
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute('''
                        INSERT INTO message_feedback (message_id, clerk_id, feedback_type)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (message_id, clerk_id)
                        DO UPDATE SET feedback_type = EXCLUDED.feedback_type
                    ''', (message_id, user_id, feedback_type))
                    
                    conn.commit()
                    print(f"✅ Saved feedback ({feedback_type}) for message {message_id}")
                    return True
                    
        except Exception as e:
            print(f"❌ Error saving feedback: {e}")
            return False
    
    def remove_message_feedback(self, message_id, user_id):
        """
        Remove message feedback
        
        Args:
            message_id: ID of the message
            user_id: Clerk user ID (kept as user_id for backwards compatibility)
        
        Returns:
            True if successful, False otherwise
        """
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute('''
                        DELETE FROM message_feedback
                        WHERE message_id = %s AND clerk_id = %s
                    ''', (message_id, user_id))
                    
                    conn.commit()
                    print(f"✅ Removed feedback for message {message_id}")
                    return True
                    
        except Exception as e:
            print(f"❌ Error removing feedback: {e}")
            return False
    
    def get_message_feedback(self, message_id, user_id):
        """
        Get feedback for a message by a user
        
        Args:
            message_id: ID of the message
            user_id: Clerk user ID (kept as user_id for backwards compatibility)
        
        Returns:
            'like', 'dislike', or None
        """
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute('''
                        SELECT feedback_type
                        FROM message_feedback
                        WHERE message_id = %s AND clerk_id = %s
                    ''', (message_id, user_id))
                    
                    row = cur.fetchone()
                    return row[0] if row else None
                    
        except Exception as e:
            print(f"❌ Error getting feedback: {e}")
            return None
    
    # === TRACK LIKES ===
    
    def toggle_track_like(self, user_id, track_id, track_name, track_artist, track_image_url=None):
        """
        Toggle track like (if exists, remove it; if not, add it)
        
        Args:
            user_id: Clerk user ID (kept as user_id for backwards compatibility)
            track_id: Spotify track ID
            track_name: Track name
            track_artist: Track artist(s)
            track_image_url: Optional track image URL
        
        Returns:
            True if liked (added), False if unliked (removed)
        """
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    # Check if already liked
                    cur.execute('''
                        SELECT id FROM track_likes
                        WHERE clerk_id = %s AND track_id = %s
                    ''', (user_id, track_id))
                    
                    existing = cur.fetchone()
                    
                    if existing:
                        # Unlike (remove)
                        cur.execute('''
                            DELETE FROM track_likes
                            WHERE clerk_id = %s AND track_id = %s
                        ''', (user_id, track_id))
                        conn.commit()
                        print(f"✅ Unliked track: {track_name}")
                        return False
                    else:
                        # Like (add)
                        cur.execute('''
                            INSERT INTO track_likes (clerk_id, track_id, track_name, track_artist, track_image_url)
                            VALUES (%s, %s, %s, %s, %s)
                        ''', (user_id, track_id, track_name, track_artist, track_image_url))
                        conn.commit()
                        print(f"✅ Liked track: {track_name}")
                        return True
                    
        except Exception as e:
            print(f"❌ Error toggling track like: {e}")
            return None
    
    def get_user_liked_tracks(self, user_id, limit=100, offset=0):
        """
        Get all tracks liked by a user
        
        Args:
            user_id: Clerk user ID (kept as user_id for backwards compatibility)
            limit: Number of tracks to retrieve
            offset: Offset for pagination
        
        Returns:
            List of track dicts
        """
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute('''
                        SELECT id, track_id, track_name, track_artist, track_image_url, created_at
                        FROM track_likes
                        WHERE clerk_id = %s
                        ORDER BY created_at DESC
                        LIMIT %s OFFSET %s
                    ''', (user_id, limit, offset))
                    
                    rows = cur.fetchall()
                    tracks = []
                    
                    for row in rows:
                        tracks.append({
                            'id': row[0],
                            'track_id': row[1],
                            'track_name': row[2],
                            'track_artist': row[3],
                            'track_image_url': row[4],
                            'created_at': row[5].isoformat() if row[5] else None
                        })
                    
                    return tracks
                    
        except Exception as e:
            print(f"❌ Error getting liked tracks: {e}")
            return []
    
    def is_track_liked(self, user_id, track_id):
        """
        Check if a track is liked by a user
        
        Args:
            user_id: Clerk user ID (kept as user_id for backwards compatibility)
            track_id: Spotify track ID
        
        Returns:
            True if liked, False otherwise
        """
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute('''
                        SELECT id FROM track_likes
                        WHERE clerk_id = %s AND track_id = %s
                    ''', (user_id, track_id))
                    
                    return cur.fetchone() is not None
                    
        except Exception as e:
            print(f"❌ Error checking track like: {e}")
            return False
    
    def get_user_liked_track_ids(self, user_id):
        """
        Get all track IDs liked by a user (optimized for quick lookups)
        
        Args:
            user_id: Clerk user ID (kept as user_id for backwards compatibility)
        
        Returns:
            Set of track IDs
        """
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute('''
                        SELECT track_id FROM track_likes
                        WHERE clerk_id = %s
                    ''', (user_id,))
                    
                    return {row[0] for row in cur.fetchall()}
                    
        except Exception as e:
            print(f"❌ Error getting liked track IDs: {e}")
            return set()


# Create global chat database handler
chat_db = None

if DATABASE_URL:
    try:
        chat_db = ChatDatabase(DATABASE_URL)
        print("✅ Chat database handler initialized")
    except Exception as e:
        print(f"❌ Failed to initialize chat database: {e}")
        chat_db = None
else:
    print("⚠️  DATABASE_URL not set - chat history will not be saved")

