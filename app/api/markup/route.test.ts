import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	isProxyLive: vi.fn(),
	parseAndRender: vi.fn(),
	proxyToTRMNL: vi.fn(),
	registerCustomFilters: vi.fn(),
	removeCosmeticParens: vi.fn((markup: string) => `clean(${markup})`),
	wrapNonLiquidScripts: vi.fn((markup: string) => `wrapped(${markup})`),
}));

vi.mock("liquidjs", () => ({
	Liquid: class {
		parseAndRender = state.parseAndRender;
	},
}));

vi.mock("@/lib/api/proxy", () => ({
	proxyToTRMNL: state.proxyToTRMNL,
}));

vi.mock("@/lib/recipes/liquid-renderer", () => ({
	registerCustomFilters: state.registerCustomFilters,
	removeCosmeticParens: state.removeCosmeticParens,
	wrapNonLiquidScripts: state.wrapNonLiquidScripts,
}));

vi.mock("@/lib/trmnl/registry", () => ({
	isProxyLive: state.isProxyLive,
}));

const loadRoute = () => import("./route");

describe("app/api/markup POST", () => {
	beforeEach(() => {
		vi.resetModules();
		state.isProxyLive.mockReset();
		state.parseAndRender.mockReset();
		state.proxyToTRMNL.mockReset();
		state.registerCustomFilters.mockReset();
		state.removeCosmeticParens.mockClear();
		state.wrapNonLiquidScripts.mockClear();
	});

	it("proxies directly when the live TRMNL proxy is enabled", async () => {
		state.isProxyLive.mockReturnValue(true);
		state.proxyToTRMNL.mockResolvedValue(new Response(null, { status: 204 }));
		const { POST } = await loadRoute();
		const request = new Request("https://example.test/api/markup", {
			method: "POST",
			headers: {
				Authorization: "Bearer token",
			},
			body: JSON.stringify({ markup: "<div />" }),
		});

		await POST(request);

		expect(state.proxyToTRMNL).toHaveBeenCalledWith(
			"/api/markup",
			"POST",
			expect.any(Request),
			{
				body: { markup: "<div />" },
			},
		);
		const forwardedRequest = state.proxyToTRMNL.mock.calls[0]?.[2] as Request;
		expect(forwardedRequest).not.toBe(request);
		expect(forwardedRequest.headers.get("Authorization")).toBe("Bearer token");
	});

	it("returns 400 for an invalid JSON body", async () => {
		state.isProxyLive.mockReturnValue(false);
		const { POST } = await loadRoute();

		const response = await POST(
			new Request("https://example.test/api/markup", {
				method: "POST",
				body: "{",
			}),
		);

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			error: "Invalid JSON body",
		});
	});

	it("falls back to the TRMNL proxy when markup is missing", async () => {
		state.isProxyLive.mockReturnValue(false);
		state.proxyToTRMNL.mockResolvedValue(new Response(null, { status: 200 }));
		const { POST } = await loadRoute();
		const request = new Request("https://example.test/api/markup", {
			method: "POST",
			body: JSON.stringify({ variables: { city: "Warsaw" } }),
		});

		await POST(request);

		expect(state.proxyToTRMNL).toHaveBeenCalledWith(
			"/api/markup",
			"POST",
			expect.any(Request),
			{
				body: { variables: { city: "Warsaw" } },
			},
		);
	});

	it("renders recognized markup locally", async () => {
		state.isProxyLive.mockReturnValue(false);
		state.parseAndRender.mockResolvedValue("<p>Rendered</p>");
		const { POST } = await loadRoute();

		const response = await POST(
			new Request("https://example.test/api/markup", {
				method: "POST",
				body: JSON.stringify({
					markup: "<script>text</script>",
					variables: { city: "Warsaw" },
				}),
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			data: "<p>Rendered</p>",
		});
		expect(state.registerCustomFilters).toHaveBeenCalledTimes(1);
		expect(state.wrapNonLiquidScripts).toHaveBeenCalledWith(
			"<script>text</script>",
		);
		expect(state.removeCosmeticParens).toHaveBeenCalledWith(
			"wrapped(<script>text</script>)",
		);
		expect(state.parseAndRender).toHaveBeenCalledWith(
			"clean(wrapped(<script>text</script>))",
			{
				city: "Warsaw",
			},
		);
	});

	it("returns a 422 payload when local Liquid rendering fails", async () => {
		state.isProxyLive.mockReturnValue(false);
		state.parseAndRender.mockRejectedValue(new Error("bad filter"));
		const { POST } = await loadRoute();

		const response = await POST(
			new Request("https://example.test/api/markup", {
				method: "POST",
				body: JSON.stringify({ markup: "{{ broken }}" }),
			}),
		);

		expect(response.status).toBe(422);
		await expect(response.json()).resolves.toEqual({
			error: "Failed to render Liquid template",
			message: "bad filter",
		});
	});
});
