import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "vitest";
import { StatusIndicator } from "./status-indicator";

describe("StatusIndicator", () => {
	it("renders an animated green indicator for online devices", () => {
		const html = renderToStaticMarkup(
			<StatusIndicator status="online" size="sm" className="status-pill" />,
		);

		assert.match(html, /relative flex items-center status-pill/);
		assert.match(html, /bg-green-500/);
		assert.match(html, /size-1\.5/);
		assert.match(html, /animate-radar-ping/);
	});

	it("renders a static red indicator for offline devices", () => {
		const html = renderToStaticMarkup(<StatusIndicator status="offline" />);

		assert.match(html, /bg-red-500/);
		assert.match(html, /size-2/);
		assert.doesNotMatch(html, /animate-radar-ping/);
	});
});
