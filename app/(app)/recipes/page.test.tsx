import assert from "node:assert/strict";
import * as React from "react";
import { renderToReadableStream } from "react-dom/server";
import { describe, it, vi } from "vitest";
import type { Recipe } from "@/lib/types";

const recipesState = vi.hoisted(() => ({
	recipes: [] as Recipe[],
}));

vi.mock("react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react")>();
	return {
		...actual,
		Suspense: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	};
});

vi.mock("@/app/actions/mixup", () => ({
	fetchRecipes: vi.fn(async () => recipesState.recipes),
}));

vi.mock("next/link", () => ({
	default: ({
		href,
		children,
	}: {
		href: string;
		children: React.ReactNode;
	}) => <a href={href}>{children}</a>,
}));

vi.mock("@/components/common/page-template", () => ({
	PageTemplate: ({
		title,
		subtitle,
		children,
	}: {
		title: string;
		subtitle: string;
		children: React.ReactNode;
	}) => (
		<div>
			<h1>{title}</h1>
			<p>{subtitle}</p>
			{children}
		</div>
	),
}));

vi.mock("@/components/ui/badge", () => ({
	Badge: ({ children }: { children: React.ReactNode }) => (
		<span>{children}</span>
	),
}));

vi.mock("@/components/ui/skeleton", () => ({
	Skeleton: () => <div>skeleton</div>,
}));

type RecipesPageModule = typeof import("./page.tsx");
let moduleCache: RecipesPageModule | null = null;

async function getPage() {
	if (!moduleCache) {
		moduleCache = await import("./page.tsx");
	}
	return moduleCache.default;
}

async function renderAsync(element: React.ReactElement) {
	const stream = await renderToReadableStream(element);
	await stream.allReady;
	return (await new Response(stream).text()).replaceAll("<!-- -->", "");
}

describe("Recipes page", () => {
	it("groups recipes by category and renders recipe cards", async () => {
		recipesState.recipes = [
			{
				id: "recipe-1",
				slug: "calendar",
				name: "Calendar",
				description: "Family schedule",
				type: "liquid",
				repo: null,
				screenshot_url: null,
				logo_url: null,
				author: null,
				author_github: null,
				author_email: null,
				zip_url: null,
				zip_entry_path: null,
				category: "family,home",
				version: "2",
				user_id: null,
				created_at: null,
				updated_at: "2026-06-13T00:00:00.000Z",
			},
			{
				id: "recipe-2",
				slug: "weather",
				name: "Weather",
				description: null,
				type: "react",
				repo: null,
				screenshot_url: null,
				logo_url: null,
				author: null,
				author_github: null,
				author_email: null,
				zip_url: null,
				zip_entry_path: null,
				category: null,
				version: null,
				user_id: null,
				created_at: null,
				updated_at: null,
			},
		];

		const RecipesPage = await getPage();
		const html = await renderAsync(<RecipesPage />);

		assert.match(html, /Recipes/);
		assert.match(html, /family/);
		assert.match(html, /uncategorized/);
		assert.match(html, /Calendar/);
		assert.match(html, /Weather/);
		assert.match(html, /\/recipes\/calendar/);
		assert.match(html, /\/api\/bitmap\/calendar\.bmp\?grayscale=16/);
	});

	it("renders cards without optional metadata and keeps categories sorted", async () => {
		recipesState.recipes = [
			{
				id: "recipe-1",
				slug: "zeta",
				name: "Zeta",
				description: null,
				type: "react",
				repo: null,
				screenshot_url: null,
				logo_url: null,
				author: null,
				author_github: null,
				author_email: null,
				zip_url: null,
				zip_entry_path: null,
				category: "z-last",
				version: null,
				user_id: null,
				created_at: null,
				updated_at: null,
			},
			{
				id: "recipe-2",
				slug: "alpha",
				name: "Alpha",
				description: "Has copy",
				type: "liquid",
				repo: null,
				screenshot_url: null,
				logo_url: null,
				author: null,
				author_github: null,
				author_email: null,
				zip_url: null,
				zip_entry_path: null,
				category: "a-first",
				version: "9",
				user_id: null,
				created_at: null,
				updated_at: "2026-06-13T00:00:00.000Z",
			},
			{
				id: "recipe-3",
				slug: "plain",
				name: "Plain",
				description: null,
				type: "react",
				repo: null,
				screenshot_url: null,
				logo_url: null,
				author: null,
				author_github: null,
				author_email: null,
				zip_url: null,
				zip_entry_path: null,
				category: null,
				version: null,
				user_id: null,
				created_at: null,
				updated_at: null,
			},
		];

		const RecipesPage = await getPage();
		const html = await renderAsync(<RecipesPage />);

		assert.ok(html.indexOf("a first") < html.indexOf("z last"));
		assert.match(html, /v9/);
		assert.match(html, /Has copy/);
		assert.match(html, /—/);
	});
});
