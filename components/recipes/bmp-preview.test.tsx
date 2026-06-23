import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "vitest";
import {
	BmpPreview,
	BmpPreviewContent,
	getBmpPreviewRequestUrl,
} from "./bmp-preview";

describe("BmpPreview", () => {
	it("builds request urls for plain and pre-parameterized bitmap endpoints", () => {
		assert.equal(
			getBmpPreviewRequestUrl({
				slug: "weather",
				width: 800,
				height: 480,
				bpp: 16,
			}),
			"/api/bitmap/weather/default.bmp?width=800&height=480&bpp=16",
		);
		assert.equal(
			getBmpPreviewRequestUrl({
				slug: "weather",
				width: 1200,
				height: 825,
				bpp: 4,
				bitmapUrl: "/api/bitmap/weather.bmp?cache=1",
			}),
			"/api/bitmap/weather.bmp?cache=1&width=1200&height=825&bpp=4",
		);
		assert.equal(
			getBmpPreviewRequestUrl({
				slug: "weather",
				width: 800,
				height: 480,
				bpp: 2,
				paletteId: "color-6a",
			}),
			"/api/bitmap/weather/default.bmp?width=800&height=480&bpp=2&palette=color-6a",
		);
	});

	it("renders the bitmap URL directly during SSR", () => {
		const html = renderToStaticMarkup(
			<BmpPreview slug="weather" width={800} height={480} bpp={16} />,
		);

		assert.match(
			html,
			/src="\/api\/bitmap\/weather\/default\.bmp\?width=800&amp;height=480&amp;bpp=16"/,
		);
		assert.match(html, /Rendering…/);
		assert.doesNotMatch(html, /Failed to render/);
	});

	it("renders explicit error and success states", () => {
		const errorHtml = renderToStaticMarkup(
			<BmpPreviewContent
				error
				loading={false}
				src=""
				width={800}
				height={480}
			/>,
		);
		const successHtml = renderToStaticMarkup(
			<BmpPreviewContent
				error={false}
				loading={false}
				src="/api/bitmap/weather/default.bmp"
				width={800}
				height={480}
			/>,
		);

		assert.match(errorHtml, /Failed to render/);
		assert.match(successHtml, /src="\/api\/bitmap\/weather\/default\.bmp"/);
		assert.match(successHtml, /alt="BMP preview"/);
		assert.match(successHtml, /object-contain/);
		assert.doesNotMatch(successHtml, /Rendering…/);
	});
});
