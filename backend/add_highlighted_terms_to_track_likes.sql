-- Migration: Add highlighted_terms column to track_likes table
-- This stores the highlighted terms from lyrics when a track is liked

ALTER TABLE track_likes
ADD COLUMN IF NOT EXISTS highlighted_terms JSONB DEFAULT '[]'::jsonb;

-- Create index for efficient querying of highlighted terms
CREATE INDEX IF NOT EXISTS idx_track_likes_highlighted_terms 
ON track_likes USING GIN (highlighted_terms);

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'track_likes' 
AND column_name = 'highlighted_terms';

