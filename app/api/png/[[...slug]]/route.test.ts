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
	getCurrentUserId: vi.fn(),
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

vi.mock("@/lib/auth/get-user", () => ({
	getCurrentUserId: state.getCurrentUserId,
}));

const loadRoute = () => import("./route");

describe("app/api/png/[[...slug]] GET", () => {
	beforeEach(() => {
		vi.resetModules();
		state.logger.error.mockReset();
		state.logger.info.mockReset();
		state.logger.warn.mockReset();
		state.renderRecipeOutputs.mockReset();
		state.renderRecipeToImage.mockReset();
		state.resolveRenderableRef.mockReset();
		state.getCurrentUserId.mockReset();
		state.getCurrentUserId.mockResolvedValue("user-1");
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("renders a PNG response using the resolved recipe target", async () => {
		const png = Buffer.from([1, 2, 3, 4]);
		state.resolveRenderableRef.mockResolvedValue({
			recipeSlug: "resolved-recipe",
			params: { mode: "compact" },
		});
		state.renderRecipeToImage.mockResolvedValue({
			png,
		});
		const { GET } = await loadRoute();

		const response = await GET(
			new Request(
				"https://example.test/api/png/sample/default.png?width=320&height=240",
				{
					headers: {
						cookie: "session=abc",
					},
				},
			) as never,
			{ params: Promise.resolve({ slug: ["sample", "default.png"] }) },
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("image/png");
		expect(response.headers.get("Content-Length")).toBe("4");
		expect(Buffer.from(await response.arrayBuffer())).toEqual(png);
		expect(state.resolveRenderableRef).toHaveBeenCalledWith({
			type: "recipe",
			id: "sample",
			userId: "user-1",
		});
		expect(state.renderRecipeToImage).toHaveBeenCalledWith({
			slug: "resolved-recipe",
			imageWidth: 320,
			imageHeight: 240,
			formats: ["png"],
			userId: "user-1",
			cookies: "session=abc",
			paramsOverride: { mode: "compact" },
			previewPath: undefined,
		});
	});

	it("renders a PNG response using a concrete screen id under the recipe path", async () => {
		const png = Buffer.from([5, 6]);
		state.resolveRenderableRef.mockResolvedValue({
			recipeSlug: "resolved-recipe",
			params: { mode: "screen" },
		});
		state.renderRecipeToImage.mockResolvedValue({ png });
		const { GET } = await loadRoute();

		const response = await GET(
			new Request(
				"https://example.test/api/png/sample/screen-1.png?width=320&height=240",
			) as never,
			{ params: Promise.resolve({ slug: ["sample", "screen-1.png"] }) },
		);

		expect(response.status).toBe(200);
		expect(state.resolveRenderableRef).toHaveBeenCalledWith({
			type: "screen",
			id: "screen-1",
			userId: "user-1",
		});
		expect(state.renderRecipeToImage).toHaveBeenCalledWith(
			expect.objectContaining({
				slug: "resolved-recipe",
				paramsOverride: { mode: "screen" },
				previewPath: "/preview/screen/screen-1?raw=1",
			}),
		);
	});

	it("falls back to the not-found PNG when the recipe render is empty", async () => {
		const fallback = Buffer.from([9, 9]);
		state.resolveRenderableRef.mockResolvedValue(null);
		state.renderRecipeToImage.mockResolvedValue({
			png: Buffer.from([]),
		});
		state.renderRecipeOutputs.mockResolvedValue({
			png: fallback,
		});
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/png/missing.png") as never,
			{ params: Promise.resolve({ slug: ["missing.png"] }) },
		);

		expect(response.status).toBe(200);
		expect(Buffer.from(await response.arrayBuffer())).toEqual(fallback);
		expect(state.logger.warn).toHaveBeenCalledWith(
			"Failed to generate PNG for missing.png, returning fallback",
		);
		expect(state.renderRecipeOutputs).toHaveBeenCalledWith(
			expect.objectContaining({
				slug: "not-found",
				formats: ["png"],
			}),
		);
	});
});
