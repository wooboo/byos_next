import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	proxyToTRMNL: vi.fn(),
}));

vi.mock("@/lib/api/proxy", () => ({
	proxyToTRMNL: state.proxyToTRMNL,
}));

const loadProxy = () => import("./proxy");

describe("app/api/plugin_settings/[id]/proxy", () => {
	beforeEach(() => {
		vi.resetModules();
		state.proxyToTRMNL.mockReset();
	});

	it("builds the TRMNL endpoint path and forwards auth for proxied requests", async () => {
		const proxiedResponse = new Response(null, { status: 204 });
		state.proxyToTRMNL.mockResolvedValue(proxiedResponse);
		const { proxyPluginSetting } = await loadProxy();
		const request = new Request("https://example.test/api/plugin_settings/abc");

		const response = await proxyPluginSetting(
			request,
			{ params: Promise.resolve({ id: "abc" }) },
			"/data",
			"DELETE",
		);

		expect(response).toBe(proxiedResponse);
		expect(state.proxyToTRMNL).toHaveBeenCalledWith(
			"/api/plugin_settings/abc/data",
			"DELETE",
			request,
			{
				forwardAuth: true,
			},
		);
	});

	it("exposes the route path helper for nested plugin setting resources", async () => {
		const { pluginSettingPath } = await loadProxy();

		await expect(
			pluginSettingPath(
				{ params: Promise.resolve({ id: "setting-9" }) },
				"/archive",
			),
		).resolves.toBe("/api/plugin_settings/setting-9/archive");
	});
});
