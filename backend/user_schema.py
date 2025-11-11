"""
Database schema setup for user profiles with Clerk authentication
"""
import os
import psycopg2
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

DATABASE_URL = os.getenv('DATABASE_URL')

def create_users_table():
    """Create users table to link Clerk IDs with Spotify sessions"""
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL not found in environment variables")
        return
    
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        # Table: Users (link Clerk auth with Spotify sessions)
        print("Creating users table...")
        cur.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                clerk_id TEXT UNIQUE NOT NULL,
                spotify_session_id TEXT,
                spotify_user_id TEXT,
                display_name TEXT,
                email TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        ''')
        
        # Index for faster queries
        cur.execute('''
            CREATE INDEX IF NOT EXISTS idx_users_clerk_id 
            ON users(clerk_id)
        ''')
        cur.execute('''
            CREATE INDEX IF NOT EXISTS idx_users_spotify_session_id 
            ON users(spotify_session_id)
        ''')
        cur.execute('''
            CREATE INDEX IF NOT EXISTS idx_users_spotify_user_id 
            ON users(spotify_user_id)
        ''')
        
        # Update chat_messages table to use clerk_id instead of user_id
        print("Updating chat_messages table to use clerk_id...")
        cur.execute('''
            ALTER TABLE chat_messages 
            ADD COLUMN IF NOT EXISTS clerk_id TEXT
        ''')
        cur.execute('''
            CREATE INDEX IF NOT EXISTS idx_chat_messages_clerk_id 
            ON chat_messages(clerk_id)
        ''')
        
        # Update message_feedback table
        print("Updating message_feedback table to use clerk_id...")
        cur.execute('''
            ALTER TABLE message_feedback 
            ADD COLUMN IF NOT EXISTS clerk_id TEXT
        ''')
        cur.execute('''
            CREATE INDEX IF NOT EXISTS idx_message_feedback_clerk_id 
            ON message_feedback(clerk_id)
        ''')
        
        # Update track_likes table
        print("Updating track_likes table to use clerk_id...")
        cur.execute('''
            ALTER TABLE track_likes 
            ADD COLUMN IF NOT EXISTS clerk_id TEXT
        ''')
        cur.execute('''
            CREATE INDEX IF NOT EXISTS idx_track_likes_clerk_id 
            ON track_likes(clerk_id)
        ''')
        
        conn.commit()
        print("✅ Users table and schema updates completed successfully!")
        
        # Show table info
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'users'
        """)
        tables = cur.fetchall()
        print(f"\nCreated tables: {[t[0] for t in tables]}")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error creating users table: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    create_users_table()

