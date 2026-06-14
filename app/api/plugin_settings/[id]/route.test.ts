import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	pluginSettingPath: vi.fn(),
	proxyPluginSetting: vi.fn(),
	proxyToTRMNL: vi.fn(),
	proxyToTRMNLMultipart: vi.fn(),
}));

vi.mock("@/lib/api/proxy", () => ({
	proxyToTRMNL: state.proxyToTRMNL,
	proxyToTRMNLMultipart: state.proxyToTRMNLMultipart,
}));

vi.mock("./proxy", () => ({
	pluginSettingPath: state.pluginSettingPath,
	proxyPluginSetting: state.proxyPluginSetting,
}));

const loadDeleteRoute = () => import("./route");
const loadDataRoute = () => import("./data/route");
const loadArchiveRoute = () => import("./archive/route");

describe("app/api/plugin_settings/[id] wrappers", () => {
	beforeEach(() => {
		vi.resetModules();
		state.pluginSettingPath.mockReset();
		state.proxyPluginSetting.mockReset();
		state.proxyToTRMNL.mockReset();
		state.proxyToTRMNLMultipart.mockReset();
		state.proxyPluginSetting.mockResolvedValue(
			new Response(null, { status: 204 }),
		);
		state.proxyToTRMNL.mockResolvedValue(new Response(null, { status: 200 }));
		state.proxyToTRMNLMultipart.mockResolvedValue(
			new Response(null, { status: 201 }),
		);
	});

	it("delegates DELETE to proxyPluginSetting", async () => {
		const { DELETE } = await loadDeleteRoute();
		const request = new Request("https://example.test/api/plugin_settings/17");
		const params = { params: Promise.resolve({ id: "17" }) };

		await DELETE(request, params);

		expect(state.proxyPluginSetting).toHaveBeenCalledWith(
			request,
			params,
			"",
			"DELETE",
		);
	});

	it("delegates GET /data to proxyPluginSetting", async () => {
		const { GET } = await loadDataRoute();
		const request = new Request(
			"https://example.test/api/plugin_settings/17/data",
		);
		const params = { params: Promise.resolve({ id: "17" }) };

		await GET(request, params);

		expect(state.proxyPluginSetting).toHaveBeenCalledWith(
			request,
			params,
			"/data",
		);
	});

	it("forwards POST /data with the parsed body and auth", async () => {
		const { POST } = await loadDataRoute();
		const request = new Request(
			"https://example.test/api/plugin_settings/17/data",
			{
				method: "POST",
				body: JSON.stringify({ enabled: true }),
			},
		);

		await POST(request, { params: Promise.resolve({ id: "17" }) });

		expect(state.proxyToTRMNL).toHaveBeenCalledWith(
			"/api/plugin_settings/17/data",
			"POST",
			request,
			{
				forwardAuth: true,
				body: { enabled: true },
			},
		);
	});

	it("delegates GET /archive to proxyPluginSetting", async () => {
		const { GET } = await loadArchiveRoute();
		const request = new Request(
			"https://example.test/api/plugin_settings/17/archive",
		);
		const params = { params: Promise.resolve({ id: "17" }) };

		await GET(request, params);

		expect(state.proxyPluginSetting).toHaveBeenCalledWith(
			request,
			params,
			"/archive",
		);
	});

	it("forwards POST /archive as multipart using the resolved path", async () => {
		state.pluginSettingPath.mockResolvedValue(
			"/api/plugin_settings/17/archive",
		);
		const { POST } = await loadArchiveRoute();
		const params = { params: Promise.resolve({ id: "17" }) };
		const form = new FormData();
		form.set("file", new Blob(["zip"]), "plugin.zip");
		const request = new Request(
			"https://example.test/api/plugin_settings/17/archive",
			{
				method: "POST",
				body: form,
			},
		);

		await POST(request, params);

		expect(state.pluginSettingPath).toHaveBeenCalledWith(params, "/archive");
		expect(state.proxyToTRMNLMultipart).toHaveBeenCalledWith(
			"/api/plugin_settings/17/archive",
			request,
			{ forwardAuth: true },
		);
	});
});
