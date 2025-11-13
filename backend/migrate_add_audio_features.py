"""
Migration script to add audio features columns to track_likes table
Run this to add energy, danceability, and valence columns
"""
import os
import psycopg2
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

DATABASE_URL = os.getenv('DATABASE_URL')

def migrate():
    """Add audio features columns to track_likes table"""
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL not found in environment variables")
        return False
    
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        print("Adding audio features columns to track_likes table...")
        
        # Add audio features columns (REAL type for decimal values 0.0-1.0)
        cur.execute('''
            ALTER TABLE track_likes 
            ADD COLUMN IF NOT EXISTS energy REAL,
            ADD COLUMN IF NOT EXISTS danceability REAL,
            ADD COLUMN IF NOT EXISTS valence REAL
        ''')
        
        # Add index for faster queries on audio features
        cur.execute('''
            CREATE INDEX IF NOT EXISTS idx_track_likes_audio_features 
            ON track_likes(clerk_id, energy, danceability, valence) 
            WHERE energy IS NOT NULL AND danceability IS NOT NULL AND valence IS NOT NULL
        ''')
        
        conn.commit()
        print("✅ Audio features columns added successfully!")
        
        # Verify columns were added
        cur.execute('''
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'track_likes' 
            AND column_name IN ('energy', 'danceability', 'valence')
            ORDER BY column_name
        ''')
        
        columns = cur.fetchall()
        if columns:
            print("\n✅ Verified columns:")
            for col_name, col_type in columns:
                print(f"   - {col_name}: {col_type}")
        else:
            print("\n⚠️  Warning: Could not verify columns were added")
        
        cur.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Error running migration: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = migrate()
    exit(0 if success else 1)

