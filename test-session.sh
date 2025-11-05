#!/bin/bash

# Test script to verify session persistence and chat history
echo "🔍 Testing Session Persistence & Chat History"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if servers are running
echo "1. Checking if servers are running..."
FLASK_RUNNING=$(lsof -ti:5001 2>/dev/null)
NEXTJS_RUNNING=$(lsof -ti:3000 2>/dev/null)

if [ -z "$FLASK_RUNNING" ]; then
    echo -e "${RED}❌ Flask server not running on port 5001${NC}"
    echo "   Run: cd backend && source ../venv/bin/activate && python main.py"
    exit 1
else
    echo -e "${GREEN}✓ Flask server running${NC}"
fi

if [ -z "$NEXTJS_RUNNING" ]; then
    echo -e "${RED}❌ Next.js server not running on port 3000${NC}"
    echo "   Run: npm run dev"
    exit 1
else
    echo -e "${GREEN}✓ Next.js server running${NC}"
fi

echo ""
echo "2. Checking database connection..."
cd backend
source ../venv/bin/activate 2>/dev/null

DB_CHECK=$(python -c "from chat_db import chat_db; print('OK' if chat_db else 'FAIL')" 2>&1)
if [ "$DB_CHECK" = "OK" ]; then
    echo -e "${GREEN}✓ Database connected${NC}"
else
    echo -e "${RED}❌ Database not connected${NC}"
    echo "   Check your DATABASE_URL in .env"
    cd ..
    exit 1
fi

echo ""
echo "3. Checking if chat_messages table exists..."
TABLE_CHECK=$(python -c "
from chat_db import chat_db
try:
    conn = chat_db._get_connection()
    cur = conn.cursor()
    cur.execute('SELECT COUNT(*) FROM chat_messages')
    count = cur.fetchone()[0]
    print(f'{count}')
    cur.close()
    conn.close()
except Exception as e:
    print('ERROR')
" 2>&1)

if [ "$TABLE_CHECK" = "ERROR" ]; then
    echo -e "${RED}❌ chat_messages table not found${NC}"
    echo "   Run: cd backend && python schema.py"
    cd ..
    exit 1
else
    echo -e "${GREEN}✓ Found ${TABLE_CHECK} messages in database${NC}"
fi

cd ..

echo ""
echo "4. Testing session endpoint (requires authentication)..."
echo -e "${YELLOW}⚠️  You must be authenticated for this test${NC}"
echo "   If you see 401/302, go to http://localhost:5001 to authenticate first"
echo ""

# Try to call the session endpoint (will fail if not authenticated)
RESPONSE=$(curl -s -w "\n%{http_code}" http://127.0.0.1:5001/session_chat_history 2>&1)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    MESSAGE_COUNT=$(echo "$BODY" | grep -o '"total":[0-9]*' | cut -d: -f2)
    echo -e "${GREEN}✓ Session endpoint working${NC}"
    echo "   Found $MESSAGE_COUNT messages in current session"
elif [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "401" ]; then
    echo -e "${YELLOW}⚠️  Not authenticated (HTTP $HTTP_CODE)${NC}"
    echo "   Go to http://localhost:5001 to authenticate with Spotify"
else
    echo -e "${RED}❌ Session endpoint failed (HTTP $HTTP_CODE)${NC}"
    echo "   Response: $BODY"
fi

echo ""
echo "=============================================="
echo "📋 Summary:"
echo ""
echo "To test chat history persistence:"
echo "1. Go to http://localhost:3000"
echo "2. If not authenticated, click 'Connect to Spotify'"
echo "3. Send a test message"
echo "4. Refresh the page (F5 or Cmd+R)"
echo "5. Your message should still be there!"
echo ""
echo "Check browser console (F12) for detailed logs:"
echo "  - 'User authenticated, loading chat history...'"
echo "  - 'Loaded X messages from history'"
echo ""
echo "If messages disappear, check:"
echo "  - Browser cookies: spotify_session_id should exist"
echo "  - Backend logs: session_id should be consistent"
echo "  - See TROUBLESHOOTING_CHAT_HISTORY.md for detailed help"
echo ""

