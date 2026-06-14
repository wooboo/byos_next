import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";
import type { CatalogEntry, TrmnlRecipe } from "@/lib/catalog";

vi.mock("next/image", () => ({
	default: ({
		src,
		alt,
		...props
	}: {
		src: string;
		alt?: string;
		[key: string]: unknown;
	}) => (
		<div
			data-testid="next-image"
			data-src={String(src)}
			data-alt={alt ?? ""}
			{...props}
		/>
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
		<button {...props}>{children}</button>
	),
}));

vi.mock("@/components/ui/input", () => ({
	Input: ({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
		<input {...props} />
	),
}));

vi.mock("@/components/ui/tabs", () => ({
	Tabs: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	TabsContent: ({ children }: { children?: React.ReactNode }) => (
		<div>{children}</div>
	),
	TabsList: ({ children }: { children?: React.ReactNode }) => (
		<div>{children}</div>
	),
	TabsTrigger: ({ children }: { children?: React.ReactNode }) => (
		<button type="button">{children}</button>
	),
}));

type CatalogGridModule = typeof import("./catalog-grid.tsx");
let moduleCache: CatalogGridModule | null = null;

async function getCatalogGrid() {
	if (!moduleCache) {
		moduleCache = await import("./catalog-grid.tsx");
	}
	return moduleCache.CatalogPage;
}

function communityEntry(overrides: Partial<CatalogEntry>): CatalogEntry {
	return {
		name: "Community plugin",
		trmnlp: {
			id: 1,
			repo: "https://github.com/example/repo",
			zip_url: "https://example.com/plugin.zip",
			zip_entry_path: null,
			version: "1.0",
		},
		logo_url: null,
		screenshot_url: null,
		license: "MIT",
		byos: {
			byos_laravel: {
				compatibility: true,
				compatibility_note: null,
				min_version: "1.0",
			},
		},
		author: { github: "dev" },
		funding: {},
		author_bio: {
			description: "Small helper",
			category: "utility",
		},
		...overrides,
	};
}

function trmnlRecipe(overrides: Partial<TrmnlRecipe>): TrmnlRecipe {
	return {
		id: 10,
		name: "Trmnl recipe",
		published_at: new Date().toISOString(),
		icon_url: null,
		screenshot_url: null,
		author_bio: {
			name: "Team",
			description: "desc",
			category: "utility",
		},
		stats: {
			installs: 8,
			forks: 1,
		},
		...overrides,
	};
}

describe("Catalog grid", () => {
	it("renders official and community empty states", async () => {
		const CatalogPage = await getCatalogGrid();

		const html = renderToStaticMarkup(
			<CatalogPage
				communityEntries={[]}
				communityError={null}
				externalCatalogEnabled={true}
				officialEntries={[]}
				officialError={null}
				officialNextPage={null}
				officialTotal={null}
			/>,
		);

		assert.match(
			html,
			/No recipes match your search\.|No official recipes match your search/,
		);
		assert.match(html, /No plugins found/);
	});

	it("renders community entries and install controls", async () => {
		const CatalogPage = await getCatalogGrid();

		const html = renderToStaticMarkup(
			<CatalogPage
				communityEntries={[
					communityEntry({
						name: "Weather mini",
						trmnlp: {
							...communityEntry({}).trmnlp,
							id: 2,
							zip_url: "https://example.com/weather.zip",
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

		assert.match(html, /Weather mini/);
		assert.match(html, /Install/);
		assert.match(html, /BYOS/);
	});

	it("renders official loading state when more pages are available", async () => {
		const CatalogPage = await getCatalogGrid();

		const html = renderToStaticMarkup(
			<CatalogPage
				communityEntries={[]}
				communityError={null}
				externalCatalogEnabled={true}
				officialEntries={Array.from({ length: 11 }, (_, index) =>
					trmnlRecipe({
						id: 100 + index,
						name: `Official ${index + 1}`,
					}),
				)}
				officialError={null}
				officialNextPage={2}
				officialTotal={11}
			/>,
		);

		assert.match(html, /More items load as you scroll/);
		assert.match(html, /11 \/ 11 loaded/);
		assert.match(html, /Official 1/);
	});

	it("shows official error fallback with retry option", async () => {
		const CatalogPage = await getCatalogGrid();

		const html = renderToStaticMarkup(
			<CatalogPage
				communityEntries={[]}
				communityError={null}
				externalCatalogEnabled={true}
				officialEntries={[]}
				officialError="TRMNL temporary outage"
				officialNextPage={null}
				officialTotal={null}
			/>,
		);

		assert.match(html, /TRMNL is unreachable/);
		assert.match(html, /Try TRMNL again/);
	});
});
