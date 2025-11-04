#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔄 Restarting servers...${NC}"

# Kill processes on ports 3000 and 5001
echo -e "${YELLOW}Killing existing processes on ports 3000 and 5001...${NC}"
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:5001 | xargs kill -9 2>/dev/null || true
sleep 1

# Clear Python cache
echo -e "${YELLOW}Clearing Python cache...${NC}"
cd backend
find . -name "*.pyc" -delete 2>/dev/null || true
find . -name "__pycache__" -type d -exec rm -r {} + 2>/dev/null || true
cd ..

# Start Flask server
echo -e "${GREEN}Starting Flask server on port 5001...${NC}"
cd backend
source ../venv/bin/activate
DEV_MODE=true python main.py > ../flask.log 2>&1 &
FLASK_PID=$!
cd ..
echo -e "${GREEN}Flask server started (PID: $FLASK_PID)${NC}"
echo -e "${YELLOW}Flask logs: tail -f flask.log${NC}"

# Wait a bit for Flask to start
sleep 2

# Start Next.js server
echo -e "${GREEN}Starting Next.js server on port 3000...${NC}"
PORT=3000 npm run dev > nextjs.log 2>&1 &
NEXTJS_PID=$!
echo -e "${GREEN}Next.js server started (PID: $NEXTJS_PID)${NC}"
echo -e "${YELLOW}Next.js logs: tail -f nextjs.log${NC}"

# Wait a bit for Next.js to start
sleep 3

# Check if servers are running
if lsof -i:5001 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Flask server is running on http://localhost:5001${NC}"
else
    echo -e "${RED}✗ Flask server failed to start. Check flask.log${NC}"
fi

if lsof -i:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Next.js server is running on http://localhost:3000${NC}"
else
    echo -e "${RED}✗ Next.js server failed to start. Check nextjs.log${NC}"
fi

echo -e "\n${GREEN}✅ Servers restarted!${NC}"
echo -e "${YELLOW}To stop servers:${NC}"
echo -e "  kill $FLASK_PID $NEXTJS_PID"
echo -e "  or: lsof -ti:3000,5001 | xargs kill -9"
echo -e "\n${YELLOW}To view logs:${NC}"
echo -e "  tail -f flask.log    # Flask logs"
echo -e "  tail -f nextjs.log   # Next.js logs"

