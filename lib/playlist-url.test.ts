import { describe, expect, it } from "vitest";
import { playlistFrameBmpUrl } from "./playlist-url.ts";

describe("playlistFrameBmpUrl", () => {
	it("builds recipe bitmap URLs by default", () => {
		expect(playlistFrameBmpUrl("simple-text", undefined, 800, 480, 16)).toBe(
			"/api/bitmap/simple-text.bmp?width=800&height=480&grayscale=16",
		);
	});

	it("builds mixup bitmap URLs for mixup frames", () => {
		expect(playlistFrameBmpUrl("mixup-123", "mixup", 480, 800, 4)).toBe(
			"/api/bitmap/mixup/mixup-123.bmp?width=480&height=800&grayscale=4",
		);
	});

	it("builds named screen bitmap URLs for screen frames", () => {
		expect(playlistFrameBmpUrl("screen-123", "screen", 800, 480, 16)).toBe(
			"/api/bitmap/screen/screen-123.bmp?width=800&height=480&grayscale=16",
		);
	});

	it("omits grayscale only when it is falsy", () => {
		expect(playlistFrameBmpUrl("screen", "recipe", 100, 200, 0)).toBe(
			"/api/bitmap/screen.bmp?width=100&height=200",
		);
	});
});
