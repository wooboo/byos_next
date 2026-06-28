import assert from "node:assert/strict";
import sharp from "sharp";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

const originalFetch = global.fetch;

function decodeJpegDataUrl(dataUrl: string) {
	const [, base64 = ""] = dataUrl.split(",");
	return Buffer.from(base64, "base64");
}

describe("immich-favorites/getData", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.resetModules();
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

	it("selects a portrait image when orientation filter is portrait", async () => {
		const pngBuffer = await sharp({
			create: {
				width: 2,
				height: 4,
				channels: 3,
				background: { r: 0, g: 255, b: 0 },
			},
		})
			.png()
			.toBuffer();

		global.fetch = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify([
						{ id: "landscape-1", width: 4, height: 2 },
						{ id: "portrait-1", width: 2, height: 4 },
					]),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				),
			)
			.mockResolvedValueOnce(
				new Response(new Uint8Array(pngBuffer), {
					status: 200,
					headers: { "Content-Type": "image/png" },
				}),
			);

		const { default: getData } = await import("./getData");
		const data = await getData({
			serverUrl: "https://photos.example.com",
			apiKey: "secret",
			orientationFilter: "portrait",
		});

		assert.equal(data.assetId, "portrait-1");
		assert.match(data.imageDataUrl, /^data:image\/jpeg;base64,/);
	});

	it("keeps the selected random favorite stable within the rotation window", async () => {
		vi.spyOn(Date, "now").mockReturnValue(
			new Date("2026-06-25T12:00:00Z").getTime(),
		);
		const pngBuffer = await sharp({
			create: {
				width: 2,
				height: 2,
				channels: 3,
				background: { r: 0, g: 0, b: 255 },
			},
		})
			.png()
			.toBuffer();

		global.fetch = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				new Response(JSON.stringify([{ id: "asset-window-1" }]), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			)
			.mockImplementation(
				async () =>
					new Response(new Uint8Array(pngBuffer), {
						status: 200,
						headers: { "Content-Type": "image/png" },
					}),
			);

		const { default: getData } = await import("./getData");
		const params = {
			serverUrl: "https://photos.example.com",
			apiKey: "secret",
			rotationSeconds: 30 * 60,
		};
		const first = await getData(params);
		const second = await getData(params);

		assert.equal(first.assetId, "asset-window-1");
		assert.equal(second.assetId, "asset-window-1");
		const calls = vi.mocked(global.fetch).mock.calls;
		assert.equal(
			calls.filter(([url]) => String(url).includes("/api/search/random"))
				.length,
			1,
		);
	});

	it("selects a new random favorite after the rotation window changes", async () => {
		const nowSpy = vi
			.spyOn(Date, "now")
			.mockReturnValue(new Date("2026-06-25T12:00:00Z").getTime());
		const pngBuffer = await sharp({
			create: {
				width: 2,
				height: 2,
				channels: 3,
				background: { r: 255, g: 255, b: 0 },
			},
		})
			.png()
			.toBuffer();

		global.fetch = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				new Response(JSON.stringify([{ id: "asset-window-1" }]), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			)
			.mockResolvedValueOnce(
				new Response(new Uint8Array(pngBuffer), {
					status: 200,
					headers: { "Content-Type": "image/png" },
				}),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify([{ id: "asset-window-2" }]), {
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
		const params = {
			serverUrl: "https://photos.example.com",
			apiKey: "secret",
			rotationSeconds: 15 * 60,
		};
		const first = await getData(params);
		nowSpy.mockReturnValue(new Date("2026-06-25T12:16:00Z").getTime());
		const second = await getData(params);

		assert.equal(first.assetId, "asset-window-1");
		assert.equal(second.assetId, "asset-window-2");
		const calls = vi.mocked(global.fetch).mock.calls;
		assert.equal(
			calls.filter(([url]) => String(url).includes("/api/search/random"))
				.length,
			2,
		);
	});

	it("ignores legacy rotationMinutes params", async () => {
		const nowSpy = vi
			.spyOn(Date, "now")
			.mockReturnValue(new Date("2026-06-25T12:00:00Z").getTime());
		const pngBuffer = await sharp({
			create: {
				width: 2,
				height: 2,
				channels: 3,
				background: { r: 255, g: 0, b: 255 },
			},
		})
			.png()
			.toBuffer();

		global.fetch = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				new Response(JSON.stringify([{ id: "default-window-1" }]), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			)
			.mockImplementation(
				async () =>
					new Response(new Uint8Array(pngBuffer), {
						status: 200,
						headers: { "Content-Type": "image/png" },
					}),
			);

		const { default: getData } = await import("./getData");
		const params = {
			serverUrl: "https://photos.example.com",
			apiKey: "secret",
			rotationMinutes: 1,
		};
		const first = await getData(params);
		nowSpy.mockReturnValue(new Date("2026-06-25T12:01:01Z").getTime());
		const second = await getData(params);

		assert.equal(first.assetId, "default-window-1");
		assert.equal(second.assetId, "default-window-1");
		const calls = vi.mocked(global.fetch).mock.calls;
		assert.equal(
			calls.filter(([url]) => String(url).includes("/api/search/random"))
				.length,
			1,
		);
	});

	it("returns empty result when no favorite image matches orientation", async () => {
		global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
			new Response(
				JSON.stringify([
					{ id: "landscape-1", width: 4, height: 2 },
					{ id: "landscape-2", width: 16, height: 9 },
				]),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			),
		);

		const { default: getData } = await import("./getData");
		const data = await getData({
			serverUrl: "https://photos.example.com",
			apiKey: "secret",
			orientationFilter: "portrait",
		});

		assert.deepEqual(data, { imageDataUrl: "", assetId: "" });
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

	it("normalizes upside-down EXIF orientation before returning the image", async () => {
		const width = 8;
		const height = 8;
		const pixels = Buffer.alloc(width * height * 3);
		for (let y = 0; y < height; y += 1) {
			const value = y < height / 2 ? 0 : 255;
			for (let x = 0; x < width; x += 1) {
				const offset = (y * width + x) * 3;
				pixels[offset] = value;
				pixels[offset + 1] = value;
				pixels[offset + 2] = value;
			}
		}
		const upsideDownJpeg = await sharp(pixels, {
			raw: { width, height, channels: 3 },
		})
			.withMetadata({ orientation: 3 })
			.jpeg({ quality: 100 })
			.toBuffer();

		global.fetch = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				new Response(JSON.stringify([{ id: "asset-upside-down" }]), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			)
			.mockResolvedValueOnce(
				new Response(new Uint8Array(upsideDownJpeg), {
					status: 200,
					headers: { "Content-Type": "image/jpeg" },
				}),
			);

		const { default: getData } = await import("./getData");
		const data = await getData({
			serverUrl: "https://photos.example.com",
			apiKey: "secret",
		});

		const { data: outputPixels } = await sharp(
			decodeJpegDataUrl(data.imageDataUrl),
		)
			.raw()
			.toBuffer({ resolveWithObject: true });
		const topCenterOffset = (1 * width + Math.floor(width / 2)) * 3;
		const bottomCenterOffset =
			((height - 2) * width + Math.floor(width / 2)) * 3;

		assert.equal(data.assetId, "asset-upside-down");
		assert.ok(outputPixels[topCenterOffset] > outputPixels[bottomCenterOffset]);
	});
});
