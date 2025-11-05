"""
Database schema setup for AI DJ chat and likes
Run this file to create the necessary tables in Neon database
"""
import os
import psycopg2
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

DATABASE_URL = os.getenv('DATABASE_URL')

def create_tables():
    """Create tables for chat messages, message feedback, and track likes"""
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL not found in environment variables")
        return
    
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        # Table 1: Chat messages
        print("Creating chat_messages table...")
        cur.execute('''
            CREATE TABLE IF NOT EXISTS chat_messages (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
                content TEXT NOT NULL,
                tracks JSONB,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        ''')
        
        # Index for faster queries
        cur.execute('''
            CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id 
            ON chat_messages(user_id)
        ''')
        cur.execute('''
            CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id 
            ON chat_messages(session_id)
        ''')
        cur.execute('''
            CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at 
            ON chat_messages(created_at DESC)
        ''')
        
        # Table 2: Message feedback (likes/dislikes)
        print("Creating message_feedback table...")
        cur.execute('''
            CREATE TABLE IF NOT EXISTS message_feedback (
                id SERIAL PRIMARY KEY,
                message_id INTEGER NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
                user_id TEXT NOT NULL,
                feedback_type TEXT NOT NULL CHECK (feedback_type IN ('like', 'dislike')),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(message_id, user_id)
            )
        ''')
        
        cur.execute('''
            CREATE INDEX IF NOT EXISTS idx_message_feedback_message_id 
            ON message_feedback(message_id)
        ''')
        cur.execute('''
            CREATE INDEX IF NOT EXISTS idx_message_feedback_user_id 
            ON message_feedback(user_id)
        ''')
        
        # Table 3: Track likes
        print("Creating track_likes table...")
        cur.execute('''
            CREATE TABLE IF NOT EXISTS track_likes (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                track_id TEXT NOT NULL,
                track_name TEXT NOT NULL,
                track_artist TEXT NOT NULL,
                track_image_url TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(user_id, track_id)
            )
        ''')
        
        cur.execute('''
            CREATE INDEX IF NOT EXISTS idx_track_likes_user_id 
            ON track_likes(user_id)
        ''')
        cur.execute('''
            CREATE INDEX IF NOT EXISTS idx_track_likes_track_id 
            ON track_likes(track_id)
        ''')
        cur.execute('''
            CREATE INDEX IF NOT EXISTS idx_track_likes_created_at 
            ON track_likes(created_at DESC)
        ''')
        
        conn.commit()
        print("✅ All tables created successfully!")
        
        # Show table info
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('chat_messages', 'message_feedback', 'track_likes')
        """)
        tables = cur.fetchall()
        print(f"\nCreated tables: {[t[0] for t in tables]}")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    create_tables()

