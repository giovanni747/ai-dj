import os
import json
import psycopg2
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

# Get Neon database URL from environment
DATABASE_URL = os.getenv('DATABASE_URL')

class NeonDBHandler:
    def __init__(self, db_url):
        self.db_url = db_url
        self._init_db()
    
    def _get_connection(self):
        conn = psycopg2.connect(self.db_url)
        # Set to READ COMMITTED to ensure we see committed data
        conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_READ_COMMITTED)
        return conn
    
    def _init_db(self):
        """Initialize database tables"""
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute('''
                        CREATE TABLE IF NOT EXISTS sessions (
                            session_id TEXT PRIMARY KEY,
                            token_info TEXT NOT NULL,
                            expires_at TIMESTAMPTZ NOT NULL,
                            created_at TIMESTAMPTZ DEFAULT NOW()
                        )
                    ''')
                    # In case table exists with TIMESTAMP, migrate to TIMESTAMPTZ
                    try:
                        cur.execute("""
                            ALTER TABLE sessions
                            ALTER COLUMN expires_at TYPE TIMESTAMPTZ
                            USING expires_at AT TIME ZONE 'UTC'
                        """)
                        conn.commit()
                    except Exception:
                        conn.rollback()
                    cur.execute('CREATE INDEX IF NOT EXISTS idx_expires_at ON sessions(expires_at)')
                    conn.commit()
            print("Database initialized successfully")
        except Exception as e:
            print(f"WARNING: Database initialization failed: {e}")
            print("Falling back to in-memory session storage")
    
    def store_token(self, session_id, token_info):
        """Store token in Neon database"""
        try:
            print(f"DEBUG: About to store token for {session_id}")
            print(f"DEBUG: Token info keys: {token_info.keys() if isinstance(token_info, dict) else type(token_info)}")
            
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    # Expires in 1 hour (UTC)
                    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
                    
                    token_json = json.dumps(token_info)
                    print(f"DEBUG: Token JSON length: {len(token_json)}")
                    
                    cur.execute('''
                        INSERT INTO sessions (session_id, token_info, expires_at)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (session_id) DO UPDATE SET
                            token_info = EXCLUDED.token_info,
                            expires_at = EXCLUDED.expires_at
                    ''', (session_id, token_json, expires_at))
                    
                    conn.commit()
                    print(f"DEBUG: Committed to database")
                    
                    # Test read immediately to verify it was stored
                    cur.execute('SELECT COUNT(*) FROM sessions WHERE session_id = %s', (session_id,))
                    count = cur.fetchone()[0]
                    print(f"DEBUG: Verification query - sessions with this ID: {count}")
                    
        except Exception as e:
            print(f"ERROR storing token: {e}")
            import traceback
            traceback.print_exc()
            raise
    
    def get_token(self, session_id):
        """Get token from Neon database"""
        try:
            print(f"DEBUG: About to get token for {session_id}")
            
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    # Clean up expired sessions
                    cur.execute("DELETE FROM sessions WHERE expires_at < NOW()")
                    
                    cur.execute('SELECT token_info FROM sessions WHERE session_id = %s', (session_id,))
                    row = cur.fetchone()
                    
                    if row:
                        print(f"DEBUG: Found token in DB")
                        return json.loads(row[0])
                    else:
                        print(f"DEBUG: No token found in DB for session_id: {session_id}")
                    return None
        except Exception as e:
            print(f"ERROR getting token: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def delete_token(self, session_id):
        """Delete token from Neon database"""
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute('DELETE FROM sessions WHERE session_id = %s', (session_id,))
                    conn.commit()
        except Exception as e:
            print(f"Error deleting token: {e}")

# Create global database handler if DATABASE_URL is set
# Fallback to in-memory storage if database is unavailable
token_cache = {}
db_handler = None

if DATABASE_URL:
    print(f"Initializing database handler with URL: {DATABASE_URL[:30]}...")
    try:
        db_handler = NeonDBHandler(DATABASE_URL)
        print("Using Neon database for session storage")
    except Exception as e:
        print(f"Failed to initialize database: {e}")
        print("Falling back to in-memory session storage")
        db_handler = None

def store_token(session_id, token_info):
    if db_handler:
        try:
            print(f"STORING token for session_id: {session_id}")
            db_handler.store_token(session_id, token_info)
            print(f"Token stored successfully in database")
            return
        except Exception as e:
            print(f"Database store failed: {e}, using in-memory fallback")
    
    # In-memory fallback
    token_cache[session_id] = {
        'token_info': token_info,
        'expires_at': datetime.now(timezone.utc) + timedelta(hours=1)
    }
    print(f"Token stored in memory for session_id: {session_id}")

def get_token(session_id):
    if db_handler:
        try:
            print(f"GETTING token for session_id: {session_id}")
            token = db_handler.get_token(session_id)
            print(f"Token found in database: {token is not None}")
            return token
        except Exception as e:
            print(f"Database get failed: {e}, checking in-memory fallback")
    
    # In-memory fallback
    if session_id in token_cache:
        if datetime.now(timezone.utc) < token_cache[session_id]['expires_at']:
            print(f"Token found in memory for session_id: {session_id}")
            return token_cache[session_id]['token_info']
        else:
            del token_cache[session_id]
            print(f"Token expired in memory for session_id: {session_id}")
    
    print(f"Token not found for session_id: {session_id}")
    return None

def delete_token(session_id):
    if db_handler:
        try:
            db_handler.delete_token(session_id)
            return
        except Exception:
            pass
    
    # In-memory fallback
    if session_id in token_cache:
        del token_cache[session_id]
