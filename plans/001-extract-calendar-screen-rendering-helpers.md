# Plan 001: Extract shared calendar screen rendering helpers

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report; do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 67eaef9..HEAD -- app/\(app\)/recipes/screens/calendar-daily/calendar-daily.tsx app/\(app\)/recipes/screens/calendar-monthly/calendar-monthly.tsx app/\(app\)/recipes/screens/calendar-weekly/calendar-weekly.tsx app/\(app\)/recipes/screens/calendar-ui.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `67eaef9`, 2026-06-13

## Why this matters

Fallow reports duplicated rendering helpers across the daily, monthly, and weekly calendar screens. These screens render to e-ink BMP output, so small layout changes must stay consistent across variants. Extracting shared scale/text helpers removes the lockstep duplication without forcing the three screens into one generic component.

## Current state

Relevant files:

- `app/(app)/recipes/screens/calendar-daily/calendar-daily.tsx` - daily calendar screen renderer.
- `app/(app)/recipes/screens/calendar-monthly/calendar-monthly.tsx` - monthly calendar screen renderer.
- `app/(app)/recipes/screens/calendar-weekly/calendar-weekly.tsx` - weekly calendar screen renderer.
- `app/(app)/recipes/screens/calendar-ui.ts` - create this file for shared non-React calendar rendering primitives.

Duplicated helper excerpt from `calendar-daily.tsx:4`:

```ts
const BASE_W = 800;
function sc(w: number) {
	const s = w / BASE_W;
	return {
		f: (n: number) => Math.round(n * s),
		p: (n: number) => Math.round(n * s),
		b: (n: number) => Math.max(1, Math.round(n * s)),
	};
}
```

Duplicated helper excerpt from `calendar-monthly.tsx:6` and `calendar-weekly.tsx:7`:

```ts
function t(
	s: ReturnType<typeof sc>,
	size: number,
	weight = 400,
	color = "#333",
) {
	return {
		fontFamily: "inter",
		fontSize: s.f(size),
		fontWeight: weight,
		lineHeight: 1.15,
		color,
	};
}
```

Repo conventions:

- Use TypeScript and functional React components. `CONTRIBUTING.md` says to use TypeScript, functional React components with hooks, and Biome.
- Calendar screens use `PreSatori` and inline style objects to render e-ink-friendly layouts.
- Keep Polish labels such as `PN`, `WT`, `ŚR` and "Brak wydarzeń" unchanged.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `pnpm test` | exit 0, all tests pass |
| Lint | `pnpm lint --max-diagnostics=100` | exit 0, no diagnostics |
| Typecheck | `pnpm typecheck` | exit 0, no TypeScript errors |
| Fallow | `pnpm dlx fallow audit --base origin/main --format compact` | exit 0 or prints `No issues in ... changed files`; calendar render clone groups are gone |

## Scope

**In scope**:

- `app/(app)/recipes/screens/calendar-daily/calendar-daily.tsx`
- `app/(app)/recipes/screens/calendar-monthly/calendar-monthly.tsx`
- `app/(app)/recipes/screens/calendar-weekly/calendar-weekly.tsx`
- `app/(app)/recipes/screens/calendar-ui.ts` (new)

**Out of scope**:

- `getData.ts` files. Calendar data extraction is plan 002.
- Any visual redesign or text changes.
- `PreSatori` behavior or bitmap generation routes.

## Git Workflow

- Branch: `codex/001-calendar-screen-helpers` unless the operator provides another branch.
- Commit message style: this repo uses conventional-ish messages such as `Address PR review feedback` and `chore(release): v0.2.3 [skip release]`; use `refactor: extract calendar screen helpers`.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Create shared helper module

Create `app/(app)/recipes/screens/calendar-ui.ts` with:

- `BASE_CALENDAR_WIDTH = 800`.
- `createCalendarScale(width: number)` returning `{ f, p, b }` with the exact current rounding semantics.
- `calendarTextStyle(scale, size, weight?, colorOrMore?)`.

Support both current call shapes:

- daily passes an extra style object: `t(s, 14, 400, { color: "#999" })`.
- monthly/weekly pass a color string: `t(s, 20, 700, "#fff")`.

Prefer a small overload or separate helpers (`calendarTextStyle` and `calendarTextStyleWithColor`) over a clever union if type inference becomes unclear.

**Verify**: `pnpm typecheck` -> exit 0.

### Step 2: Replace local helpers in the three screens

In each calendar screen, remove local `BASE_W`, `sc`, and `t` definitions. Import the shared helpers and keep the local variable names if that minimizes churn:

```ts
import { calendarTextStyle as t, createCalendarScale as sc } from "../calendar-ui";
```

Adjust the relative path if the new module location differs. The call sites should remain visually identical.

**Verify**: `pnpm lint --max-diagnostics=100` -> exit 0.

### Step 3: Confirm Fallow duplication is reduced

Run:

```bash
pnpm dlx fallow audit --base origin/main --format compact
```

Expected result: the clone groups involving `calendar-daily.tsx:4-16`, `calendar-monthly.tsx:6-18`, and `calendar-weekly.tsx:7-19` are gone. Other inherited findings may remain.

## Test Plan

- This is a behavior-preserving extraction. Do not add brittle snapshot tests for the generated JSX.
- Rely on `pnpm typecheck`, `pnpm lint --max-diagnostics=100`, and Fallow clone-group disappearance.
- If a lightweight test is desired, add a Node test for `createCalendarScale(400)` showing `f(10) === 5`, `p(10) === 5`, `b(1) === 1`; keep it in `tests/calendar-ui.test.ts`.

## Done Criteria

- [ ] Local helper definitions are removed from all three calendar screen files.
- [ ] `calendar-ui.ts` owns the shared scale and text-style behavior.
- [ ] `pnpm test` exits 0.
- [ ] `pnpm lint --max-diagnostics=100` exits 0.
- [ ] `pnpm typecheck` exits 0.
- [ ] Fallow no longer reports the calendar rendering clone groups covered by this plan.
- [ ] `plans/README.md` row for plan 001 is updated.

## STOP Conditions

Stop and report if:

- The current helper code no longer matches the excerpts above.
- Extracting the helpers changes visible text, layout constants, or color values.
- You need to touch bitmap rendering, recipe registration, or `getData.ts`.
- Fallow still reports the same clone group after extraction and there is no obvious remaining duplicate helper block.

## Maintenance Notes

Future calendar screens should import the shared calendar UI helpers instead of copying `BASE_W`, `sc`, or `t`. Reviewers should focus on preserving exact style output, not on redesigning the calendar views.
