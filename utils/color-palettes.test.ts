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
					[87, 77, 80],
					[187, 189, 177],
					[178, 156, 55],
					[74, 35, 36],
					[38, 76, 137],
					[60, 102, 49],
				],
				previewColors: [
					[87, 77, 80],
					[187, 189, 177],
					[178, 156, 55],
					[74, 35, 36],
					[38, 76, 137],
					[60, 102, 49],
				],
			},
		);
	});
});
