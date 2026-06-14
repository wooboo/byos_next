import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "vitest";
import NotFoundScreen from "./not-found";

describe("not-found screen", () => {
	it("renders the generic fallback copy and optional slug", () => {
		const html = renderToStaticMarkup(
			<NotFoundScreen slug="weather" width={400} height={240} />,
		);

		assert.match(html, /Screen Not Found/);
		assert.match(html, /Could not find screen: weather/);
		assert.match(html, /Please check your configuration/);
	});
});
