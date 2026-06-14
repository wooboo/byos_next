import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	logger: {
		error: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
	},
	renderRecipeOutputs: vi.fn(),
	renderRecipeToImage: vi.fn(),
	resolveRenderableRef: vi.fn(),
}));

vi.mock("@/lib/recipes/recipe-renderer", () => ({
	DEFAULT_IMAGE_HEIGHT: 480,
	DEFAULT_IMAGE_WIDTH: 800,
	logger: state.logger,
	renderRecipeOutputs: state.renderRecipeOutputs,
	renderRecipeToImage: state.renderRecipeToImage,
}));

vi.mock("@/lib/screens/render-target", () => ({
	resolveRenderableRef: state.resolveRenderableRef,
}));

const loadRoute = () => import("./route");

describe("app/api/bitmap/[[...slug]] GET", () => {
	beforeEach(() => {
		vi.resetModules();
		state.logger.error.mockReset();
		state.logger.info.mockReset();
		state.logger.warn.mockReset();
		state.renderRecipeOutputs.mockReset();
		state.renderRecipeToImage.mockReset();
		state.resolveRenderableRef.mockReset();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("renders a bitmap response using the resolved recipe target", async () => {
		const bitmap = Buffer.from([1, 2, 3, 4]);
		state.resolveRenderableRef.mockResolvedValue({
			recipeSlug: "resolved-recipe",
			params: { mode: "compact" },
		});
		state.renderRecipeToImage.mockResolvedValue({
			bitmap,
		});
		const { GET } = await loadRoute();

		const response = await GET(
			new Request(
				"https://example.test/api/bitmap/sample.bmp?width=320&height=240&grayscale=4",
				{
					headers: {
						cookie: "session=abc",
					},
				},
			) as never,
			{ params: Promise.resolve({ slug: ["sample.bmp"] }) },
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("image/bmp");
		expect(response.headers.get("Content-Length")).toBe("4");
		expect(Buffer.from(await response.arrayBuffer())).toEqual(bitmap);
		expect(state.resolveRenderableRef).toHaveBeenCalledWith({
			type: "recipe",
			id: "sample",
			userId: null,
		});
		expect(state.renderRecipeToImage).toHaveBeenCalledWith({
			slug: "resolved-recipe",
			imageWidth: 320,
			imageHeight: 240,
			formats: ["bitmap"],
			grayscale: 4,
			userId: null,
			cookies: "session=abc",
			paramsOverride: { mode: "compact" },
		});
	});

	it("falls back to the not-found bitmap when the recipe render is empty", async () => {
		const fallback = Buffer.from([9, 9]);
		state.resolveRenderableRef.mockResolvedValue(null);
		state.renderRecipeToImage.mockResolvedValue({
			bitmap: Buffer.from([]),
		});
		state.renderRecipeOutputs.mockResolvedValue({
			bitmap: fallback,
		});
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/bitmap/missing.bmp") as never,
			{ params: Promise.resolve({ slug: ["missing.bmp"] }) },
		);

		expect(response.status).toBe(200);
		expect(Buffer.from(await response.arrayBuffer())).toEqual(fallback);
		expect(state.logger.warn).toHaveBeenCalledWith(
			"Failed to generate bitmap for missing, returning fallback",
		);
		expect(state.renderRecipeOutputs).toHaveBeenCalledWith(
			expect.objectContaining({
				slug: "not-found",
				formats: ["bitmap"],
				grayscale: 2,
			}),
		);
	});
});
