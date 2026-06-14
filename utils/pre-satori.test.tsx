import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, it } from "vitest";
import { PreSatori } from "./pre-satori";

describe("PreSatori", () => {
	afterEach(() => {
		delete process.env.REACT_RENDERER;
	});

	it("does not double browser-rendered components", () => {
		process.env.REACT_RENDERER = "browser";

		const html = renderToStaticMarkup(
			<PreSatori width={800} height={480} useDoubling={true}>
				<div>content</div>
			</PreSatori>,
		);

		assert.doesNotMatch(html, /scale\(2\)/);
		assert.match(html, /width:800px/);
		assert.match(html, /height:480px/);
	});

	it("keeps doubling for Takumi and Satori renderers", () => {
		process.env.REACT_RENDERER = "takumi";

		const html = renderToStaticMarkup(
			<PreSatori width={800} height={480} useDoubling={true}>
				<div>content</div>
			</PreSatori>,
		);

		assert.match(html, /scale\(2\)/);
	});
});
