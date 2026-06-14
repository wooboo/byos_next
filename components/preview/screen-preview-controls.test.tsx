import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "vitest";
import {
	ScreenPreviewControls,
	screenPreviewSummary,
} from "./screen-preview-controls";

describe("ScreenPreviewControls", () => {
	it("renders format, size, orientation, and palette controls for bitmap previews", () => {
		const html = renderToStaticMarkup(
			<ScreenPreviewControls
				format="bmp"
				onFormatChange={() => {}}
				sizeIndex={0}
				onSizeIndexChange={() => {}}
				paletteIndex={2}
				onPaletteIndexChange={() => {}}
				isPortrait={false}
				onPortraitChange={() => {}}
			/>,
		);

		assert.ok(html.indexOf(">React<") < html.indexOf(">PNG<"));
		assert.ok(html.indexOf(">PNG<") < html.indexOf(">BMP<"));
		assert.match(html, /<summary/);
		assert.match(html, />Size</);
		assert.match(html, />800×480</);
		assert.match(html, />600×400</);
		assert.match(html, />1872×1404</);
		assert.match(html, />2048×1536</);
		assert.match(html, /aria-label="Landscape"/);
		assert.match(html, /aria-label="Portrait"/);
		assert.match(html, /title="Landscape"/);
		assert.match(html, /title="Portrait"/);
		assert.match(html, />BW</);
		assert.match(html, />4 gray</);
		assert.match(html, />16 gray</);
	});

	it("renders react mode controls and omits bitmap palette controls in react mode", () => {
		const html = renderToStaticMarkup(
			<ScreenPreviewControls
				format="react"
				onFormatChange={() => {}}
				sizeIndex={1}
				onSizeIndexChange={() => {}}
				paletteIndex={0}
				onPaletteIndexChange={() => {}}
				isPortrait
				onPortraitChange={() => {}}
				reactMode="scroll"
				onReactModeChange={() => {}}
				formats={["react"]}
			/>,
		);

		assert.match(html, />React</);
		assert.match(html, />Fit</);
		assert.match(html, />Scroll</);
		assert.doesNotMatch(html, />16 gray</);
		assert.doesNotMatch(html, />BW</);
	});

	it("can relabel the react preview format", () => {
		const html = renderToStaticMarkup(
			<ScreenPreviewControls
				format="react"
				onFormatChange={() => {}}
				sizeIndex={0}
				onSizeIndexChange={() => {}}
				paletteIndex={2}
				onPaletteIndexChange={() => {}}
				isPortrait={false}
				onPortraitChange={() => {}}
				reactLabel="LIQUID"
			/>,
		);

		assert.match(html, />LIQUID</);
		assert.doesNotMatch(html, />React</);
	});
});

describe("screenPreviewSummary", () => {
	it("summarizes bitmap output dimensions and grayscale depth", () => {
		assert.equal(
			screenPreviewSummary({
				format: "bmp",
				width: 800,
				height: 480,
				grayscale: 16,
			}),
			"800×480px · 16 gray levels · BMP",
		);
	});

	it("includes the react mode for react previews", () => {
		assert.equal(
			screenPreviewSummary({
				format: "react",
				width: 1404,
				height: 1872,
				grayscale: 4,
				reactMode: "scroll",
			}),
			"1404×1872px · React scroll",
		);
	});
});
