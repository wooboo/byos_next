import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
	canAddGridSize,
	GRID_SELECTOR_CELL_SIZE,
	getGridCellFillStyle,
	getGridSizeFromPointer,
	MAX_GRID_SIZE,
} from "./add-grid-size-helpers.ts";

describe("add-grid-size helpers", () => {
	it("maps pointer positions to grid sizes within bounds", () => {
		assert.equal(getGridSizeFromPointer(0, 0, { left: 0, top: 0 }), "1x1");
		assert.equal(
			getGridSizeFromPointer(
				GRID_SELECTOR_CELL_SIZE * 2,
				GRID_SELECTOR_CELL_SIZE * 3,
				{ left: 0, top: 0 },
			),
			"3x4",
		);
		assert.equal(
			getGridSizeFromPointer(GRID_SELECTOR_CELL_SIZE * MAX_GRID_SIZE, 0, {
				left: 0,
				top: 0,
			}),
			null,
		);
	});

	it("knows when a hovered size can be added", () => {
		assert.equal(canAddGridSize("5x5", ["7x8"]), true);
		assert.equal(canAddGridSize("4x4", []), false);
		assert.equal(canAddGridSize("7x8", ["7x8"]), false);
		assert.equal(canAddGridSize(null, []), false);
	});

	it("computes cell fill colors for available, disabled, and hovered sizes", () => {
		assert.equal(getGridCellFillStyle("5x5", null, []), "#e5e7eb");
		assert.equal(getGridCellFillStyle("5x5", "5x5", []), "#3b82f6");
		assert.equal(
			getGridCellFillStyle("4x4", "4x4", []),
			"rgba(229, 231, 235, 0.5)",
		);
	});
});
