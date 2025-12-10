"""
Script to clear old recommendation history from the database.
This helps prevent the duplicate filtering from being too aggressive.

Usage:
    python clear_old_recommendations.py [days]
    
    If days is specified, only clears recommendations older than N days.
    If no days specified, clears ALL recommendations (use with caution!).
"""

import os
import sys
import psycopg2
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

DATABASE_URL = os.getenv('DATABASE_URL')

def clear_old_recommendations(days=None):
    """
    Clear old recommendations from the database.
    
    Args:
        days: If specified, only clear recommendations older than N days.
              If None, clear ALL recommendations.
    """
    if not DATABASE_URL:
        print("❌ DATABASE_URL not found in environment variables")
        return False
    
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        if days:
            # Clear recommendations older than N days
            cur.execute('''
                UPDATE chat_messages
                SET tracks = NULL
                WHERE role = 'assistant'
                AND tracks IS NOT NULL
                AND created_at < NOW() - INTERVAL '%s days'
            ''', (days,))
            
            affected_rows = cur.rowcount
            conn.commit()
            
            print(f"✅ Cleared {affected_rows} recommendations older than {days} days")
        else:
            # Confirmation for clearing ALL
            confirm = input("⚠️  This will clear ALL recommendations. Are you sure? (yes/no): ")
            if confirm.lower() != 'yes':
                print("❌ Operation cancelled")
                return False
            
            # Clear ALL recommendations
            cur.execute('''
                UPDATE chat_messages
                SET tracks = NULL
                WHERE role = 'assistant'
                AND tracks IS NOT NULL
            ''')
            
            affected_rows = cur.rowcount
            conn.commit()
            
            print(f"✅ Cleared ALL {affected_rows} recommendations")
        
        cur.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Error clearing recommendations: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    if len(sys.argv) > 1:
        try:
            days = int(sys.argv[1])
            print(f"🗑️  Clearing recommendations older than {days} days...")
            clear_old_recommendations(days)
        except ValueError:
            print("❌ Invalid days argument. Please provide a number.")
            sys.exit(1)
    else:
        print("🗑️  Clearing ALL recommendations...")
        clear_old_recommendations()

