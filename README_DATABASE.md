# Database Setup for AI DJ

This guide explains how to set up the Neon database to store chat messages and likes.

## Features

The database stores:
- **Chat Messages**: All conversations between users and the AI DJ
- **Message Feedback**: Likes and dislikes for AI responses
- **Track Likes**: Individual song likes from users

## Prerequisites

1. A Neon database account (https://neon.tech)
2. `DATABASE_URL` set in your `.env` file
3. Python packages installed (`psycopg2-binary` is already in requirements.txt)

## Setup Instructions

### 1. Create the Database Tables

Run the schema setup script:

```bash
cd backend
python schema.py
```

This will create three tables:
- `chat_messages`: Stores all chat interactions
- `message_feedback`: Stores likes/dislikes for messages
- `track_likes`: Stores liked tracks

### 2. Verify Tables Were Created

The script will print confirmation messages:
```
Creating chat_messages table...
Creating message_feedback table...
Creating track_likes table...
✅ All tables created successfully!
```

## Database Schema

### `chat_messages`
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| user_id | TEXT | Spotify user ID |
| session_id | TEXT | Session ID |
| role | TEXT | 'user' or 'assistant' |
| content | TEXT | Message content |
| tracks | JSONB | Track data (for assistant messages) |
| created_at | TIMESTAMPTZ | Creation timestamp |

### `message_feedback`
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| message_id | INTEGER | References chat_messages(id) |
| user_id | TEXT | Spotify user ID |
| feedback_type | TEXT | 'like' or 'dislike' |
| created_at | TIMESTAMPTZ | Creation timestamp |

### `track_likes`
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| user_id | TEXT | Spotify user ID |
| track_id | TEXT | Spotify track ID |
| track_name | TEXT | Track name |
| track_artist | TEXT | Artist name(s) |
| track_image_url | TEXT | Album art URL |
| created_at | TIMESTAMPTZ | Creation timestamp |

## API Endpoints

### Chat & Likes
- `POST /track_like` - Toggle track like/unlike
- `GET /liked_tracks` - Get all liked tracks for user
- `GET /liked_track_ids` - Get liked track IDs (for quick lookups)
- `POST /message_feedback` - Save message like/dislike
- `GET /chat_history` - Get all chat messages for user
- `GET /session_chat_history` - Get chat messages for current session

## Usage

### From Frontend

Track likes are automatically saved when users click the heart button on songs.

### Example: Manually Toggle Track Like

```javascript
const response = await fetch('http://127.0.0.1:5001/track_like', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include',
  body: JSON.stringify({
    track_id: '3n3Ppam7vgaVa1iaRUc9Lp',
    track_name: 'Mr. Brightside',
    track_artist: 'The Killers',
    track_image_url: 'https://i.scdn.co/image/...',
  }),
});

const data = await response.json();
console.log('Liked:', data.liked); // true if liked, false if unliked
```

### Example: Get Liked Tracks

```javascript
const response = await fetch('http://127.0.0.1:5001/liked_tracks', {
  credentials: 'include',
});

const data = await response.json();
console.log('Liked tracks:', data.tracks);
```

## Troubleshooting

### "Database not configured" Error

Make sure `DATABASE_URL` is set in your `.env` file:
```
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
```

### Tables Not Created

Run the schema script again:
```bash
cd backend
python schema.py
```

### Connection Issues

1. Check your Neon dashboard to ensure the database is active
2. Verify your connection string is correct
3. Ensure your IP is allowed in Neon's security settings

## Migration

If you need to reset the database:

```sql
DROP TABLE IF EXISTS message_feedback CASCADE;
DROP TABLE IF EXISTS track_likes CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
```

Then run `python schema.py` again.

## Notes

- All timestamps are stored in UTC (`TIMESTAMPTZ`)
- Track likes are unique per user (can't like same track twice)
- Message feedback is unique per message per user
- Chat messages are automatically saved when users interact with the AI DJ

