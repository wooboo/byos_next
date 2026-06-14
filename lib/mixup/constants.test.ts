import { describe, expect, it } from "vitest";
import {
	buildAssignments,
	DeviceDisplayMode,
	getLayoutById,
	LAYOUT_OPTIONS,
	MixupLayoutId,
	slotsToAssignments,
} from "./constants";

describe("mixup constants", () => {
	it("exports stable enums and default layout options", () => {
		expect(DeviceDisplayMode.MIXUP).toBe("mixup");
		expect(LAYOUT_OPTIONS.map((layout) => layout.id)).toContain(
			MixupLayoutId.QUARTERS,
		);
	});

	it("scales layouts to the requested canvas size", () => {
		const layout = getLayoutById(MixupLayoutId.TOP_BANNER, 200, 100);

		expect(layout).toEqual({
			id: MixupLayoutId.TOP_BANNER,
			slots: [
				expect.objectContaining({
					id: "top",
					width: 200,
					height: 50,
					x: 0,
					y: 0,
				}),
				expect.objectContaining({
					id: "bottom-left",
					width: 100,
					height: 50,
					x: 0,
					y: 50,
				}),
				expect.objectContaining({
					id: "bottom-right",
					width: 100,
					height: 50,
					x: 100,
					y: 50,
				}),
			],
		});
		expect(getLayoutById("missing")).toBeUndefined();
	});

	it("builds assignments from existing values first and falls back to recipe order", () => {
		const layout = getLayoutById(MixupLayoutId.VERTICAL_HALVES);
		if (!layout) {
			throw new Error("Expected vertical-halves layout");
		}

		const assignments = buildAssignments(
			layout,
			[{ id: "recipe-a" }, { id: "recipe-b" }],
			{ "left-half": "kept" },
		);

		expect(assignments).toEqual({
			"left-half": "kept",
			"right-half": "recipe-b",
		});
	});

	it("converts slot rows into an assignments map", () => {
		expect(
			slotsToAssignments([
				{ slot_id: "a", recipe_id: "recipe-a", recipe_slug: "alpha" },
				{ slot_id: "b", recipe_id: null, recipe_slug: "beta" },
			]),
		).toEqual({
			a: "recipe-a",
		});
	});
});
