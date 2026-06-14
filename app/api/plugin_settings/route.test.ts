import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	proxyToTRMNL: vi.fn(),
}));

vi.mock("@/lib/api/proxy", () => ({
	proxyToTRMNL: state.proxyToTRMNL,
}));

const loadRoute = () => import("./route");

describe("app/api/plugin_settings route wrappers", () => {
	beforeEach(() => {
		vi.resetModules();
		state.proxyToTRMNL.mockReset();
		state.proxyToTRMNL.mockResolvedValue(new Response(null, { status: 204 }));
	});

	it("forwards GET requests to the TRMNL plugin settings endpoint", async () => {
		const { GET } = await loadRoute();
		const request = new Request("https://example.test/api/plugin_settings");

		await GET(request);

		expect(state.proxyToTRMNL).toHaveBeenCalledWith(
			"/api/plugin_settings",
			"GET",
			request,
			{ forwardAuth: true },
		);
	});

	it("forwards POST requests with a parsed JSON body", async () => {
		const { POST } = await loadRoute();
		const request = new Request("https://example.test/api/plugin_settings", {
			method: "POST",
			body: JSON.stringify({ name: "Weather" }),
		});

		await POST(request);

		expect(state.proxyToTRMNL).toHaveBeenCalledWith(
			"/api/plugin_settings",
			"POST",
			request,
			{
				forwardAuth: true,
				body: { name: "Weather" },
			},
		);
	});
});
