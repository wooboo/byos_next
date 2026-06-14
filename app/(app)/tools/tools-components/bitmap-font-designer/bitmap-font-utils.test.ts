import assert from "node:assert/strict";
import { describe, expect, it } from "vitest";
import {
	base64ToBinary,
	binaryToBase64,
	binaryToGrid,
	binaryToSvgPath,
	cloneGrid,
	copyGridIntoDimensions,
	createEmptyGrid,
	createGridFromBinary,
	getGridDimensions,
	gridToBinary,
	isGridSizeUnavailable,
	parseGridSize,
	rotateGrid,
} from "./bitmap-font-utils.ts";

describe("bitmap font binary conversion helpers", () => {
	it("round-trips binary data through base64", () => {
		const binary = "0100000101000010";

		assert.equal(binaryToBase64(binary), "QUI=");
		assert.equal(base64ToBinary("QUI="), binary);
	});

	it("pads incomplete bytes when encoding binary to base64", () => {
		assert.equal(base64ToBinary(binaryToBase64("1")), "10000000");
	});

	it("converts binary strings to SVG path cells", () => {
		assert.equal(
			binaryToSvgPath("1001", 2, 2).replaceAll(/\s+/g, " ").trim(),
			"M 0 0 h 1 v 1 h -1 z M 1 1 h 1 v 1 h -1 z",
		);
		assert.equal(binaryToSvgPath("1", 2, 2), "M 0 0 h 1 v 1 h -1 z   ");
		assert.equal(binaryToSvgPath("0000", 2, 2).trim(), "");
	});
});

describe("bitmap font grid helpers", () => {
	it("parses and validates grid sizes", () => {
		assert.deepEqual(parseGridSize("8x16"), [8, 16]);
		assert.equal(isGridSizeUnavailable("8x16", ["8x16"]), true);
		assert.equal(isGridSizeUnavailable("4x4", []), true);
		assert.equal(isGridSizeUnavailable("5x5", []), false);
	});

	it("creates, clones, serializes, and deserializes grids", () => {
		const grid = createEmptyGrid(2, 3);
		assert.deepEqual(grid, [
			[0, 0],
			[0, 0],
			[0, 0],
		]);
		assert.deepEqual(getGridDimensions(grid), { width: 2, height: 3 });

		const fromBinary = binaryToGrid("101", 2, 2);
		assert.deepEqual(fromBinary, [
			[1, 0],
			[1, 0],
		]);
		assert.equal(gridToBinary(fromBinary), "1010");

		const clone = cloneGrid(fromBinary);
		clone[0][0] = 0;
		assert.equal(fromBinary[0][0], 1);
		assert.deepEqual(getGridDimensions([]), { width: 0, height: 0 });
	});

	it("creates grids from optional binary and copies into target dimensions", () => {
		assert.deepEqual(createGridFromBinary(undefined, 2, 1), [[0, 0]]);
		assert.deepEqual(createGridFromBinary("10", 2, 1), [[1, 0]]);
		assert.deepEqual(createGridFromBinary("10101", 2, 2), [
			[1, 0],
			[1, 0],
		]);

		assert.deepEqual(copyGridIntoDimensions([[1, 1, 1]], 2, 2), [
			[1, 1],
			[0, 0],
		]);

		const baseGrid = [
			[9, 9],
			[9, 9],
		];
		expect(copyGridIntoDimensions([[1]], 2, 2, baseGrid)).toBe(baseGrid);
		assert.deepEqual(baseGrid, [
			[1, 9],
			[9, 9],
		]);
	});

	it("rotates rectangular grids in both directions", () => {
		const grid = [
			[1, 2, 3],
			[4, 5, 6],
		];

		assert.deepEqual(rotateGrid(grid, "clockwise"), [
			[4, 1],
			[5, 2],
			[6, 3],
		]);
		assert.deepEqual(rotateGrid(grid, "counter-clockwise"), [
			[3, 6],
			[2, 5],
			[1, 4],
		]);
	});
});
