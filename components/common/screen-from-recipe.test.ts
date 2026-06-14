import assert from "node:assert/strict";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	createScreenIdFromRecipe,
	promptScreenName,
} from "./screen-from-recipe";

const mocks = vi.hoisted(() => ({
	createScreenFromRecipe: vi.fn(),
}));

vi.mock("@/app/actions/screens", () => ({
	createScreenFromRecipe: mocks.createScreenFromRecipe,
}));

describe("screen-from-recipe helpers", () => {
	beforeEach(() => {
		mocks.createScreenFromRecipe.mockReset();
	});

	it("returns a trimmed prompt value and filters empty or cancelled responses", () => {
		Object.defineProperty(globalThis, "window", {
			value: {
				prompt: vi
					.fn()
					.mockReturnValueOnce("  Main display  ")
					.mockReturnValueOnce("   ")
					.mockReturnValueOnce(null),
			},
			configurable: true,
		});

		assert.equal(promptScreenName("Default"), "Main display");
		assert.equal(promptScreenName("Default"), null);
		assert.equal(promptScreenName("Default"), null);
	});

	it("returns the created screen id only for successful results", async () => {
		mocks.createScreenFromRecipe
			.mockResolvedValueOnce({
				success: true,
				screen: { id: "screen-123" },
			})
			.mockResolvedValueOnce({
				success: false,
				screen: null,
			});

		await expect(createScreenIdFromRecipe("recipe-1", "Kitchen")).resolves.toBe(
			"screen-123",
		);
		await expect(
			createScreenIdFromRecipe("recipe-1", "Kitchen"),
		).resolves.toBeNull();
	});
});
