import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { proxiedImageUrl } from "./image-proxy";

describe("proxiedImageUrl", () => {
	it("proxies http and https image URLs through the local image proxy", () => {
		assert.equal(
			proxiedImageUrl("https://example.com/album.png?x=1"),
			"/api/image-proxy?url=https%3A%2F%2Fexample.com%2Falbum.png%3Fx%3D1",
		);
		assert.equal(
			proxiedImageUrl("http://example.com/album.png"),
			"/api/image-proxy?url=http%3A%2F%2Fexample.com%2Falbum.png",
		);
	});

	it("leaves local and inline URLs untouched", () => {
		assert.equal(proxiedImageUrl("/album.png"), "/album.png");
		assert.equal(
			proxiedImageUrl("data:image/png;base64,abc"),
			"data:image/png;base64,abc",
		);
		assert.equal(proxiedImageUrl("not a url"), "not a url");
	});
});
