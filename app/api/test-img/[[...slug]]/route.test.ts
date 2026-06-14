import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	cacheLife: vi.fn(),
	imageArrayBuffer: vi.fn(),
	renderBmp: vi.fn(),
}));

vi.mock("next/cache", () => ({
	cacheLife: state.cacheLife,
}));

vi.mock("next/og", () => ({
	ImageResponse: class {
		arrayBuffer = state.imageArrayBuffer;
	},
}));

vi.mock("@/components/bitmap-font/bitmap-font.json", () => ({
	default: {},
}));

vi.mock("@/components/bitmap-font/bitmap-text", () => ({
	BitmapText: () => null,
}));

vi.mock("@/utils/render-bmp", () => ({
	DitheringMethod: {
		ATKINSON: "ATKINSON",
	},
	renderBmp: state.renderBmp,
}));

async function loadRoute(nodeEnv = "test") {
	vi.resetModules();
	vi.stubEnv("NODE_ENV", nodeEnv);
	return import("./route");
}

describe("app/api/test-img/[[...slug]] GET", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		state.cacheLife.mockReset();
		state.imageArrayBuffer.mockReset();
		state.renderBmp.mockReset();
		state.imageArrayBuffer.mockResolvedValue(Uint8Array.from([1, 2, 3]).buffer);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});

	it("returns a bitmap response with cache headers for generated images", async () => {
		vi.spyOn(Math, "random").mockReturnValue(0.9);
		state.renderBmp.mockResolvedValue(Buffer.from("bmp-data"));
		const { GET } = await loadRoute("test");

		const responsePromise = GET(
			new Request("https://example.test/api/test-img/clock"),
			{ params: Promise.resolve({ slug: ["clock"] }) },
		);
		await vi.advanceTimersByTimeAsync(2000);
		const response = await responsePromise;

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("image/bmp");
		expect(response.headers.get("X-Image-Source")).toBe("prod-cache");
		expect(response.headers.get("Cache-Control")).toBe("no-cache");
		expect(response.headers.get("Content-Length")).toBe("8");
		expect(Buffer.from(await response.arrayBuffer())).toEqual(
			Buffer.from("bmp-data"),
		);
		expect(state.cacheLife).toHaveBeenCalledWith({
			stale: 20,
			revalidate: 20,
			expire: 86400,
		});
		expect(state.renderBmp).toHaveBeenCalledWith(Buffer.from([1, 2, 3]), {
			ditheringMethod: "ATKINSON",
		});
	});

	it("returns a fallback bitmap when image generation fails without cached data", async () => {
		vi.spyOn(Math, "random").mockReturnValue(0.05);
		state.renderBmp
			.mockResolvedValueOnce(Buffer.from("fallback-bmp"))
			.mockResolvedValueOnce(Buffer.from("fallback-bmp"));
		const { GET } = await loadRoute("test");

		const responsePromise = GET(
			new Request("https://example.test/api/test-img"),
			{ params: Promise.resolve({}) },
		);
		await vi.advanceTimersByTimeAsync(2000);
		const response = await responsePromise;

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("image/bmp");
		expect(response.headers.get("X-Image-Source")).toBe("fallback");
		expect(response.headers.get("X-Image-Error")).toBe(
			"Random error during image generation",
		);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(Buffer.from(await response.arrayBuffer())).toEqual(
			Buffer.from("fallback-bmp"),
		);
	});

	it("returns a plain-text 500 when fallback bitmap generation also fails", async () => {
		vi.spyOn(Math, "random").mockReturnValue(0.9);
		state.renderBmp
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(null);
		const { GET } = await loadRoute("test");

		const responsePromise = GET(
			new Request("https://example.test/api/test-img/fail"),
			{ params: Promise.resolve({ slug: ["fail"] }) },
		);
		await vi.advanceTimersByTimeAsync(2000);
		const response = await responsePromise;

		expect(response.status).toBe(500);
		expect(response.headers.get("Content-Type")).toBe("text/plain");
		await expect(response.text()).resolves.toBe(
			"Critical failure: Failed to generate fallback bitmap buffer",
		);
	});

	it("serves a dev-fresh image first and then reuses the in-memory dev cache", async () => {
		vi.spyOn(Math, "random").mockReturnValue(0.9);
		state.renderBmp.mockResolvedValue(Buffer.from("dev-bmp"));
		const { GET } = await loadRoute("development");

		const firstResponsePromise = GET(
			new Request("https://example.test/api/test-img/dev-clock"),
			{ params: Promise.resolve({ slug: ["dev-clock"] }) },
		);
		await vi.advanceTimersByTimeAsync(2000);
		const firstResponse = await firstResponsePromise;

		expect(firstResponse.status).toBe(200);
		expect(firstResponse.headers.get("X-Image-Source")).toBe("dev-fresh");
		expect(Buffer.from(await firstResponse.arrayBuffer())).toEqual(
			Buffer.from("dev-bmp"),
		);

		const secondResponse = await GET(
			new Request("https://example.test/api/test-img/dev-clock"),
			{ params: Promise.resolve({ slug: ["dev-clock"] }) },
		);

		expect(secondResponse.status).toBe(200);
		expect(secondResponse.headers.get("X-Image-Source")).toBe("dev-cache");
		expect(Buffer.from(await secondResponse.arrayBuffer())).toEqual(
			Buffer.from("dev-bmp"),
		);
		expect(state.cacheLife).not.toHaveBeenCalled();
		expect(state.renderBmp).toHaveBeenCalledTimes(2);
	});

	it("uses the fallback content length when a generated bitmap is empty", async () => {
		vi.spyOn(Math, "random").mockReturnValue(0.9);
		state.renderBmp.mockResolvedValue(Buffer.alloc(0));
		const { GET } = await loadRoute("test");

		const responsePromise = GET(
			new Request("https://example.test/api/test-img/empty"),
			{ params: Promise.resolve({ slug: ["empty"] }) },
		);
		await vi.advanceTimersByTimeAsync(2000);
		const response = await responsePromise;

		expect(response.status).toBe(200);
		expect(response.headers.get("X-Image-Source")).toBe("prod-cache");
		expect(response.headers.get("Content-Length")).toBe("384000");
		expect(Buffer.from(await response.arrayBuffer())).toEqual(Buffer.alloc(0));
	});

	it("returns a critical-error bitmap when the first fallback generation fails but the second succeeds", async () => {
		vi.spyOn(Math, "random").mockReturnValue(0.05);
		state.renderBmp
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(Buffer.from("critical-bmp"));
		const { GET } = await loadRoute("test");

		const responsePromise = GET(
			new Request("https://example.test/api/test-img/recover"),
			{ params: Promise.resolve({ slug: ["recover"] }) },
		);
		await vi.advanceTimersByTimeAsync(2000);
		const response = await responsePromise;

		expect(response.status).toBe(200);
		expect(response.headers.get("X-Image-Source")).toBe("critical-error");
		expect(response.headers.get("X-Image-Error")).toBe(
			"Failed to generate fallback bitmap buffer",
		);
		expect(Buffer.from(await response.arrayBuffer())).toEqual(
			Buffer.from("critical-bmp"),
		);
	});
});
