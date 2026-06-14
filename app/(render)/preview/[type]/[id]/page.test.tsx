import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	component: vi.fn((props: Record<string, unknown>) => (
		<pre data-testid="preview-component">{JSON.stringify(props)}</pre>
	)),
	config: { slug: "weather" } as unknown,
	currentUserId: "user-1" as string | null,
	props: { title: "Preview" },
	resolvedTarget: {
		recipeSlug: "weather",
		params: { city: "Warsaw" },
	} as { recipeSlug: string; params: Record<string, unknown> } | null,
	notFound: vi.fn(() => {
		throw new Error("NEXT_NOT_FOUND");
	}),
}));

vi.mock("next/navigation", () => ({
	notFound: state.notFound,
}));

vi.mock("@/lib/auth/get-user", () => ({
	getCurrentUserId: vi.fn(async () => state.currentUserId),
}));

vi.mock("@/lib/screens/render-target", () => ({
	resolveRenderableRef: vi.fn(async () => state.resolvedTarget),
}));

vi.mock("@/lib/recipes/recipe-renderer", () => ({
	DEFAULT_IMAGE_HEIGHT: 480,
	DEFAULT_IMAGE_WIDTH: 800,
	addDimensionsToProps: vi.fn(
		(props: Record<string, unknown>, width: number, height: number) => ({
			...props,
			width,
			height,
		}),
	),
	fetchRecipeComponent: vi.fn(async () => state.component),
	fetchRecipeConfig: vi.fn(async () => state.config),
	fetchRecipeProps: vi.fn(async () => state.props),
}));

const loadPage = async () => {
	vi.resetModules();
	return (await import("./page")).default;
};

describe("render preview page", () => {
	beforeEach(() => {
		state.config = { slug: "weather" };
		state.currentUserId = "user-1";
		state.props = { title: "Preview" };
		state.resolvedTarget = {
			recipeSlug: "weather",
			params: { city: "Warsaw" },
		};
		state.component.mockClear();
		state.notFound.mockClear();
	});

	it("renders a resolved recipe preview with query dimensions", async () => {
		const RenderPreviewPage = await loadPage();

		const html = renderToStaticMarkup(
			await RenderPreviewPage({
				params: Promise.resolve({ type: "recipe", id: "weather" }),
				searchParams: Promise.resolve({ width: "320", height: "240" }),
			}),
		);

		assert.match(html, /Preview/);
		assert.match(html, /&quot;width&quot;:320/);
		assert.match(html, /&quot;height&quot;:240/);
		assert.match(html, /overflow:\s*hidden/);
	});

	it("uses default dimensions and scroll mode when requested", async () => {
		const RenderPreviewPage = await loadPage();

		const html = renderToStaticMarkup(
			await RenderPreviewPage({
				params: Promise.resolve({ type: "screen", id: "screen-1" }),
				searchParams: Promise.resolve({ mode: "scroll" }),
			}),
		);

		assert.match(html, /&quot;width&quot;:800/);
		assert.match(html, /&quot;height&quot;:480/);
		assert.match(html, /overflow:\s*auto/);
	});

	it("disables doubling for school schedule previews", async () => {
		state.resolvedTarget = {
			recipeSlug: "school-schedule",
			params: {},
		};
		const RenderPreviewPage = await loadPage();

		const html = renderToStaticMarkup(
			await RenderPreviewPage({
				params: Promise.resolve({ type: "recipe", id: "school" }),
				searchParams: Promise.resolve({}),
			}),
		);

		assert.match(html, /&quot;disableDoubling&quot;:true/);
	});

	it("throws notFound for unsupported target types", async () => {
		const RenderPreviewPage = await loadPage();

		await assert.rejects(
			() =>
				RenderPreviewPage({
					params: Promise.resolve({ type: "device", id: "1" }),
					searchParams: Promise.resolve({}),
				}),
			/NEXT_NOT_FOUND/,
		);
	});

	it("throws notFound when the target, config, or component is missing", async () => {
		const RenderPreviewPage = await loadPage();
		state.resolvedTarget = null;
		await assert.rejects(
			() =>
				RenderPreviewPage({
					params: Promise.resolve({ type: "recipe", id: "missing" }),
					searchParams: Promise.resolve({}),
				}),
			/NEXT_NOT_FOUND/,
		);

		state.resolvedTarget = { recipeSlug: "weather", params: {} };
		state.config = null;
		await assert.rejects(
			() =>
				RenderPreviewPage({
					params: Promise.resolve({ type: "recipe", id: "missing" }),
					searchParams: Promise.resolve({}),
				}),
			/NEXT_NOT_FOUND/,
		);
	});
});
