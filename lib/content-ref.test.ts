import { describe, expect, it } from "vitest";
import { isUuid, resolveRenderableContentType } from "./content-ref";

describe("isUuid", () => {
	it("accepts valid UUIDs regardless of case", () => {
		expect(isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
		expect(isUuid("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
	});

	it("rejects missing and malformed values", () => {
		expect(isUuid(null)).toBe(false);
		expect(isUuid(undefined)).toBe(false);
		expect(isUuid("not-a-uuid")).toBe(false);
		expect(isUuid("550e8400-e29b-61d4-a716-446655440000")).toBe(false);
	});
});

describe("resolveRenderableContentType", () => {
	it("returns screen only for explicit screen content", () => {
		expect(resolveRenderableContentType("screen", "ignored")).toBe("screen");
	});

	it("falls back to recipe for every other content type", () => {
		expect(resolveRenderableContentType("recipe", "ignored")).toBe("recipe");
		expect(resolveRenderableContentType("anything-else", "ignored")).toBe(
			"recipe",
		);
		expect(resolveRenderableContentType(null, "ignored")).toBe("recipe");
	});
});
