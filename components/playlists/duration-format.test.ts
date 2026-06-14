import { describe, expect, it } from "vitest";
import { formatPlaylistDuration } from "./duration-format";

describe("formatPlaylistDuration", () => {
	it("formats zero and negative durations without a suffix by default", () => {
		expect(formatPlaylistDuration(0)).toBe("0s");
		expect(formatPlaylistDuration(-15)).toBe("0s");
	});

	it("keeps the suffix for zero when suffixZero is enabled", () => {
		expect(
			formatPlaylistDuration(0, { suffix: "loop", suffixZero: true }),
		).toBe("0s loop");
	});

	it("formats second-only durations", () => {
		expect(formatPlaylistDuration(45)).toBe("45s");
		expect(formatPlaylistDuration(45, { suffix: "loop" })).toBe("45s loop");
	});

	it("formats minute-only durations", () => {
		expect(formatPlaylistDuration(120)).toBe("2m");
		expect(formatPlaylistDuration(120, { suffix: "loop" })).toBe("2m loop");
	});

	it("formats mixed minute and second durations", () => {
		expect(formatPlaylistDuration(125)).toBe("2m 5s");
		expect(formatPlaylistDuration(125, { suffix: "loop" })).toBe("2m 5s loop");
	});
});
