import { afterEach, describe, expect, it, vi } from "vitest";

describe("action-results", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns a standard database unavailable result", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const { databaseUnavailableResult } = await import("./action-results");

		expect(databaseUnavailableResult()).toEqual({
			success: false,
			error: "Database client not initialized",
		});
		expect(warn).toHaveBeenCalledWith("Database client not initialized");
	});

	it("maps thrown errors to action errors", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const { actionErrorResult } = await import("./action-results");
		const thrown = new Error("boom");

		expect(actionErrorResult("Failed action:", thrown)).toEqual({
			success: false,
			error: "boom",
		});
		expect(error).toHaveBeenCalledWith("Failed action:", thrown);
	});

	it("maps non-error values to action errors", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const { actionErrorResult } = await import("./action-results");

		expect(actionErrorResult("Failed action:", "boom")).toEqual({
			success: false,
			error: "boom",
		});
		expect(error).toHaveBeenCalledWith("Failed action:", "boom");
	});
});
