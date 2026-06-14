import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	getCurrentUserId: vi.fn(),
	parsePreviewSize: vi.fn(),
	renderRecipeToImage: vi.fn(),
	resolveRenderableRef: vi.fn(),
}));

vi.mock("@/lib/auth/get-user", () => ({
	getCurrentUserId: state.getCurrentUserId,
}));

vi.mock("@/lib/recipes/recipe-renderer", () => ({
	renderRecipeToImage: state.renderRecipeToImage,
}));

vi.mock("@/lib/screens/render-target", () => ({
	resolveRenderableRef: state.resolveRenderableRef,
}));

vi.mock("../../../bitmap/render-utils", async () => {
	const actual = await vi.importActual<
		typeof import("../../../bitmap/render-utils")
	>("../../../bitmap/render-utils");
	return {
		...actual,
		parsePreviewSize: state.parsePreviewSize,
	};
});

const loadRoute = () => import("./route");

describe("app/api/png/[type]/[id] GET", () => {
	beforeEach(() => {
		vi.resetModules();
		state.getCurrentUserId.mockReset();
		state.parsePreviewSize.mockReset();
		state.renderRecipeToImage.mockReset();
		state.resolveRenderableRef.mockReset();
		state.getCurrentUserId.mockResolvedValue("user-1");
		state.parsePreviewSize.mockReturnValue({ width: 320, height: 240 });
		state.resolveRenderableRef.mockResolvedValue({
			recipeSlug: "weather",
			params: { city: "Warsaw" },
		});
		state.renderRecipeToImage.mockResolvedValue({
			png: Buffer.from("png-bytes"),
		});
	});

	it("rejects unsupported preview types", async () => {
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/png/device/1") as never,
			{ params: Promise.resolve({ type: "device", id: "1" }) },
		);

		expect(response.status).toBe(400);
		await expect(response.text()).resolves.toBe("Unsupported preview type");
		expect(state.resolveRenderableRef).not.toHaveBeenCalled();
	});

	it("returns 404 when the render target cannot be resolved", async () => {
		state.resolveRenderableRef.mockResolvedValue(null);
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/png/screen/screen-1") as never,
			{ params: Promise.resolve({ type: "screen", id: "screen-1" }) },
		);

		expect(response.status).toBe(404);
		await expect(response.text()).resolves.toBe("Not found");
		expect(state.resolveRenderableRef).toHaveBeenCalledWith({
			type: "screen",
			id: "screen-1",
			userId: "user-1",
		});
	});

	it("returns 500 when rendering does not produce a PNG", async () => {
		state.renderRecipeToImage.mockResolvedValue({});
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/png/recipe/weather", {
				headers: { host: "example.test", "x-forwarded-proto": "https" },
			}) as never,
			{ params: Promise.resolve({ type: "recipe", id: "weather" }) },
		);

		expect(response.status).toBe(500);
		await expect(response.text()).resolves.toBe("Failed to render");
	});

	it("renders a PNG response for resolved recipe targets", async () => {
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/png/recipe/weather", {
				headers: { host: "example.test", "x-forwarded-proto": "https" },
			}) as never,
			{ params: Promise.resolve({ type: "recipe", id: "weather" }) },
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("image/png");
		expect(response.headers.get("Content-Length")).toBe("9");
		expect(Buffer.from(await response.arrayBuffer())).toEqual(
			Buffer.from("png-bytes"),
		);
		expect(state.renderRecipeToImage).toHaveBeenCalledWith({
			slug: "weather",
			imageWidth: 320,
			imageHeight: 240,
			formats: ["png"],
			userId: "user-1",
			cookies: undefined,
			paramsOverride: { city: "Warsaw" },
			previewPath: undefined,
			previewBaseUrl: "https://example.test",
		});
	});

	it("renders default recipe PNGs from the recipe/default URL shape", async () => {
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/png/weather/default.png", {
				headers: {
					cookie: "session=abc",
					host: "example.test",
					"x-forwarded-proto": "https",
				},
			}) as never,
			{ params: Promise.resolve({ type: "weather", id: "default.png" }) },
		);

		expect(response.status).toBe(200);
		expect(state.resolveRenderableRef).toHaveBeenCalledWith({
			type: "recipe",
			id: "weather",
			userId: "user-1",
		});
		expect(state.renderRecipeToImage).toHaveBeenCalledWith(
			expect.objectContaining({
				cookies: "session=abc",
				paramsOverride: { city: "Warsaw" },
				previewPath: undefined,
				previewBaseUrl: "https://example.test",
			}),
		);
	});

	it("renders concrete screen PNGs from the recipe/screen URL shape", async () => {
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/png/weather/screen-1.png", {
				headers: { host: "example.test", "x-forwarded-proto": "https" },
			}) as never,
			{ params: Promise.resolve({ type: "weather", id: "screen-1.png" }) },
		);

		expect(response.status).toBe(200);
		expect(state.resolveRenderableRef).toHaveBeenCalledWith({
			type: "screen",
			id: "screen-1",
			userId: "user-1",
		});
		expect(state.renderRecipeToImage).toHaveBeenCalledWith(
			expect.objectContaining({
				previewPath: "/preview/screen/screen-1?raw=1",
				previewBaseUrl: "https://example.test",
			}),
		);
	});
});
