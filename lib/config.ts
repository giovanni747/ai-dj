/**
 * Application Configuration
 * Centralized configuration for environment variables and app settings
 */

// Validate required environment variables
const requiredEnvVars = {
  CLIENT_ID: process.env.CLIENT_ID,
  CLIENT_SECRET: process.env.CLIENT_SECRET,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
} as const;

// Check for missing environment variables
const missingVars = Object.entries(requiredEnvVars)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0 && process.env.NODE_ENV !== 'test') {
  console.warn(
    `Warning: Missing environment variables: ${missingVars.join(', ')}`
  );
}

export const config = {
  // API Configuration
  api: {
    flask: process.env.FLASK_URL || 'http://127.0.0.1:5001',
    timeout: 30000,
    retries: 3,
  },

  // Spotify Configuration
  spotify: {
    clientId: process.env.CLIENT_ID || '',
    clientSecret: process.env.CLIENT_SECRET || '',
    redirectUri: process.env.REDIRECT_URI || 'http://127.0.0.1:5001/callback',
    scope: 'user-read-private user-read-email playlist-read-private playlist-read-collaborative user-top-read user-read-recently-played playlist-modify-public playlist-modify-private',
  },

  // Groq AI Configuration
  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    model: process.env.GROQ_MODEL || 'llama-3.1-70b-versatile',
    maxTokens: 1024,
    temperature: 0.7,
  },

  // Database Configuration
  database: {
    url: process.env.DATABASE_URL || '',
  },

  // Feature Flags
  features: {
    enablePlaylistCreation: true,
    enableFeedback: true,
    enableConversationHistory: true,
    enableUserPreferences: true,
    maxRecommendations: 20,
    maxConversationHistory: 50,
  },

  // App Configuration
  app: {
    name: 'AI DJ',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3000,
    baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
  },

  // Session Configuration
  session: {
    cookieName: 'spotify_session_id',
    maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
  },
} as const;

// Type-safe config access
export type Config = typeof config;

// Helper function to check if we're in development
export const isDevelopment = () => config.app.environment === 'development';

// Helper function to check if we're in production
export const isProduction = () => config.app.environment === 'production';

// Helper to get full API URL
export const getApiUrl = (path: string) => {
  const baseUrl = config.api.flask;
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
};

// Helper to get full app URL
export const getAppUrl = (path: string = '') => {
  const baseUrl = config.app.baseUrl;
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
};

