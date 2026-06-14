// @vitest-environment jsdom

import assert from "node:assert/strict";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogEntry, TrmnlRecipe } from "@/lib/catalog";

const toastState = vi.hoisted(() => ({
	success: vi.fn(),
	error: vi.fn(),
}));

const actionState = vi.hoisted(() => ({
	installCommunityRecipe: vi.fn(),
	loadOfficialRecipesPage: vi.fn(),
}));

const observerState = vi.hoisted(() => ({
	instances: [] as MockIntersectionObserver[],
}));

class MockIntersectionObserver {
	callback: IntersectionObserverCallback;

	constructor(callback: IntersectionObserverCallback) {
		this.callback = callback;
		observerState.instances.push(this);
	}

	disconnect() {}

	observe() {}

	unobserve() {}

	trigger(isIntersecting = true) {
		this.callback(
			[
				{
					isIntersecting,
				} as IntersectionObserverEntry,
			],
			this as unknown as IntersectionObserver,
		);
	}
}

vi.mock("next/image", () => ({
	default: ({ src, alt }: { src: string; alt?: string }) => (
		<div data-alt={alt ?? ""} data-src={src} />
	),
}));

vi.mock("sonner", () => ({
	toast: toastState,
}));

vi.mock("@/app/actions/catalog", () => ({
	installCommunityRecipe: actionState.installCommunityRecipe,
	loadOfficialRecipesPage: actionState.loadOfficialRecipesPage,
}));

vi.mock("@/components/common/page-template", () => ({
	PageTemplate: ({
		title,
		subtitle,
		children,
	}: {
		title: React.ReactNode;
		subtitle: React.ReactNode;
		children: React.ReactNode;
	}) => (
		<div>
			<h1>{title}</h1>
			<div>{subtitle}</div>
			{children}
		</div>
	),
}));

vi.mock("@/components/ui/alert", () => ({
	Alert: ({ children }: { children?: React.ReactNode }) => (
		<div>{children}</div>
	),
	AlertDescription: ({ children }: { children?: React.ReactNode }) => (
		<div>{children}</div>
	),
	AlertTitle: ({ children }: { children?: React.ReactNode }) => (
		<strong>{children}</strong>
	),
}));

vi.mock("@/components/ui/badge", () => ({
	Badge: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
		<span {...props}>{children}</span>
	),
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({
		children,
		...props
	}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button {...props} type={props.type ?? "button"}>
			{children}
		</button>
	),
}));

vi.mock("@/components/ui/input", () => ({
	Input: ({
		onChange,
		...props
	}: React.InputHTMLAttributes<HTMLInputElement>) => (
		<input {...props} onChange={onChange} />
	),
}));

vi.mock("@/components/ui/tabs", () => ({
	Tabs: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
		<div {...props}>{children}</div>
	),
	TabsContent: ({
		children,
		...props
	}: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
	TabsList: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
		<div {...props}>{children}</div>
	),
	TabsTrigger: ({
		children,
		...props
	}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button {...props} type="button">
			{children}
		</button>
	),
}));

import { CatalogPage } from "./catalog-grid";

let container: HTMLDivElement | null = null;
let root: Root | null = null;

async function render(element: React.ReactElement) {
	if (!container) {
		container = document.createElement("div");
		document.body.append(container);
		root = createRoot(container);
	}

	await act(async () => {
		root?.render(element);
	});

	return container;
}

async function flushAsyncWork() {
	await act(async () => {
		await Promise.resolve();
		await Promise.resolve();
	});
}

function getButton(text: string) {
	return Array.from(container?.querySelectorAll("button") ?? []).find(
		(button) => button.textContent?.replace(/\s+/g, " ").trim() === text,
	);
}

function getButtons(text: string) {
	return Array.from(container?.querySelectorAll("button") ?? []).filter(
		(button) => button.textContent?.replace(/\s+/g, " ").trim() === text,
	);
}

function getInput(placeholder: string) {
	return container?.querySelector(
		`input[placeholder="${placeholder}"]`,
	) as HTMLInputElement | null;
}

function buildCommunityEntry(
	overrides: Partial<CatalogEntry> = {},
): CatalogEntry {
	return {
		name: "Weather board",
		trmnlp: {
			id: 1,
			repo: "https://example.com/repo",
			zip_url: "https://example.com/plugin.zip",
			zip_entry_path: null,
			version: "1.0.0",
		},
		logo_url: null,
		screenshot_url: null,
		license: "MIT",
		byos: {},
		author: { github: "dev" },
		funding: {},
		author_bio: {
			description: "Compact weather card",
			category: "utility",
		},
		...overrides,
	};
}

function buildOfficialRecipe(
	overrides: Partial<TrmnlRecipe> = {},
): TrmnlRecipe {
	return {
		id: 10,
		name: "Official weather",
		published_at: "2024-01-01T00:00:00.000Z",
		icon_url: null,
		screenshot_url: null,
		author_bio: {
			name: "TRMNL Team",
			description: "Weather overview",
			category: "utility",
		},
		stats: {
			installs: 2,
			forks: 1,
		},
		...overrides,
	};
}

beforeEach(() => {
	observerState.instances = [];
	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
	vi.stubGlobal(
		"IntersectionObserver",
		MockIntersectionObserver as unknown as typeof IntersectionObserver,
	);
});

afterEach(async () => {
	vi.clearAllMocks();
	vi.unstubAllGlobals();
	observerState.instances = [];

	if (root) {
		await act(async () => {
			root?.unmount();
		});
	}

	container?.remove();
	container = null;
	root = null;
});

describe("Catalog grid extra coverage", () => {
	it("renders fallback cards and the disabled external-catalog hint", async () => {
		const mounted = await render(
			<CatalogPage
				communityEntries={[
					buildCommunityEntry({
						trmnlp: { ...buildCommunityEntry().trmnlp, zip_url: null },
					}),
				]}
				communityError={null}
				externalCatalogEnabled={false}
				officialEntries={[buildOfficialRecipe()]}
				officialError={null}
				officialNextPage={null}
				officialTotal={1}
			/>,
		);

		assert.match(mounted.textContent ?? "", /ENABLE_EXTERNAL_CATALOG=true/);
		assert.match(mounted.textContent ?? "", /Weather board/);
		assert.match(mounted.textContent ?? "", /Compact weather card/);
		assert.match(mounted.textContent ?? "", /by dev/);
		assert.match(mounted.textContent ?? "", /BYOS N\/A/);
		assert.match(mounted.textContent ?? "", /MIT/);
		assert.match(mounted.textContent ?? "", /Utility/);
		assert.match(mounted.textContent ?? "", /2 installs/);
		assert.match(mounted.textContent ?? "", /1 fork/);
		assert.match(mounted.textContent ?? "", /TRMNL Team/);
		expect(mounted.querySelectorAll("[data-src]")).toHaveLength(0);
	});

	it("filters community cards by BYOS compatibility and search text", async () => {
		const mounted = await render(
			<CatalogPage
				communityEntries={[
					buildCommunityEntry({
						name: "Weather board",
						byos: {
							byos_laravel: {
								compatibility: true,
								compatibility_note: null,
								min_version: "1.0",
							},
						},
					}),
					buildCommunityEntry({
						name: "Notes board",
						trmnlp: {
							...buildCommunityEntry().trmnlp,
							id: 2,
							zip_url: null,
						},
						byos: {},
						author_bio: {
							description: "Quick notes",
							category: "productivity",
						},
					}),
				]}
				communityError={null}
				externalCatalogEnabled={true}
				officialEntries={[]}
				officialError={null}
				officialNextPage={null}
				officialTotal={null}
			/>,
		);

		await act(async () => {
			getButton("BYOS compatible only")?.click();
		});

		expect(mounted.textContent).toContain("Weather board");
		expect(mounted.textContent).not.toContain("Notes board");

		await act(async () => {
			const input = getInput("Search community plugins...");
			if (!input) {
				throw new Error("missing community search input");
			}
			const valueSetter = Object.getOwnPropertyDescriptor(
				HTMLInputElement.prototype,
				"value",
			)?.set;
			valueSetter?.call(input, "no-match");
			input.dispatchEvent(new InputEvent("input", { bubbles: true }));
		});

		expect(mounted.textContent).toContain("No plugins found");
		expect(mounted.textContent).toContain(
			"No community plugins match your current filters.",
		);
	});

	it("installs a community recipe through the install button", async () => {
		actionState.installCommunityRecipe.mockResolvedValue({ success: true });

		await render(
			<CatalogPage
				communityEntries={[buildCommunityEntry()]}
				communityError={null}
				externalCatalogEnabled={true}
				officialEntries={[]}
				officialError={null}
				officialNextPage={null}
				officialTotal={null}
			/>,
		);

		await act(async () => {
			getButton("Install")?.click();
		});
		await flushAsyncWork();

		assert.equal(
			actionState.installCommunityRecipe.mock.calls[0]?.[0].name,
			"Weather board",
		);
		assert.equal(
			toastState.success.mock.calls[0]?.[0],
			'"Weather board" installed successfully',
		);
	});

	it("shows an install error when the action fails", async () => {
		actionState.installCommunityRecipe.mockResolvedValue({
			success: false,
			error: "zip missing",
		});

		await render(
			<CatalogPage
				communityEntries={[buildCommunityEntry()]}
				communityError={null}
				externalCatalogEnabled={true}
				officialEntries={[]}
				officialError={null}
				officialNextPage={null}
				officialTotal={null}
			/>,
		);

		await act(async () => {
			getButton("Install")?.click();
		});
		await flushAsyncWork();

		assert.equal(toastState.error.mock.calls[0]?.[0], "zip missing");
	});

	it("loads all remaining official pages and deduplicates results", async () => {
		actionState.loadOfficialRecipesPage
			.mockResolvedValueOnce({
				recipes: [
					buildOfficialRecipe({ id: 10, name: "Official weather" }),
					buildOfficialRecipe({ id: 11, name: "Page two" }),
				],
				currentPage: 2,
				nextPage: 3,
				total: 3,
				error: null,
			})
			.mockResolvedValueOnce({
				recipes: [buildOfficialRecipe({ id: 12, name: "Page three" })],
				currentPage: 3,
				nextPage: null,
				total: 3,
				error: null,
			});

		const mounted = await render(
			<CatalogPage
				communityEntries={[]}
				communityError={null}
				externalCatalogEnabled={true}
				officialEntries={[buildOfficialRecipe()]}
				officialError={null}
				officialNextPage={2}
				officialTotal={3}
			/>,
		);

		await act(async () => {
			getButtons("Load all")[0]?.click();
		});
		await flushAsyncWork();

		expect(actionState.loadOfficialRecipesPage.mock.calls).toEqual([[2], [3]]);
		expect(mounted.textContent).toContain("Page two");
		expect(mounted.textContent).toContain("Page three");
		expect(mounted.textContent).toContain("3 / 3 loaded");
	});

	it("retries the official source when the retry button is clicked", async () => {
		actionState.loadOfficialRecipesPage.mockResolvedValue({
			recipes: [],
			currentPage: 1,
			nextPage: null,
			total: null,
			error: null,
		});

		await render(
			<CatalogPage
				communityEntries={[]}
				communityError={null}
				externalCatalogEnabled={true}
				officialEntries={[]}
				officialError="TRMNL is unavailable"
				officialNextPage={null}
				officialTotal={null}
			/>,
		);

		await act(async () => {
			getButton("Try TRMNL again")?.click();
		});
		await flushAsyncWork();

		expect(actionState.loadOfficialRecipesPage.mock.calls[0]).toEqual([1]);
	});

	it("surfaces official source errors when loading all pages fails", async () => {
		actionState.loadOfficialRecipesPage.mockResolvedValue({
			recipes: [],
			currentPage: 2,
			nextPage: null,
			total: 2,
			error: "page fetch failed",
		});

		await render(
			<CatalogPage
				communityEntries={[]}
				communityError={null}
				externalCatalogEnabled={true}
				officialEntries={[buildOfficialRecipe()]}
				officialError={null}
				officialNextPage={2}
				officialTotal={2}
			/>,
		);

		await act(async () => {
			getButtons("Load all")[0]?.click();
		});
		await flushAsyncWork();

		expect(toastState.error.mock.calls[0]).toEqual([
			"TRMNL catalog is unavailable",
			{ description: "page fetch failed" },
		]);
	});

	it("autoloads hidden items first, then fetches the next remote page", async () => {
		actionState.loadOfficialRecipesPage.mockResolvedValue({
			recipes: [buildOfficialRecipe({ id: 99, name: "Fetched remotely" })],
			currentPage: 2,
			nextPage: null,
			total: 12,
			error: null,
		});

		const mounted = await render(
			<CatalogPage
				communityEntries={[]}
				communityError={null}
				externalCatalogEnabled={true}
				officialEntries={Array.from({ length: 11 }, (_, index) =>
					buildOfficialRecipe({
						id: index + 1,
						name: `Official ${index + 1}`,
					}),
				)}
				officialError={null}
				officialNextPage={2}
				officialTotal={12}
			/>,
		);

		expect(mounted.textContent).not.toContain("Official 11");

		await act(async () => {
			observerState.instances.at(-1)?.trigger(true);
		});

		expect(actionState.loadOfficialRecipesPage).not.toHaveBeenCalled();
		expect(mounted.textContent).toContain("Official 11");

		await act(async () => {
			observerState.instances.at(-1)?.trigger(true);
		});
		await flushAsyncWork();

		expect(actionState.loadOfficialRecipesPage.mock.calls[0]).toEqual([2]);
		expect(mounted.textContent).toContain("Fetched remotely");
	});
});
