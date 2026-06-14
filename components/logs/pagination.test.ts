import { describe, expect, it } from "vitest";
import { buildPageNumbers } from "./pagination.ts";

describe("buildPageNumbers", () => {
	it("returns every page when there are five or fewer pages", () => {
		expect(buildPageNumbers(1, 0)).toEqual([]);
		expect(buildPageNumbers(1, 1)).toEqual([1]);
		expect(buildPageNumbers(3, 5)).toEqual([1, 2, 3, 4, 5]);
	});

	it("shows the first page window near the beginning", () => {
		expect(buildPageNumbers(1, 10)).toEqual([1, 2, 3, 4, 5, "ellipsis", 10]);
		expect(buildPageNumbers(3, 10)).toEqual([1, 2, 3, 4, 5, "ellipsis", 10]);
	});

	it("shows the current page window in the middle", () => {
		expect(buildPageNumbers(6, 10)).toEqual([
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
		expect(buildPageNumbers(8, 10)).toEqual([1, "ellipsis", 6, 7, 8, 9, 10]);
		expect(buildPageNumbers(10, 10)).toEqual([1, "ellipsis", 6, 7, 8, 9, 10]);
	});
});
