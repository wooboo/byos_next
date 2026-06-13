import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPageNumbers } from "../components/logs/pagination.ts";

describe("buildPageNumbers", () => {
	it("returns every page when there are five or fewer pages", () => {
		assert.deepEqual(buildPageNumbers(1, 0), []);
		assert.deepEqual(buildPageNumbers(1, 1), [1]);
		assert.deepEqual(buildPageNumbers(3, 5), [1, 2, 3, 4, 5]);
	});

	it("shows the first page window near the beginning", () => {
		assert.deepEqual(buildPageNumbers(1, 10), [1, 2, 3, 4, 5, "ellipsis", 10]);
		assert.deepEqual(buildPageNumbers(3, 10), [1, 2, 3, 4, 5, "ellipsis", 10]);
	});

	it("shows the current page window in the middle", () => {
		assert.deepEqual(buildPageNumbers(6, 10), [
			1,
			"ellipsis",
			5,
			6,
			7,
			"ellipsis",
			10,
		]);
	});

	it("shows the last page window near the end", () => {
		assert.deepEqual(buildPageNumbers(8, 10), [1, "ellipsis", 6, 7, 8, 9, 10]);
		assert.deepEqual(buildPageNumbers(10, 10), [1, "ellipsis", 6, 7, 8, 9, 10]);
	});
});
