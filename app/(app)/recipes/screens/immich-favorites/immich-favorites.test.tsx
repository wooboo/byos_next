import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "vitest";
import ImmichFavorites from "./immich-favorites";

describe("immich-favorites screen", () => {
	it("renders an empty favorites message when no image is available", () => {
		const html = renderToStaticMarkup(
			<ImmichFavorites width={320} height={240} />,
		);

		assert.match(html, /Brak zdjęć w ulubionych/);
		assert.match(html, /width:320px/);
		assert.match(html, /height:240px/);
	});

	it("renders the favorite image data URL when provided", () => {
		const imageDataUrl = "data:image/png;base64,ZmFrZQ==";
		const html = renderToStaticMarkup(
			<ImmichFavorites imageDataUrl={imageDataUrl} />,
		);

		assert.match(html, new RegExp(imageDataUrl));
		assert.match(html, /object-fit:contain/);
	});
});
