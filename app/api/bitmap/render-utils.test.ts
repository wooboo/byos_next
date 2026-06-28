import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { DitheringMethod } from "@/utils/render-bmp";
import { parseBitmapOptions } from "./render-utils";

function requestFor(url: string) {
	return { url } as Parameters<typeof parseBitmapOptions>[0];
}

describe("bitmap render utils", () => {
	it("uses observed PaperColor colors only when preview mode asks for them", () => {
		const deviceOptions = parseBitmapOptions(
			requestFor(
				"https://example.test/api/bitmap/test.bmp?palette=m5papercolor-ed2208-m5gfx-v1",
			),
		);
		const previewOptions = parseBitmapOptions(
			requestFor(
				"https://example.test/api/bitmap/test.bmp?palette=m5papercolor-ed2208-m5gfx-v1&palette_preview=observed",
			),
		);

		assert.deepEqual(deviceOptions.palette, [
			[0, 0, 0],
			[255, 255, 255],
			[255, 243, 56],
			[191, 0, 0],
			[100, 64, 255],
			[67, 138, 28],
		]);
		assert.deepEqual(deviceOptions.ditherPalette, [
			[87, 77, 80],
			[187, 189, 177],
			[178, 156, 55],
			[74, 35, 36],
			[38, 76, 137],
			[60, 102, 49],
		]);
		assert.deepEqual(deviceOptions.ditherAnchorPalette, deviceOptions.palette);
		assert.deepEqual(previewOptions.palette, deviceOptions.ditherPalette);
		assert.deepEqual(previewOptions.ditherPalette, deviceOptions.ditherPalette);
		assert.deepEqual(previewOptions.ditherAnchorPalette, deviceOptions.palette);
	});

	it("parses bitmap dithering controls from query params", () => {
		const options = parseBitmapOptions(
			requestFor(
				"https://example.test/api/bitmap/test.bmp?dithering=bayer&bayer=8&saturation=1.35",
			),
		);
		const aliasOptions = parseBitmapOptions(
			requestFor("https://example.test/api/bitmap/test.bmp?dithering=fs"),
		);

		assert.equal(options.ditheringMethod, DitheringMethod.BAYER);
		assert.equal(options.bayerPatternSize, 8);
		assert.equal(options.colorSaturation, 1.35);
		assert.equal(aliasOptions.ditheringMethod, DitheringMethod.FLOYD_STEINBERG);
	});
});
