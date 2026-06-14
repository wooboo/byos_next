import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "vitest";
import ResponsiveExample from "./responsive-example";

describe("responsive-example screen", () => {
	it("renders its public labels for the requested dimensions", () => {
		const html = renderToStaticMarkup(
			<ResponsiveExample width={320} height={240} />,
		);

		assert.match(html, /Responsive Header/);
		assert.match(html, /Top Panel/);
		assert.match(html, /Bottom Panel/);
		assert.match(html, /Footer - 320x240/);
	});
});
