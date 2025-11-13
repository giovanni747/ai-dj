"""
Migration script to add highlighted_terms column to track_likes table
"""
import os
import psycopg2
from dotenv import load_dotenv
from pathlib import Path

env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

DATABASE_URL = os.getenv('DATABASE_URL')

def migrate():
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL not found in environment variables")
        return

    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        print("Adding highlighted_terms column to track_likes table...")
        cur.execute('''
            ALTER TABLE track_likes
            ADD COLUMN IF NOT EXISTS highlighted_terms JSONB DEFAULT '[]'::jsonb;
        ''')
        
        print("Creating index on highlighted_terms...")
        cur.execute('''
            CREATE INDEX IF NOT EXISTS idx_track_likes_highlighted_terms 
            ON track_likes USING GIN (highlighted_terms);
        ''')
        
        conn.commit()
        print("✅ highlighted_terms column added successfully!")

        # Verify column
        cur.execute("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'track_likes'
            AND column_name = 'highlighted_terms';
        """)
        columns = cur.fetchall()
        print("\n✅ Verified column:")
        for col in columns:
            print(f"   - {col[0]}: {col[1]}")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"❌ Error during migration: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    migrate()

