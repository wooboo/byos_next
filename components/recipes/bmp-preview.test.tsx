import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";
import {
	BmpPreview,
	BmpPreviewContent,
	fetchBmpPreviewObjectUrl,
	getBmpPreviewRequestUrl,
	startBmpPreviewRequest,
} from "./bmp-preview";

vi.mock("next/image", () => ({
	default: ({
		src,
		alt,
		width,
		height,
	}: {
		src: string;
		alt: string;
		width: number;
		height: number;
	}) => (
		<div
			data-image-src={src}
			data-image-alt={alt}
			data-image-width={width}
			data-image-height={height}
		/>
	),
}));

describe("BmpPreview", () => {
	it("builds request urls for plain and pre-parameterized bitmap endpoints", () => {
		assert.equal(
			getBmpPreviewRequestUrl({
				slug: "weather",
				width: 800,
				height: 480,
				bpp: 16,
			}),
			"/api/bitmap/weather.bmp?width=800&height=480&grayscale=16",
		);
		assert.equal(
			getBmpPreviewRequestUrl({
				slug: "weather",
				width: 1200,
				height: 825,
				bpp: 4,
				bitmapUrl: "/api/bitmap/weather.bmp?cache=1",
			}),
			"/api/bitmap/weather.bmp?cache=1&width=1200&height=825&grayscale=4",
		);
	});

	it("creates object urls from successful bitmap fetches and rejects failed responses", async () => {
		const blob = new Blob(["bmp"]);
		const fetcher = async () =>
			({
				ok: true,
				status: 200,
				blob: async () => blob,
			}) as Response;
		const createObjectUrl = (value: Blob) => {
			assert.equal(value, blob);
			return "blob:preview";
		};

		await assert.doesNotReject(async () => {
			const url = await fetchBmpPreviewObjectUrl({
				requestUrl: "/api/bitmap/weather.bmp?width=800&height=480&grayscale=16",
				fetcher,
				createObjectUrl,
			});
			assert.equal(url, "blob:preview");
		});

		await assert.rejects(() =>
			fetchBmpPreviewObjectUrl({
				requestUrl: "/api/bitmap/weather.bmp?width=800&height=480&grayscale=16",
				fetcher: async () =>
					({
						ok: false,
						status: 503,
						blob: async () => blob,
					}) as Response,
			}),
		);
	});

	it("coordinates preview request lifecycle and cleanup", async () => {
		const setSrc = vi.fn();
		const setLoading = vi.fn();
		const setError = vi.fn();
		const revokeObjectUrl = vi.fn();

		const cleanup = startBmpPreviewRequest({
			requestUrl: "/api/bitmap/weather.bmp?width=800&height=480&grayscale=16",
			setSrc,
			setLoading,
			setError,
			fetchPreview: vi.fn().mockResolvedValue("blob:preview"),
			revokeObjectUrl,
		});

		await Promise.resolve();
		await Promise.resolve();

		assert.deepEqual(setLoading.mock.calls, [[true], [false]]);
		assert.deepEqual(setError.mock.calls, [[false]]);
		assert.deepEqual(setSrc.mock.calls, [["blob:preview"]]);

		cleanup();
		assert.deepEqual(revokeObjectUrl.mock.calls, [["blob:preview"]]);

		const errorSetLoading = vi.fn();
		const errorSetError = vi.fn();
		const errorCleanup = startBmpPreviewRequest({
			requestUrl: "/api/bitmap/weather.bmp?width=800&height=480&grayscale=16",
			setSrc: vi.fn(),
			setLoading: errorSetLoading,
			setError: errorSetError,
			fetchPreview: vi.fn().mockRejectedValue(new Error("boom")),
		});
		await Promise.resolve();
		await Promise.resolve();
		assert.deepEqual(errorSetLoading.mock.calls, [[true], [false]]);
		assert.deepEqual(errorSetError.mock.calls, [[false], [true]]);
		errorCleanup();
	});

	it("renders the loading placeholder during SSR before effects run", () => {
		const html = renderToStaticMarkup(
			<BmpPreview slug="weather" width={800} height={480} bpp={16} />,
		);

		assert.match(html, /Rendering…/);
		assert.doesNotMatch(html, /Failed to render/);
	});

	it("renders explicit error and success states", () => {
		const errorHtml = renderToStaticMarkup(
			<BmpPreviewContent
				loading={false}
				error
				src=""
				width={800}
				height={480}
			/>,
		);
		const successHtml = renderToStaticMarkup(
			<BmpPreviewContent
				loading={false}
				error={false}
				src="blob:preview"
				width={800}
				height={480}
			/>,
		);

		assert.match(errorHtml, /Failed to render/);
		assert.match(successHtml, /data-image-src="blob:preview"/);
		assert.match(successHtml, /data-image-alt="BMP preview"/);
	});
});
