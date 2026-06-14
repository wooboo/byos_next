import assert from "node:assert/strict";
import type React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	component: vi.fn((props: Record<string, unknown>) => (
		<pre>{JSON.stringify(props)}</pre>
	)) as ((props: Record<string, unknown>) => React.ReactNode) | null,
	config: { slug: "weather" } as unknown,
	headers: vi.fn(),
	props: { title: "Weather" },
	notFound: vi.fn(() => {
		throw new Error("NEXT_NOT_FOUND");
	}),
}));

vi.mock("next/headers", () => ({
	headers: state.headers,
}));

vi.mock("next/navigation", () => ({
	notFound: state.notFound,
}));

vi.mock("@/lib/recipes/recipe-renderer", () => ({
	fetchRecipeComponent: vi.fn(async () => state.component),
	fetchRecipeConfig: vi.fn(async () => state.config),
	fetchRecipeProps: vi.fn(async () => state.props),
}));

const loadPage = async () => {
	vi.resetModules();
	return (await import("./page")).default;
};

describe("recipe render preview page", () => {
	beforeEach(() => {
		state.component = vi.fn((props: Record<string, unknown>) => (
			<pre>{JSON.stringify(props)}</pre>
		));
		state.config = { slug: "weather" };
		state.headers.mockClear();
		state.notFound.mockClear();
		state.props = { title: "Weather" };
	});

	it("renders recipe props with valid width and height query params", async () => {
		const RecipePreviewPage = await loadPage();

		const html = renderToStaticMarkup(
			await RecipePreviewPage({
				params: Promise.resolve({ slug: "weather" }),
				searchParams: Promise.resolve({ width: "320", height: "240" }),
			}),
		);

		assert.match(html, /Weather/);
		assert.match(html, /&quot;width&quot;:320/);
		assert.match(html, /&quot;height&quot;:240/);
		assert.equal(state.headers.mock.calls.length, 1);
	});

	it("ignores invalid dimensions instead of passing NaN", async () => {
		const RecipePreviewPage = await loadPage();

		const html = renderToStaticMarkup(
			await RecipePreviewPage({
				params: Promise.resolve({ slug: "weather" }),
				searchParams: Promise.resolve({ width: "wide", height: "tall" }),
			}),
		);

		assert.doesNotMatch(html, /width/);
		assert.doesNotMatch(html, /height/);
	});

	it("throws notFound when config or component is missing", async () => {
		const RecipePreviewPage = await loadPage();

		state.config = null;
		await assert.rejects(
			() =>
				RecipePreviewPage({
					params: Promise.resolve({ slug: "missing" }),
					searchParams: Promise.resolve({}),
				}),
			/NEXT_NOT_FOUND/,
		);

		state.config = { slug: "weather" };
		state.component = null;
		await assert.rejects(
			() =>
				RecipePreviewPage({
					params: Promise.resolve({ slug: "missing" }),
					searchParams: Promise.resolve({}),
				}),
			/NEXT_NOT_FOUND/,
		);
	});
});
