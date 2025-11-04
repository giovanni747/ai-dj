# Library Utilities

This directory contains shared utility functions and configuration used across the AI DJ application.

## Files

### `config.ts`

Centralized application configuration that reads from environment variables.

**Usage:**

```typescript
import { config, getApiUrl, getAppUrl } from "@/lib/config";

// Access configuration
const spotifyClientId = config.spotify.clientId;
const flaskUrl = config.api.flask;

// Build URLs
const apiEndpoint = getApiUrl('/dj-recommend');
const appUrl = getAppUrl('/dashboard');

// Check environment
import { isDevelopment, isProduction } from "@/lib/config";

if (isDevelopment()) {
  console.log('Running in development mode');
}
```

**Configuration Sections:**

- **`api`**: Flask backend API settings
- **`spotify`**: Spotify OAuth and API configuration
- **`groq`**: Groq AI model settings
- **`database`**: Database connection settings
- **`features`**: Feature flags for enabling/disabling functionality
- **`app`**: General application settings
- **`session`**: Session and cookie configuration

### `utils.ts`

Utility functions including the `cn()` helper for conditional class names.

**Usage:**

```typescript
import { cn } from "@/lib/utils";

<div className={cn(
  "base-class",
  isActive && "active-class",
  "another-class"
)} />
```

## Environment Variables

Required environment variables (see `.env.example`):

```bash
# Spotify
CLIENT_ID=your_spotify_client_id
CLIENT_SECRET=your_spotify_client_secret
REDIRECT_URI=http://127.0.0.1:5001/callback

# Groq AI
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.1-70b-versatile

# Database
DATABASE_URL=your_neon_database_url

# Optional
FLASK_URL=http://127.0.0.1:5001
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NODE_ENV=development
```

## Adding New Configuration

When adding new configuration:

1. Add the environment variable to `.env`
2. Add it to `lib/config.ts` in the appropriate section
3. Document it in this README
4. Add validation if it's required

