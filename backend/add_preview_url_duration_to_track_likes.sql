-- Migration: Add preview_url and duration_ms columns to track_likes table
-- This allows storing preview URLs and track duration for liked tracks

-- Add preview_url and duration_ms columns
ALTER TABLE track_likes 
ADD COLUMN IF NOT EXISTS preview_url TEXT,
ADD COLUMN IF NOT EXISTS duration_ms INTEGER;

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'track_likes' 
AND column_name IN ('preview_url', 'duration_ms');

