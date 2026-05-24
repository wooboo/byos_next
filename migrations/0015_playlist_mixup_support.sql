-- Title: Add screen_type to playlist_items for mixup support
-- Description: Adds a screen_type column so playlist items can reference
-- either a recipe (type='recipe') or a mixup (type='mixup').

ALTER TABLE playlist_items
ADD COLUMN IF NOT EXISTS screen_type TEXT NOT NULL DEFAULT 'recipe';

-- Backfill: detect mixup UUIDs by checking the mixups table.
-- Recipe slugs don't collide with mixup UUIDs, so this is safe.
UPDATE playlist_items
SET screen_type = 'mixup'
WHERE screen_id IN (SELECT id::text FROM mixups);
