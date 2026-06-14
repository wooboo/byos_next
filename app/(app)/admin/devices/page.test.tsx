import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";

const devicesPageState = vi.hoisted(() => ({
	renderCount: 0,
}));

vi.mock("./client-page", () => ({
	default: () => {
		devicesPageState.renderCount += 1;
		return <div>admin-devices-client</div>;
	},
}));

type DevicesPageModule = typeof import("./page.tsx");
let moduleCache: DevicesPageModule | null = null;

async function getPage() {
	if (!moduleCache) {
		moduleCache = await import("./page.tsx");
	}
	return moduleCache;
}

describe("Admin devices page", () => {
	it("renders the client page wrapper and metadata", async () => {
		devicesPageState.renderCount = 0;

		const module = await getPage();
		const html = renderToStaticMarkup(module.default());

		assert.match(html, /admin-devices-client/);
		assert.equal(devicesPageState.renderCount, 1);
		assert.equal(module.metadata.title, "Device Management");
		assert.equal(
			module.metadata.description,
			"Manage all devices across users",
		);
	});
});
