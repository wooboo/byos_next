import assert from "node:assert/strict";
import sharp from "sharp";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

const originalFetch = global.fetch;

describe("immich-favorites/getData", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		global.fetch = originalFetch;
	});

	it("fetches a favorite image and returns it as a jpeg data URL", async () => {
		const pngBuffer = await sharp({
			create: {
				width: 2,
				height: 2,
				channels: 3,
				background: { r: 255, g: 0, b: 0 },
			},
		})
			.png()
			.toBuffer();

		global.fetch = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				new Response(JSON.stringify([{ id: "asset-1" }]), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			)
			.mockResolvedValueOnce(
				new Response(new Uint8Array(pngBuffer), {
					status: 200,
					headers: { "Content-Type": "image/png" },
				}),
			);

		const { default: getData } = await import("./getData");
		const data = await getData({
			serverUrl: "https://photos.example.com/",
			apiKey: "secret",
		});

		assert.equal(data.assetId, "asset-1");
		assert.match(data.imageDataUrl, /^data:image\/jpeg;base64,/);
	});

	it("returns an empty result when the api key is missing", async () => {
		const { default: getData } = await import("./getData");
		const data = await getData({ serverUrl: "https://photos.example.com" });

		assert.deepEqual(data, { imageDataUrl: "", assetId: "" });
	});

	it("returns an empty result when search returns no favorites", async () => {
		global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
			new Response(JSON.stringify([]), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const { default: getData } = await import("./getData");
		const data = await getData({
			serverUrl: "https://photos.example.com",
			apiKey: "secret",
		});

		assert.deepEqual(data, { imageDataUrl: "", assetId: "" });
	});

	it("returns an empty result when the random search request fails", async () => {
		global.fetch = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(new Response("boom", { status: 503 }));

		const { default: getData } = await import("./getData");
		const data = await getData({
			serverUrl: "https://photos.example.com",
			apiKey: "secret",
		});

		assert.deepEqual(data, { imageDataUrl: "", assetId: "" });
	});

	it("returns an empty result when the original asset request fails", async () => {
		global.fetch = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				new Response(JSON.stringify([{ id: "asset-1" }]), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			)
			.mockResolvedValueOnce(new Response("boom", { status: 500 }));

		const { default: getData } = await import("./getData");
		const data = await getData({
			serverUrl: "https://photos.example.com",
			apiKey: "secret",
		});

		assert.deepEqual(data, { imageDataUrl: "", assetId: "" });
	});

	it("auto-rotates portrait images when EXIF orientation requires it", async () => {
		const rotateSpy = vi.spyOn(sharp.prototype, "rotate");
		const portraitPng = await sharp({
			create: {
				width: 2,
				height: 4,
				channels: 3,
				background: { r: 0, g: 0, b: 255 },
			},
		})
			.withMetadata({ orientation: 6 })
			.png()
			.toBuffer();

		global.fetch = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				new Response(JSON.stringify([{ id: "asset-portrait" }]), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			)
			.mockResolvedValueOnce(
				new Response(new Uint8Array(portraitPng), {
					status: 200,
					headers: { "Content-Type": "image/png" },
				}),
			);

		const { default: getData } = await import("./getData");
		const data = await getData({
			serverUrl: "https://photos.example.com",
			apiKey: "secret",
		});

		assert.equal(data.assetId, "asset-portrait");
		assert.match(data.imageDataUrl, /^data:image\/jpeg;base64,/);
		assert.equal(rotateSpy.mock.calls.length, 1);
	});
});
