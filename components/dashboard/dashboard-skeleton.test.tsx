import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "vitest";
import { DashboardSkeleton } from "./dashboard-skeleton";

describe("DashboardSkeleton", () => {
	it("renders the main dashboard sections and placeholder rows", () => {
		const html = renderToStaticMarkup(
			<DashboardSkeleton className="dashboard-loading" />,
		);

		assert.match(html, /class="dashboard-loading"/);
		assert.match(html, /System Information/);
		assert.match(html, /Latest Screen/);
		assert.match(html, /System Status/);
		assert.match(html, /Recent System Logs/);
		assert.match(html, /Online Devices/);
		assert.match(html, /Offline Devices/);
		assert.match(html, /Overview of all connected devices/);
		assert.match(html, /Latest system events and alerts/);
		assert.equal((html.match(/animate-pulse/g) || []).length >= 15, true);
	});
});
