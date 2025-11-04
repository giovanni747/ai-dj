# Type Definitions

This directory contains shared TypeScript type definitions used across the AI DJ application.

## Usage

Import types from `@/types`:

```typescript
import type { SpotifyTrack, DJRecommendation, Message } from "@/types";
```

## Available Types

### Spotify API Types

- **`SpotifyTrack`**: Represents a Spotify track with metadata
- **`SpotifyUser`**: User profile information from Spotify
- **`SpotifyArtist`**: Artist information from Spotify

### Application Types

- **`DJRecommendation`**: Response from the AI DJ recommendation endpoint
- **`Message`**: Chat message in the conversation interface
- **`APIResponse<T>`**: Generic API response wrapper
- **`AuthResponse`**: Authentication status response

### User Data Types

- **`UserPreferences`**: User's music preferences and settings
- **`ConversationMessage`**: Stored conversation history with metadata

## Type Safety Benefits

1. **Autocomplete**: Get IntelliSense suggestions in your IDE
2. **Type Checking**: Catch errors at compile time
3. **Documentation**: Types serve as inline documentation
4. **Refactoring**: Safely rename and restructure code

## Adding New Types

When adding new types:

1. Add them to `index.ts`
2. Export them properly
3. Document their purpose in this README
4. Use them consistently across the codebase

