import assert from "node:assert/strict";
import { describe, it } from "vitest";
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
			[70, 66, 95],
			[178, 193, 184],
			[175, 153, 0],
			[97, 65, 72],
			[19, 80, 155],
			[36, 109, 40],
		]);
		assert.deepEqual(previewOptions.palette, deviceOptions.ditherPalette);
		assert.deepEqual(previewOptions.ditherPalette, deviceOptions.ditherPalette);
	});
});
