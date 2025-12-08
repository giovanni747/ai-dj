import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')

def migrate():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    try:
        print("Creating user_emotions table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS user_emotions (
                id SERIAL PRIMARY KEY,
                clerk_id VARCHAR(255) NOT NULL,
                emotion VARCHAR(100) NOT NULL,
                definition TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Add index on clerk_id for faster lookups
        print("Adding index on clerk_id...")
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_user_emotions_clerk_id ON user_emotions(clerk_id);
        """)
        
        # Add constraint to prevent duplicate emotions for same user
        print("Adding unique constraint on (clerk_id, emotion)...")
        cur.execute("""
            ALTER TABLE user_emotions 
            DROP CONSTRAINT IF EXISTS unique_user_emotion;
        """)
        cur.execute("""
            ALTER TABLE user_emotions 
            ADD CONSTRAINT unique_user_emotion UNIQUE (clerk_id, emotion);
        """)
        
        conn.commit()
        print("✅ Migration successful!")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Migration failed: {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    migrate()

