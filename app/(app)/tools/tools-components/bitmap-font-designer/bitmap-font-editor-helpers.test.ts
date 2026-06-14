import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
	canvasToGrid,
	clampBaseline,
	clampXHeight,
	interpolatePoints,
	isInsideGrid,
	rotateGridToDimensions,
	shiftGrid,
} from "./bitmap-font-editor-helpers.ts";

describe("bitmap-font-editor helpers", () => {
	it("interpolates continuous points across a drag path", () => {
		assert.deepEqual(interpolatePoints(0, 0, 3, 0), [
			[0, 0],
			[1, 0],
			[2, 0],
			[3, 0],
		]);
		assert.deepEqual(interpolatePoints(0, 0, 2, 2), [
			[0, 0],
			[1, 1],
			[2, 2],
		]);
	});

	it("resolves grid hit-testing from canvas coordinates", () => {
		assert.deepEqual(canvasToGrid(0, 0, 40), [0, 0]);
		assert.deepEqual(canvasToGrid(40, 40, 40), [0, 0]);
		assert.deepEqual(canvasToGrid(41, 41, 40), [1, 1]);
		assert.equal(isInsideGrid(1, 1, 2, 2), true);
		assert.equal(isInsideGrid(2, 1, 2, 2), false);
	});

	it("rotates grids and preserves component dimensions when needed", () => {
		assert.deepEqual(
			rotateGridToDimensions(
				[
					[1, 2, 3],
					[4, 5, 6],
				],
				"clockwise",
				2,
				3,
			),
			[
				[4, 1],
				[5, 2],
				[6, 3],
			],
		);

		assert.deepEqual(
			rotateGridToDimensions(
				[
					[1, 2, 3],
					[4, 5, 6],
				],
				"clockwise",
				3,
				3,
			),
			[
				[4, 1, 3],
				[5, 2, 6],
				[6, 3, 0],
			],
		);
	});

	it("wrap-shifts grids in every direction", () => {
		const grid = [
			[1, 2],
			[3, 4],
		];

		assert.deepEqual(shiftGrid(grid, 2, 2, "up"), [
			[3, 4],
			[1, 2],
		]);
		assert.deepEqual(shiftGrid(grid, 2, 2, "down"), [
			[3, 4],
			[1, 2],
		]);
		assert.deepEqual(shiftGrid(grid, 2, 2, "left"), [
			[2, 1],
			[4, 3],
		]);
		assert.deepEqual(shiftGrid(grid, 2, 2, "right"), [
			[2, 1],
			[4, 3],
		]);
	});

	it("clamps x-height and baseline against each other and grid bounds", () => {
		assert.equal(clampXHeight(9, 8, 6), 5);
		assert.equal(clampXHeight(-1, 8, 6), 0);
		assert.equal(clampBaseline(-1, 8, 3), 4);
		assert.equal(clampBaseline(99, 8, 3), 7);
	});
});
