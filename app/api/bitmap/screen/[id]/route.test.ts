import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	getCurrentUserId: vi.fn(),
	renderRecipeOutputs: vi.fn(),
	renderRecipeToImage: vi.fn(),
	resolveRenderableRef: vi.fn(),
	resolveUserIdFromApiKey: vi.fn(),
}));

vi.mock("@/lib/auth/get-user", () => ({
	getCurrentUserId: state.getCurrentUserId,
}));

vi.mock("@/lib/recipes/recipe-renderer", () => ({
	DEFAULT_IMAGE_HEIGHT: 800,
	DEFAULT_IMAGE_WIDTH: 480,
	logger: { error: vi.fn() },
	renderRecipeOutputs: state.renderRecipeOutputs,
	renderRecipeToImage: state.renderRecipeToImage,
}));

vi.mock("@/lib/screens/render-target", () => ({
	resolveRenderableRef: state.resolveRenderableRef,
}));

vi.mock("../../../display/utils", async () => {
	const actual = await vi.importActual<typeof import("../../../display/utils")>(
		"../../../display/utils",
	);
	return {
		...actual,
		parseRequestHeaders: vi.fn((request: Request) => ({
			apiKey: request.headers.get("Access-Token"),
		})),
		resolveUserIdFromApiKey: state.resolveUserIdFromApiKey,
	};
});

const loadRoute = () => import("./route");

describe("app/api/bitmap/screen/[id] GET", () => {
	beforeEach(() => {
		vi.resetModules();
		state.getCurrentUserId.mockReset();
		state.renderRecipeOutputs.mockReset();
		state.renderRecipeToImage.mockReset();
		state.resolveRenderableRef.mockReset();
		state.resolveUserIdFromApiKey.mockReset();
	});

	it("renders a bitmap for an API-key scoped screen request", async () => {
		state.resolveUserIdFromApiKey.mockResolvedValue("user-1");
		state.resolveRenderableRef.mockResolvedValue({
			recipeSlug: "clock",
			params: { tz: "UTC" },
		});
		state.renderRecipeToImage.mockResolvedValue({
			bitmap: Buffer.from("bmp-data"),
		});
		const { GET } = await loadRoute();

		const response = await GET(
			new Request(
				"https://example.test/api/bitmap/screen/screen-1.bmp?width=600&height=448&grayscale=4",
				{
					headers: { "Access-Token": "token-1" },
				},
			) as never,
			{ params: Promise.resolve({ id: "screen-1.bmp" }) },
		);

		expect(state.resolveUserIdFromApiKey).toHaveBeenCalledWith("token-1");
		expect(state.getCurrentUserId).not.toHaveBeenCalled();
		expect(state.renderRecipeToImage).toHaveBeenCalledWith(
			expect.objectContaining({
				slug: "clock",
				imageWidth: 600,
				imageHeight: 448,
				grayscale: 4,
				userId: "user-1",
				paramsOverride: { tz: "UTC" },
			}),
		);
		expect(response.headers.get("Content-Type")).toBe("image/bmp");
		expect(response.headers.get("Content-Length")).toBe("8");
	});

	it("falls back to the not-found bitmap when no screen target resolves", async () => {
		state.getCurrentUserId.mockResolvedValue("user-2");
		state.resolveRenderableRef.mockResolvedValue(null);
		state.renderRecipeOutputs.mockResolvedValue({
			bitmap: Buffer.from("fallback"),
		});
		const { GET } = await loadRoute();

		const response = await GET(
			new Request(
				"https://example.test/api/bitmap/screen/missing.bmp",
			) as never,
			{ params: Promise.resolve({ id: "missing.bmp" }) },
		);

		expect(state.renderRecipeOutputs).toHaveBeenCalledWith(
			expect.objectContaining({
				slug: "missing",
				props: { slug: "missing" },
				formats: ["bitmap"],
			}),
		);
		expect(response.headers.get("Content-Type")).toBe("image/bmp");
		expect(response.headers.get("Content-Length")).toBe("8");
	});
});
