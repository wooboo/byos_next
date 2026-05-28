# Named Screens Implementation Plan

## Goal

Introduce named screen instances between recipes and assignments. A recipe is a reusable template; a screen is a user-owned configured instance of a recipe. Devices, playlists, and mixups should assign screens. Legacy recipe assignments remain readable.

## Decisions

- `screens.id` is the immutable public/domain identifier.
- Screens do not have slugs.
- `screens.recipe_id` is required and immutable.
- `screens.params` stores a full snapshot of recipe params at creation time.
- Existing `screen_configs` remains recipe-level defaults and legacy recipe render params.
- New assignment flows may show recipes, but selecting a recipe asks for a screen name, creates a screen, then assigns that screen.
- New refs use:
  - `screen`: `screens.id`
  - `recipe`: `recipes.id` for new data; legacy slug readable
  - `mixup`: `mixups.id`
- Devices add `screen_type` / `screen_id`; `devices.screen` remains legacy fallback.
- Playlists keep `screen_type` / `screen_id` with expanded semantics: `recipe | screen | mixup`.
- Mixup slots add `ref_type` / `ref_id`; `recipe_id` / `recipe_slug` remain legacy fallback.
- Named screen bitmap endpoint: `/api/bitmap/screen/:screenId.bmp`.
- Recipe bitmap endpoint `/api/bitmap/:recipeRef.bmp` resolves both slug and id.
- Convert legacy recipe creates one new screen and rewires all current user legacy uses of that recipe to it.
- Screens are per-user only.
- Screen delete is blocked if used by device, playlist, or mixup.
- Screen duplication is supported.

## Implementation Scope

Full slice in one branch:

1. Database migration and generated SQL registry update.
2. Type updates for DB and app models.
3. Shared render target resolver.
4. Screen server actions: list/create/update params/rename/duplicate/delete/convert.
5. Bitmap endpoint for named screens.
6. Recipe bitmap endpoint supports recipe id and slug.
7. Device display API uses `screen_type/screen_id` with legacy fallback.
8. Playlist URL builder and display API support screen refs.
9. Mixup renderer supports `ref_type/ref_id` and screen refs.
10. UI:
    - Screens section/list/detail/edit params/preview.
    - Assignment selectors can choose existing screen or create screen from recipe.
    - Convert legacy recipe action where applicable.

## Migration Notes

- Create `screens` table with RLS.
- Add `devices.screen_type text default 'recipe'`, `devices.screen_id text`.
- Backfill `devices.screen_id` from `recipes.id` where `devices.screen = recipes.slug`; otherwise keep legacy slug fallback.
- Add `mixup_slots.ref_type text default 'recipe'`, `mixup_slots.ref_id text`.
- Backfill `mixup_slots.ref_id` from `recipe_id` if present, else from `recipe_slug`.
- Keep old columns.

## Validation

- Existing recipe-only devices continue rendering.
- Named screen renders with independent params.
- Creating from recipe snapshots current recipe params.
- Same recipe can create multiple screens.
- Deleting used screen is blocked.
- Convert rewires all current user legacy uses.
