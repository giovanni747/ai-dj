# AI DJ Setup Guide

## 1. Environment Variables

Create a `.env` file in the root directory with:

```bash
# Spotify API Credentials
CLIENT_ID=your_spotify_client_id
CLIENT_SECRET=your_spotify_client_secret

# Groq AI API Key
GROQ_API_KEY=your_groq_api_key

# Neon Database URL (Get from https://neon.tech)
DATABASE_URL=postgresql://username:password@ep-xxxxx.region.neon.tech/dbname?sslmode=require
```

## 2. Get Your Neon Database URL

1. Go to https://neon.tech
2. Sign up or log in
3. Create a new project
4. Copy the connection string from the dashboard
5. Paste it in your `.env` file as `DATABASE_URL`

## 3. Install Dependencies

### Python (Flask Backend)
```bash
cd backend
source ../venv/bin/activate
pip install -r requirements.txt
```

### Node.js (Next.js Frontend)
```bash
npm install
```

## 4. Start the Application

### Terminal 1 - Flask Backend
```bash
cd backend
source ../venv/bin/activate  # On Windows: venv\Scripts\activate
python main.py
```

### Terminal 2 - Next.js Frontend
```bash
npm run dev
```

## 5. Test the Setup

Visit:
- Frontend: http://localhost:3000
- Backend: http://127.0.0.1:5001
- Test database connection: http://localhost:3000/api/check-auth

## Troubleshooting

### Database Connection Issues
- Make sure `DATABASE_URL` is in your `.env` file
- Check that the URL includes `?sslmode=require`
- Verify your Neon project is active

### Authentication Issues
- Make sure Spotify redirect URL is set to: `http://127.0.0.1:5001/callback`
- Check that CLIENT_ID and CLIENT_SECRET are correct

### Port Already in Use
```bash
# Kill process on port 5001 (Flask)
lsof -ti:5001 | xargs kill -9

# Kill process on port 3000 (Next.js)
lsof -ti:3000 | xargs kill -9
```

