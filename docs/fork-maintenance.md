# Fork Maintenance Notes

This fork intentionally tracks `upstream/main` as the base and keeps local
product features as small overlays. When syncing with upstream again, start from
the new upstream tip and port these overlays forward instead of merging old fork
history wholesale.

## Local overlays to preserve

- PaperColor support:
  - `data/trmnl/palettes.json` adds `m5papercolor-ed2208-m5gfx-v1`.
  - `data/trmnl/models.json` adds `m5stack_papercolor`.
  - `lib/trmnl/palette-colors.ts` resolves native colors and observed colors.
  - `utils/image-processing.ts` and `utils/render-bmp.ts` support indexed color
    dithering and BMP palettes.
  - `lib/recipes/render/rasterize.ts` writes native BMP palette entries while
    matching against observed device colors.
  - `palette_preview=observed` is preview-only; device URLs should keep native
    palette output.

- Device capability persistence:
  - `app/api/display/utils.ts` parses `Palette-Id` and stores known palette IDs
    on devices.
  - `lib/display/select.ts` keeps image URLs self-contained with `model` and
    `palette_id`.
  - `app/api/setup/route.ts` rejects empty-token MAC-only setup and generates a
    missing API key for an existing device only when the owner/session/token is
    authorized.

- Immich favorites recipe:
  - `app/(app)/recipes/screens/immich-favorites/*` is an upstream-style
    `RecipeDefinition`.
  - EXIF orientation is normalized with `sharp(...).rotate()`.
  - `photoRotationSeconds` is a seconds-based stabilization window for random
    favorites. Old rotation params are intentionally ignored.

- Recipe parameter UX:
  - `lib/recipes/zod-form.ts` maps Zod enums to form options.
  - `components/recipes/screen-params-form.tsx` renders enum params as selects,
    boolean params as switches, and refreshes after a successful save.

- Authenticated browser previews:
  - `lib/recipes/renderers/browser.ts` keeps upstream's per-render browser
    context isolation, but adds safe forwarded-cookie filtering, per-cookie
    fallback, loopback handling, and `BROWSER_RENDER_BASE_URL`.

- Device management UX:
  - `app/actions/device.ts` exposes `deleteDevice`.
  - `components/device/delete-device-button.tsx` and
    `components/device/device-view.tsx` add a scoped delete action.

- Full timezone search:
  - `utils/helpers.ts` builds the timezone list from
    `Intl.supportedValuesOf("timeZone")` with labels for common zones.

## Deferred overlays

- Named screens / configurable mixup slots:
  - Do not port the old fork's `screens.params` and polymorphic
    `mixup_slots.ref_type/ref_id` model as-is.
  - Upstream now treats configured recipe instances as `screen_configs` and
    keeps mixup slots normalized around `recipe_id`.
  - If mixup slots need independent recipe configuration, add
    `mixup_slots.params JSONB NOT NULL DEFAULT '{}'::jsonb` and render via
    `recipe_id + params`.
  - Add reusable named presets later only if the product needs reuse outside a
    single mixup or playlist, preferably as a `screen_presets` model that
    references `recipe_id + params`.

## Re-sync procedure

1. Create a new branch from the latest `upstream/main`.
2. Reapply registry data first: PaperColor palette/model.
3. Reapply shared render helpers and run `pnpm test -- utils/render-bmp.test.ts`.
4. Reapply display capability persistence and run `pnpm typecheck`.
5. Reapply setup hardening for known-MAC devices.
6. Reapply recipe param UX, then add/refresh Immich and run
   `pnpm generate:recipes`.
7. Reapply authenticated browser preview cookie/base-URL handling without
   removing upstream's per-render browser context isolation.
8. Reapply small UX overlays: device deletion and full timezone list.
9. Re-run `pnpm typecheck`, targeted tests, then broader project gates.

Avoid reintroducing these old fork structures:

- `app/(app)/recipes/screens.json`
- old manual recipe importer plumbing
- old bitmap render routes that duplicate `lib/recipes/render/rasterize.ts`
- temporary preview diagnostic routes/logging
- old named-screen polymorphic references in mixup slots
