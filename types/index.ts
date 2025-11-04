// Spotify API Types
export interface AudioFeatures {
  energy?: number; // 0.0 to 1.0
  danceability?: number; // 0.0 to 1.0
  valence?: number; // 0.0 to 1.0 (mood: 0=sad, 1=happy)
  tempo?: number; // BPM
  acousticness?: number; // 0.0 to 1.0
  instrumentalness?: number; // 0.0 to 1.0
  liveness?: number; // 0.0 to 1.0
  speechiness?: number; // 0.0 to 1.0
  loudness?: number; // dB (typically -60 to 0)
}

export interface SpotifyTrack {
  position: number; // Position in the playlist (1-10)
  id: string;
  name: string;
  artist: string; // Comma-separated artist names
  artists: { name: string; id: string }[];
  album: {
    name: string;
    images: { url: string }[];
  };
  preview_url: string | null;
  external_url: string;
  duration_ms: number;
  popularity: number;
  audio_features?: AudioFeatures | null; // Audio features from Spotify API
}

export interface SpotifyUser {
  id: string;
  display_name: string;
  email: string;
  country: string;
  followers: number;
  profile_image_url: string | null;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  genres?: string[];
  images?: { url: string }[];
}

// DJ Recommendation Types
export interface DJRecommendation {
  dj_response: string;
  tracks: SpotifyTrack[];
  mood?: string;
  reasoning?: string;
}

// Message Types
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  tracks?: SpotifyTrack[];
}

// API Response Types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface AuthResponse {
  authenticated: boolean;
  user?: SpotifyUser;
  error?: string;
}

// User Preferences Types
export interface UserPreferences {
  favoriteGenres: string[];
  moodPresets: { name: string; description: string }[];
  excludedArtists: string[];
  preferredEra: 'recent' | 'classic' | 'mixed';
  energyLevel: 'low' | 'medium' | 'high';
  explicitContent: boolean;
}

// Conversation History Types
export interface ConversationMessage {
  id: string;
  userId: string;
  timestamp: Date;
  userMessage: string;
  aiResponse: string;
  recommendedTracks: string[]; // Spotify track IDs
  feedback?: 'liked' | 'disliked' | null;
}

