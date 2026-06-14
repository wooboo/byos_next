import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "vitest";
import NotFound from "./not-found.tsx";

describe("global not-found page", () => {
	it("server-renders accessible fallback text and the 404 image", () => {
		const html = renderToStaticMarkup(<NotFound />);

		assert.match(
			html,
			/404 not found\. the page you are looking for does not exist\./,
		);
		assert.match(html, /alt="404"/);
		assert.match(html, /not-found\.png/);
		assert.match(html, /image-rendering:pixelated/);
	});
});
