#!/bin/bash

# Fresh Start Script - Fixes Cookie Domain Issue
# This script stops servers, clears cache, and restarts everything

echo "🔄 Fresh Start - Fixing Cookie Domain Issue"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Kill existing processes
echo -e "${BLUE}Step 1: Stopping existing servers...${NC}"
pkill -f "next dev"
pkill -f "flask"
pkill -f "python main.py"
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:5001 | xargs kill -9 2>/dev/null
sleep 2
echo -e "${GREEN}✓ Servers stopped${NC}"
echo ""

# Step 2: Clear Next.js cache
echo -e "${BLUE}Step 2: Clearing Next.js cache...${NC}"
rm -f .next/cache/fetch-cache/*.cache 2>/dev/null
rm -rf .next/ 2>/dev/null
rm -f package-lock.json 2>/dev/null
echo -e "${GREEN}✓ Next.js cache cleared${NC}"
echo ""

# Step 3: Clear Python cache
echo -e "${BLUE}Step 3: Clearing Python cache...${NC}"
cd backend
rm -rf __pycache__ 2>/dev/null
find . -name "*.pyc" -delete 2>/dev/null
find . -name "*.pyo" -delete 2>/dev/null
find . -name "*~" -delete 2>/dev/null
cd ..
echo -e "${GREEN}✓ Python cache cleared${NC}"
echo ""

# Step 4: Remind user to clear browser cookies
echo -e "${YELLOW}⚠️  IMPORTANT: Clear your browser cookies!${NC}"
echo ""
echo "In Chrome/Safari DevTools (F12):"
echo "  1. Go to: Application tab"
echo "  2. Expand: Cookies"
echo "  3. Click: http://localhost:3000"
echo "  4. Click: Clear All (or delete spotify_session_id)"
echo ""
echo -e "${YELLOW}Also clear cookies for http://127.0.0.1:3000 if present${NC}"
echo ""
read -p "Press Enter after clearing cookies..."
echo ""

# Step 5: Verify Spotify redirect URI
echo -e "${YELLOW}⚠️  CRITICAL: Verify Spotify Redirect URI${NC}"
echo ""
echo "Go to: https://developer.spotify.com/dashboard"
echo "  1. Select your app"
echo "  2. Edit Settings"
echo "  3. Redirect URI should be: ${GREEN}http://localhost:5001/callback${NC}"
echo "  4. ${RED}NOT${NC} http://127.0.0.1:5001/callback"
echo ""
read -p "Press Enter after verifying..."
echo ""

# Step 6: Start Flask backend
echo -e "${BLUE}Step 6: Starting Flask backend on localhost:5001...${NC}"
cd backend
source ../venv/bin/activate

# Create a new terminal window for Flask
osascript -e 'tell app "Terminal" to do script "cd \"'$(pwd)'\" && source ../venv/bin/activate && echo \"🔥 Starting Flask on http://localhost:5001...\" && python main.py"'

cd ..
sleep 3
echo -e "${GREEN}✓ Flask backend started in new terminal${NC}"
echo ""

# Step 7: Start Next.js frontend
echo -e "${BLUE}Step 7: Starting Next.js frontend on localhost:3000...${NC}"

# Create a new terminal window for Next.js
osascript -e 'tell app "Terminal" to do script "cd \"'$(pwd)'\" && echo \"⚡ Starting Next.js on http://localhost:3000...\" && npm run dev"'

sleep 3
echo -e "${GREEN}✓ Next.js frontend started in new terminal${NC}"
echo ""

# Step 8: Final instructions
echo "=========================================="
echo -e "${GREEN}🎉 Fresh start complete!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo ""
echo "1. Wait ~10 seconds for servers to fully start"
echo ""
echo "2. Open browser to: ${GREEN}http://localhost:3000${NC}"
echo "   ${RED}NOT${NC} http://127.0.0.1:3000"
echo ""
echo "3. Click 'Connect to Spotify' and authenticate"
echo ""
echo "4. Send a test message: ${YELLOW}\"test message 1\"${NC}"
echo ""
echo "5. ${BLUE}Refresh the page (F5 or Cmd+R)${NC}"
echo ""
echo "6. ${GREEN}✅ Your message should still be there!${NC}"
echo ""
echo "=========================================="
echo ""
echo -e "${YELLOW}Check these logs:${NC}"
echo "  - Flask terminal: Should see 'Session ID: <same-uuid>'"
echo "  - Browser console (F12): Should see 'Loaded X messages from history'"
echo ""
echo -e "${BLUE}If messages still disappear:${NC}"
echo "  1. Check browser console for errors"
echo "  2. Verify spotify_session_id cookie exists in DevTools"
echo "  3. Check Flask logs for session ID consistency"
echo "  4. Read: COOKIE_DOMAIN_FIX.md for detailed troubleshooting"
echo ""


