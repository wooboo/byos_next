# Plan 002: Extract shared calendar data helpers

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report; do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 67eaef9..HEAD -- app/\(app\)/recipes/screens/calendar-monthly/getData.ts app/\(app\)/recipes/screens/calendar-weekly/getData.ts app/\(app\)/recipes/screens/calendar-data.ts tests/calendar-data.test.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `67eaef9`, 2026-06-13

## Why this matters

Fallow reports both complexity in monthly `getData` and duplicated event filtering between monthly and weekly calendars. The repeated date matching scans all events once per rendered day. A shared date-key helper makes behavior easier to test and removes the duplicated branch-heavy filter logic.

## Current State

Relevant files:

- `app/(app)/recipes/screens/calendar-monthly/getData.ts` - builds month grid and filters events per day.
- `app/(app)/recipes/screens/calendar-weekly/getData.ts` - builds current week and repeats the same event-day filter.
- `app/(app)/recipes/screens/calendar-data.ts` - create this file for shared calendar data helpers.
- `tests/calendar-data.test.ts` - create tests for the shared helpers.

Duplicated monthly excerpt from `calendar-monthly/getData.ts:67`:

```ts
const dayEvents = events.filter((e) => {
	const es = new Date(e.start);
	return (
		es.getFullYear() === date.getFullYear() &&
		es.getMonth() === date.getMonth() &&
		es.getDate() === date.getDate()
	);
});
```

Duplicated weekly excerpt from `calendar-weekly/getData.ts:48`:

```ts
const dayEvents = events.filter((e) => {
	const es = new Date(e.start);
	return (
		es.getFullYear() === date.getFullYear() &&
		es.getMonth() === date.getMonth() &&
		es.getDate() === date.getDate()
	);
});
```

Monthly complexity is concentrated in `getData(params?)`, which currently computes URL, month bounds, fetch range, week rows, today/weekend flags, and event filtering in one function.

Repo conventions:

- Tests use Node's built-in `node:test` and `node:assert/strict` in `tests/*.test.ts`.
- Imports in tests include `.ts` extensions, for example `../lib/calendar/ics.ts`.
- Existing calendar ICS tests stub `globalThis.fetch`; follow that style only if you test fetch callers.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `pnpm test` | exit 0, all tests pass |
| Lint | `pnpm lint --max-diagnostics=100` | exit 0, no diagnostics |
| Typecheck | `pnpm typecheck` | exit 0, no TypeScript errors |
| Fallow | `pnpm dlx fallow audit --base origin/main --format compact` | exit 0 or prints `No issues in ... changed files`; monthly/weekly data clone group is gone |

## Scope

**In scope**:

- `app/(app)/recipes/screens/calendar-monthly/getData.ts`
- `app/(app)/recipes/screens/calendar-weekly/getData.ts`
- `app/(app)/recipes/screens/calendar-data.ts` (new)
- `tests/calendar-data.test.ts` (new)

**Out of scope**:

- Calendar React screen layout files. Those are covered by plan 001.
- `lib/calendar/ics.ts`, except importing its `CalendarEvent` type if needed.
- Changing date semantics, locale names, or the fetch ranges.

## Git Workflow

- Branch: `codex/002-calendar-data-helpers`.
- Commit message: `refactor: extract calendar data helpers`.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add date-key and grouping helpers

Create `app/(app)/recipes/screens/calendar-data.ts` with:

- `calendarDateKey(date: Date): string` using local date parts: year, month, date.
- `groupEventsByCalendarDate(events: CalendarEvent[]): Map<string, CalendarEvent[]>`.
- `eventsForDate(grouped, date): CalendarEvent[]`.
- Optional small helpers for `startOfLocalDay(date)` and `isWeekendDate(date)` if they reduce monthly complexity.

The helper must preserve local-time behavior because the existing code uses `getFullYear()`, `getMonth()`, and `getDate()`.

**Verify**: `pnpm typecheck` -> exit 0.

### Step 2: Add focused unit tests

Create `tests/calendar-data.test.ts` using the existing Node test style. Cover:

- Two events on the same local day are returned together.
- An event on a different local day is not returned.
- The helper returns an empty array for a date with no events.
- Month/day comparisons use local date parts rather than string slicing.

**Verify**: `pnpm test` -> all tests pass, including the new tests.

### Step 3: Update monthly and weekly data builders

In both `getData.ts` files:

- Fetch events as today.
- Build `const eventsByDate = groupEventsByCalendarDate(events);`.
- Replace each inline `events.filter(...)` with `eventsForDate(eventsByDate, date)`.

In monthly `getData`, optionally extract the small inner "build day cell" logic into a local helper if Fallow still reports `getData` complexity. Keep the public `CalendarData` shape unchanged.

**Verify**: `pnpm typecheck` -> exit 0.

### Step 4: Confirm Fallow improvement

Run:

```bash
pnpm dlx fallow audit --base origin/main --format compact
```

Expected result: the clone group involving `calendar-monthly/getData.ts:67-76` and `calendar-weekly/getData.ts:48-57` is gone. Ideally the `calendar-monthly/getData.ts:31` high-complexity finding is also gone or reduced.

## Test Plan

- New `tests/calendar-data.test.ts` covers shared date grouping behavior.
- Existing `tests/calendar-ics.test.ts` remains the model for calendar-related Node tests.
- No network calls should be introduced in these tests.

## Done Criteria

- [ ] Duplicate inline event-day filters are removed from both `getData.ts` files.
- [ ] Shared helper module exists and is tested.
- [ ] Public return shapes `CalendarData` and `WeekData` are unchanged.
- [ ] `pnpm test` exits 0.
- [ ] `pnpm lint --max-diagnostics=100` exits 0.
- [ ] `pnpm typecheck` exits 0.
- [ ] Fallow no longer reports the monthly/weekly data clone group.
- [ ] `plans/README.md` row for plan 002 is updated.

## STOP Conditions

Stop and report if:

- The code no longer uses local date parts for event-day matching.
- Fixing the finding appears to require changing `fetchCalendarEvents` or ICS parsing.
- A test would need fake timers or global date monkey-patching to pass.
- Monthly or weekly output shape would need to change.

## Maintenance Notes

Any future calendar view should use the shared grouping helpers instead of scanning `events.filter(...)` per day. Reviewers should check timezone assumptions carefully; preserving local date matching is intentional here.
