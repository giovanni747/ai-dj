-- Migration: Add audio features columns to track_likes table
-- Run this to add energy, danceability, and valence columns

-- Add audio features columns (REAL type for decimal values 0.0-1.0)
ALTER TABLE track_likes 
ADD COLUMN IF NOT EXISTS energy REAL,
ADD COLUMN IF NOT EXISTS danceability REAL,
ADD COLUMN IF NOT EXISTS valence REAL;

-- Add index for faster queries on audio features
CREATE INDEX IF NOT EXISTS idx_track_likes_audio_features 
ON track_likes(clerk_id, energy, danceability, valence) 
WHERE energy IS NOT NULL AND danceability IS NOT NULL AND valence IS NOT NULL;

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'track_likes' 
AND column_name IN ('energy', 'danceability', 'valence');

