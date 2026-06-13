# Plan 004: Split sidebar rendering branches and tooltip normalization

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report; do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 67eaef9..HEAD -- components/ui/sidebar.tsx`
> If `components/ui/sidebar.tsx` changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `67eaef9`, 2026-06-13

## Why this matters

Fallow reports `Sidebar` as high complexity and `SidebarMenuButton` as moderate complexity. This file is a shared UI primitive: behavior changes can affect every app page. The right fix is a behavior-preserving extraction of rendering branches and tooltip normalization, not a visual redesign.

## Current State

Relevant file:

- `components/ui/sidebar.tsx` - shared sidebar primitives and menu button variants.

`Sidebar` starts at `components/ui/sidebar.tsx:154` and currently handles all rendering modes in one function:

```tsx
function Sidebar({
	side = "left",
	variant = "sidebar",
	collapsible = "offcanvas",
	className,
	children,
	...props
}: React.ComponentProps<"div"> & {
	side?: "left" | "right";
	variant?: "sidebar" | "floating" | "inset";
	collapsible?: "offcanvas" | "icon" | "none";
}) {
	const { isMobile, state, openMobile, setOpenMobile } = useSidebar();
```

It has separate branches for:

```tsx
if (collapsible === "none") {
	return ( ... );
}

if (isMobile) {
	return ( ... );
}

return ( ... desktop sidebar ... );
```

`SidebarMenuButton` starts at `components/ui/sidebar.tsx:498` and currently normalizes tooltip props inside the rendering function:

```tsx
if (!tooltip) {
	return button;
}

if (typeof tooltip === "string") {
	tooltip = {
		children: tooltip,
	};
}
```

Repo conventions:

- This file uses `cn(...)`, `cva(...)`, Radix `Slot.Root`, and local `Tooltip` components.
- Keep exported component names and data attributes stable (`data-slot`, `data-sidebar`, `data-active`, etc.).
- Biome formatting is authoritative.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Lint | `pnpm lint --max-diagnostics=100` | exit 0, no diagnostics |
| Typecheck | `pnpm typecheck` | exit 0, no TypeScript errors |
| Tests | `pnpm test` | exit 0, all tests pass |
| Fallow | `pnpm dlx fallow audit --base origin/main --format compact` | exit 0 or prints `No issues in ... changed files`; sidebar complexity findings are gone or reduced |

## Scope

**In scope**:

- `components/ui/sidebar.tsx`

**Out of scope**:

- Any styling redesign.
- Any change to public exported names.
- Any change to Radix/shadcn component dependencies.
- Adding a new test framework.

## Git Workflow

- Branch: `codex/004-sidebar-complexity`.
- Commit message: `refactor: split sidebar rendering branches`.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Extract non-collapsible sidebar branch

Inside `components/ui/sidebar.tsx`, add a private helper component near `Sidebar`:

```tsx
function StaticSidebar(...)
```

It should render exactly the current `collapsible === "none"` branch. Keep props typed narrowly enough to avoid `any`; reuse `React.ComponentProps<"div">` plus the current sidebar prop fields where needed.

**Verify**: `pnpm typecheck` -> exit 0.

### Step 2: Extract mobile sidebar branch

Add a private helper such as `MobileSidebar(...)` that receives `side`, `openMobile`, `setOpenMobile`, `children`, and div props, and renders exactly the current `isMobile` branch.

Do not change:

- `Sheet`
- `SheetContent`
- `SheetHeader`
- `SheetTitle`
- `SheetDescription`
- `SIDEBAR_WIDTH_MOBILE`
- `data-sidebar`, `data-slot`, or `data-mobile` attributes.

**Verify**: `pnpm lint --max-diagnostics=100` -> exit 0.

### Step 3: Extract desktop sidebar branch

Move the final desktop return into `DesktopSidebar(...)`. It should receive `side`, `variant`, `collapsible`, `state`, `className`, `children`, and div props.

Keep all class strings and conditional logic identical. The parent `Sidebar` should become a small dispatcher:

```tsx
if (collapsible === "none") return <StaticSidebar ... />;
if (isMobile) return <MobileSidebar ... />;
return <DesktopSidebar ... />;
```

**Verify**: `pnpm typecheck` -> exit 0.

### Step 4: Extract tooltip normalization

Add a helper:

```tsx
function normalizeSidebarTooltip(tooltip: SidebarMenuButtonProps["tooltip"])
```

or define a local `type SidebarMenuButtonProps = ...` if needed. It should return `undefined` for falsy tooltip, `{ children: tooltip }` for string tooltip, and the object unchanged otherwise. `SidebarMenuButton` should stop mutating the `tooltip` parameter.

**Verify**: `pnpm lint --max-diagnostics=100` -> exit 0.

### Step 5: Confirm Fallow improvement

Run:

```bash
pnpm dlx fallow audit --base origin/main --format compact
```

Expected result: `Sidebar` and `SidebarMenuButton` complexity findings are gone or reduced. Other inherited findings may remain.

## Test Plan

- No new test framework is required for this plan.
- Verification relies on TypeScript, Biome, and behavior-preserving extraction.
- If the repo later adopts React component tests, add coverage for mobile vs desktop vs non-collapsible branches as a follow-up, not inside this plan.

## Done Criteria

- [ ] `Sidebar` is a small dispatcher with extracted private branch components.
- [ ] `SidebarMenuButton` no longer mutates its `tooltip` parameter.
- [ ] Public exports and data attributes are unchanged.
- [ ] `pnpm test` exits 0.
- [ ] `pnpm lint --max-diagnostics=100` exits 0.
- [ ] `pnpm typecheck` exits 0.
- [ ] Fallow sidebar complexity findings are gone or reduced.
- [ ] `plans/README.md` row for plan 004 is updated.

## STOP Conditions

Stop and report if:

- The live sidebar code no longer matches the branch structure shown above.
- Type-safe props require widespread changes outside `components/ui/sidebar.tsx`.
- A visual/styling change seems necessary to reduce complexity.
- Any public export or data attribute would need to change.

## Maintenance Notes

This component is shared infrastructure. Reviewers should compare the before/after JSX structure, class strings, and data attributes carefully. The goal is to reduce complexity without changing sidebar behavior.
