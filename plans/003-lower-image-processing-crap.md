# Plan 003: Lower image-processing CRAP with focused tests and small helpers

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report; do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 67eaef9..HEAD -- utils/image-processing.ts tests/image-processing.test.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `67eaef9`, 2026-06-13

## Why this matters

Fallow still reports `detectEdges` as high CRAP and `ditherBayer` as moderate CRAP. These functions directly influence e-ink bitmap output, so behavior-preserving tests are safer than suppressions. This plan adds narrow characterization coverage first, then extracts only tiny helpers if Fallow still reports complexity.

## Current State

Relevant files:

- `utils/image-processing.ts` - dithering and edge detection implementation.
- `tests/image-processing.test.ts` - existing Node test suite for this module.

`detectEdges` excerpt at `utils/image-processing.ts:240`:

```ts
export const detectEdges = (
	grayscale: Uint8Array,
	width: number,
	height: number,
	fuzziness = 20,
): Uint8Array => {
	const result = new Uint8Array(grayscale.length);
	const limit = 255 - fuzziness;
```

`detectEdges` currently checks center and four neighbors:

```ts
const hasExtreme =
	isExtreme(grayscale[idx]) ||
	isExtreme(grayscale[idx - 1]) ||
	isExtreme(grayscale[idx + 1]) ||
	isExtreme(grayscale[idx - width]) ||
	isExtreme(grayscale[idx + width]);
```

`ditherBayer` excerpt at `utils/image-processing.ts:196`:

```ts
const matrixSize = patternSize <= 2 ? 2 : patternSize <= 4 ? 4 : 8;
const matrix = BAYER_MATRICES[matrixSize];
const matrixLength = matrix.length;
```

Existing test style in `tests/image-processing.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
```

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `pnpm test` | exit 0, all tests pass |
| Lint | `pnpm lint --max-diagnostics=100` | exit 0, no diagnostics |
| Typecheck | `pnpm typecheck` | exit 0, no TypeScript errors |
| Fallow | `pnpm dlx fallow audit --base origin/main --format compact` | exit 0 or prints `No issues in ... changed files`; `detectEdges` and `ditherBayer` findings are gone or no longer high-risk |

## Scope

**In scope**:

- `utils/image-processing.ts`
- `tests/image-processing.test.ts`

**Out of scope**:

- Renderer routes and BMP APIs.
- Changing default dithering parameters.
- Any change to random dithering behavior.

## Git Workflow

- Branch: `codex/003-image-processing-crap`.
- Commit message: `test: cover image-processing edge helpers`.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add characterization tests for `detectEdges`

Add tests to `tests/image-processing.test.ts` covering:

- Border pixels are always `0`.
- A center pixel near black marks itself as edge.
- A non-extreme center with an extreme 4-directional neighbor is marked as edge.
- Diagonal-only extremes do not mark the center.
- Fuzziness changes the threshold as expected.

Use tiny 3x3 or 4x4 buffers so expected arrays are readable.

**Verify**: `pnpm test` -> all tests pass.

### Step 2: Add characterization tests for `ditherBayer`

Import `ditherBayer` in `tests/image-processing.test.ts`. Cover:

- `patternSize` values `2`, `4`, and `8` run without changing output length.
- Pattern size below/equal 2 selects the 2x2 matrix; pattern size 3 or 4 selects 4x4; values above 4 select 8x8. Assert exact output for a tiny stable input if practical.
- `applyDithering(DitheringMethod.BAYER, ...)` still routes to Bayer and respects `bayerPatternSize`.

**Verify**: `pnpm test` -> all tests pass.

### Step 3: Only if Fallow still reports complexity, extract tiny helpers

If Fallow still reports `detectEdges` or `ditherBayer`, make small behavior-preserving helper extractions:

- `isExtremeValue(value, fuzziness, limit)`.
- `hasExtremeCardinalNeighbor(grayscale, idx, width, fuzziness, limit)`.
- `resolveBayerMatrixSize(patternSize)`.

Do not rewrite the algorithms.

**Verify**: `pnpm typecheck` -> exit 0.

### Step 4: Confirm Fallow improvement

Run:

```bash
pnpm dlx fallow audit --base origin/main --format compact
```

Expected result: Fallow no longer reports `detectEdges` as high CRAP. If `ditherBayer` remains moderate but `No issues in ... changed files` is still printed, record that in `plans/README.md` and stop; do not churn the algorithm for a marginal metric.

## Test Plan

- New tests live in `tests/image-processing.test.ts`.
- Model new cases after existing `detectEdges` and `applyDithering` tests in the same file.
- Keep tests deterministic; do not depend on `Math.random` except in the existing controlled random test pattern.

## Done Criteria

- [ ] `detectEdges` has focused characterization tests for border, center, neighbor, diagonal, and fuzziness behavior.
- [ ] `ditherBayer` has at least one direct characterization test.
- [ ] No public API exports are removed.
- [ ] `pnpm test` exits 0.
- [ ] `pnpm lint --max-diagnostics=100` exits 0.
- [ ] `pnpm typecheck` exits 0.
- [ ] Fallow output is improved as described in step 4.
- [ ] `plans/README.md` row for plan 003 is updated.

## STOP Conditions

Stop and report if:

- Current `detectEdges` or `ditherBayer` code no longer matches the excerpts.
- Tests reveal current behavior is wrong but fixing it would change rendered BMP output broadly.
- The fix appears to require touching any renderer/API file.
- Fallow improvement would require a large rewrite rather than small tests/helpers.

## Maintenance Notes

These tests protect rendering-sensitive image behavior. Reviewers should inspect expected arrays carefully and reject any test that only asserts "length is unchanged" for behavior that can be asserted exactly.
