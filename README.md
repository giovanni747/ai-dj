# AI DJ

An intelligent, interactive music companion that creates personalized listening experiences. AI DJ combines the power of Large Language Models (LLMs) with Spotify's extensive library to recommend tracks, analyze lyrics, and interact with you using realistic voice synthesis.

![AI DJ Interface](public/file.svg)

## Features

- **Personalized Recommendations**: Chat with the AI DJ to get music suggestions based on your mood, activity, or preferences.
- **Spotify Integration**: Seamlessly plays tracks, manages playback, and utilizes Spotify's audio features for precise recommendations.
- **Voice Interaction**: Features realistic text-to-speech (TTS) using ElevenLabs and Vapi for a truly conversational experience.
- **Lyrics Analysis**: Highlights meaningful lyrics and provides AI-driven interpretations of songs.
- **Emotion Tracking**: Analyzes your listening history and interactions to gauge your mood and adjust recommendations accordingly.
- **Modern UI**: Built with Next.js 16, Tailwind CSS, and Framer Motion for a smooth, responsive, and animated interface.

## Tech Stack

### Frontend
- **Framework**: [Next.js 16](https://nextjs.org/) (React 19)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/), GSAP, Rive
- **Auth**: [Clerk](https://clerk.com/)
- **UI Components**: Radix UI, Lucide Icons

### Backend
- **Framework**: [Flask](https://flask.palletsprojects.com/)
- **Language**: Python 3.9+
- **Database**: PostgreSQL (via [Neon](https://neon.tech/)), Redis (caching)
- **AI/LLM**: [Groq](https://groq.com/) (Llama 3 models)
- **APIs**: Spotify Web API (Spotipy), Genius (Lyrics), DeepL (Translation)

## Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Python](https://www.python.org/) (v3.9 or higher)
- [PostgreSQL](https://www.postgresql.org/) (or a Neon database URL)
- [Redis](https://redis.io/)

You will also need API keys for:
- **Spotify Developer Dashboard** (Client ID & Secret)
- **Clerk** (Authentication)
- **Groq** (LLM Inference)
- **Genius** (Lyrics - Optional but recommended)
- **ElevenLabs** / **Vapi** (TTS - Optional)

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/ai-dj.git
   cd ai-dj
   ```

2. **Backend Setup**
   Navigate to the backend directory (or root if shared) and set up the Python environment.
   ```bash
   # Create a virtual environment
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate

   # Install dependencies
   pip install -r requirements.txt
   ```

3. **Frontend Setup**
   Install Node.js dependencies.
   ```bash
   npm install
   ```

## Configuration

### Backend Environment Variables
Create a `.env` file in the root directory (or `backend/` if you prefer separating them, but the current setup reads from root for local dev).

```env
# Server
DEV_MODE=true
FLASK_PORT=5001

# Spotify
CLIENT_ID=your_spotify_client_id
CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:5001/callback

# AI & APIs
GROQ_API_KEY=your_groq_api_key
GENIUS_API_KEY=your_genius_api_key
DEEPL_API_KEY=your_deepl_api_key

# Database
DATABASE_URL=postgresql://user:password@host:port/dbname
REDIS_HOST=localhost
REDIS_PORT=6379

# URLs
NEXTJS_URL=http://localhost:3000
```

### Frontend Environment Variables
Create a `.env.local` file in the root directory.

```env
# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# App Config
NEXT_PUBLIC_BASE_URL=http://localhost:3000
FLASK_URL=http://localhost:5001

# Database (for Server Actions/API Routes)
DATABASE_URL=postgresql://user:password@host:port/dbname

# TTS (Optional)
NEXT_PUBLIC_ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_API_KEY=your_elevenlabs_key
VAPI_PRIVATE_KEY=your_vapi_key
```

## Running the Application

1. **Start the Backend**
   Ensure your virtual environment is activated.
   ```bash
   python backend/main.py
   ```
   The Flask server will start on `http://localhost:5001`.

2. **Start the Frontend**
   Open a new terminal window.
   ```bash
   npm run dev
   ```
   The Next.js app will start on `http://localhost:3000`.

3. **Access the App**
   Open your browser and navigate to `http://localhost:3000`. Sign in and connect your Spotify account to start using the AI DJ.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT](LICENSE)

