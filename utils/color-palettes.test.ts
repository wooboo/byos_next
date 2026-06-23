import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { resolveColorPalette } from "./color-palettes";

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
});
