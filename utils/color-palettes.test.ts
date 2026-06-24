import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
	resolveColorPalette,
	resolveColorPaletteProfile,
} from "./color-palettes";

describe("color palette resolution", () => {
	it("resolves the PaperColor ED2208 nominal palette", () => {
		assert.deepEqual(resolveColorPalette("m5papercolor-ed2208-m5gfx-v1"), [
			[0, 0, 0],
			[255, 255, 255],
			[255, 243, 56],
			[191, 0, 0],
			[100, 64, 255],
			[67, 138, 28],
		]);
	});

	it("resolves observed PaperColor colors separately from device colors", () => {
		assert.deepEqual(
			resolveColorPaletteProfile("m5papercolor-ed2208-m5gfx-v1"),
			{
				colors: [
					[0, 0, 0],
					[255, 255, 255],
					[255, 243, 56],
					[191, 0, 0],
					[100, 64, 255],
					[67, 138, 28],
				],
				ditherColors: [
					[70, 66, 95],
					[178, 193, 184],
					[175, 153, 0],
					[97, 65, 72],
					[19, 80, 155],
					[36, 109, 40],
				],
				previewColors: [
					[70, 66, 95],
					[178, 193, 184],
					[175, 153, 0],
					[97, 65, 72],
					[19, 80, 155],
					[36, 109, 40],
				],
			},
		);
	});
});
