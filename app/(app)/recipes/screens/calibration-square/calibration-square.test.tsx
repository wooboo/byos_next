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

describe("CalibrationSquare", () => {
	it("renders the default centered white square inside the default pre-satori frame", async () => {
		const { default: CalibrationSquare } = await import("./calibration-square");
		const html = renderToStaticMarkup(<CalibrationSquare />);

		assert.match(html, /data-presatori="800x480"/);
		assert.match(html, /background-color:#000/);
		assert.match(html, /width:200px/);
		assert.match(html, /height:200px/);
		assert.match(html, /background-color:#fff/);
	});

	it("passes through custom frame dimensions", async () => {
		const { default: CalibrationSquare } = await import("./calibration-square");
		const html = renderToStaticMarkup(
			<CalibrationSquare width={640} height={640} />,
		);

		assert.match(html, /data-presatori="640x640"/);
	});
});
