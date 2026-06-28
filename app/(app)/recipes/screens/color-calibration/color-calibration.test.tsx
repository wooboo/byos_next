import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";

vi.mock("@/utils/pre-satori", () => ({
	PreSatori: ({
		width,
		height,
		children,
	}: {
		width?: number;
		height?: number;
		children: React.ReactNode;
	}) => <div data-presatori={`${width}x${height}`}>{children}</div>,
}));

describe("ColorCalibration", () => {
	it("renders the default overview calibration target", async () => {
		const { default: ColorCalibration } = await import("./color-calibration");
		const html = renderToStaticMarkup(<ColorCalibration />);

		assert.match(html, /data-presatori="800x480"/);
		assert.match(html, /Color calibration/);
		assert.match(html, /0 black/);
		assert.match(html, /#FFF338/);
		assert.match(html, /wall 225/);
		assert.match(html, /white\/green/);
	});

	it("can render a label-free native palette target", async () => {
		const { default: ColorCalibration } = await import("./color-calibration");
		const html = renderToStaticMarkup(
			<ColorCalibration
				width={600}
				height={400}
				params={{ pattern: "palette", showLabels: false }}
			/>,
		);

		assert.match(html, /data-presatori="600x400"/);
		assert.match(html, /background-color:#000000/);
		assert.match(html, /background-color:#ffffff/);
		assert.match(html, /background-color:#fff338/);
		assert.doesNotMatch(html, /0 black/);
		assert.doesNotMatch(html, /Native palette/);
	});

	it("renders gradient calibration ramps", async () => {
		const { default: ColorCalibration } = await import("./color-calibration");
		const html = renderToStaticMarkup(
			<ColorCalibration params={{ pattern: "gradients" }} />,
		);

		assert.match(html, /Gradient calibration/);
		assert.match(html, /white-black/);
		assert.match(html, /white-yellow/);
		assert.match(html, /blue-green/);
		assert.match(html, /background-color:#ffffff/);
		assert.match(html, /background-color:#000000/);
		assert.match(html, /background-color:#fff338/);
	});
});
