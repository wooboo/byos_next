-- Title: Add Named Screens
-- Description: Adds user-owned configured screen instances and explicit assignment refs

CREATE TABLE IF NOT EXISTS public.screens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  name TEXT NOT NULL,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE RESTRICT,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS screens_user_id_idx ON public.screens (user_id);
CREATE INDEX IF NOT EXISTS screens_recipe_id_idx ON public.screens (recipe_id);

ALTER TABLE devices
ADD COLUMN IF NOT EXISTS screen_type TEXT DEFAULT 'recipe',
ADD COLUMN IF NOT EXISTS screen_id TEXT;

UPDATE devices d
SET screen_id = COALESCE(r.id::text, d.screen),
    screen_type = 'recipe'
FROM recipes r
WHERE d.screen IS NOT NULL
  AND r.slug = d.screen
  AND d.screen_id IS NULL;

UPDATE devices
SET screen_id = screen,
    screen_type = 'recipe'
WHERE screen IS NOT NULL
  AND screen_id IS NULL;

ALTER TABLE mixup_slots
ADD COLUMN IF NOT EXISTS ref_type TEXT DEFAULT 'recipe',
ADD COLUMN IF NOT EXISTS ref_id TEXT;

UPDATE mixup_slots
SET ref_type = 'recipe',
    ref_id = COALESCE(recipe_id::text, recipe_slug)
WHERE ref_id IS NULL;

ALTER TABLE screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE screens FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS screens_select_policy ON screens;
DROP POLICY IF EXISTS screens_insert_policy ON screens;
DROP POLICY IF EXISTS screens_update_policy ON screens;
DROP POLICY IF EXISTS screens_delete_policy ON screens;

CREATE POLICY screens_select_policy ON screens
  FOR SELECT USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY screens_insert_policy ON screens
  FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', true));

CREATE POLICY screens_update_policy ON screens
  FOR UPDATE USING (user_id = current_setting('app.current_user_id', true))
  WITH CHECK (user_id = current_setting('app.current_user_id', true));

CREATE POLICY screens_delete_policy ON screens
  FOR DELETE USING (user_id = current_setting('app.current_user_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON screens TO byos_app;
