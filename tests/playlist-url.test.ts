import assert from "node:assert/strict";
import test from "node:test";
import { playlistFrameBmpUrl } from "../lib/playlist-url.ts";

test("playlistFrameBmpUrl builds recipe bitmap URLs by default", () => {
	assert.equal(
		playlistFrameBmpUrl("simple-text", undefined, 800, 480, 16),
		"/api/bitmap/simple-text.bmp?width=800&height=480&grayscale=16",
	);
});

test("playlistFrameBmpUrl builds mixup bitmap URLs for mixup frames", () => {
	assert.equal(
		playlistFrameBmpUrl("mixup-123", "mixup", 480, 800, 4),
		"/api/bitmap/mixup/mixup-123.bmp?width=480&height=800&grayscale=4",
	);
});

test("playlistFrameBmpUrl omits grayscale only when it is falsy", () => {
	assert.equal(
		playlistFrameBmpUrl("screen", "recipe", 100, 200, 0),
		"/api/bitmap/screen.bmp?width=100&height=200",
	);
});
