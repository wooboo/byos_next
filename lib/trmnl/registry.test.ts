import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	clock: 0,
	fetch: vi.fn(),
	readFile: vi.fn(),
	writeFile: vi.fn(),
	mkdir: vi.fn(),
}));

async function loadRegistry() {
	vi.resetModules();
	vi.doMock("node:fs/promises", () => ({
		default: {
			readFile: state.readFile,
			writeFile: state.writeFile,
			mkdir: state.mkdir,
		},
	}));
	vi.spyOn(Date, "now").mockImplementation(() => state.clock);
	globalThis.fetch = state.fetch as typeof globalThis.fetch;
	return import("./registry");
}

describe("trmnl registry", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.resetModules();
		delete process.env.TRMNL_PROXY_LIVE;
		state.clock = 0;
		state.fetch.mockReset();
		state.readFile.mockReset();
		state.writeFile.mockReset();
		state.mkdir.mockReset();
	});

	it("caches upstream registry data within the ttl", async () => {
		state.fetch.mockResolvedValue(
			Response.json([{ id: "palette-1" }], { status: 200 }),
		);
		const { getRegistry } = await loadRegistry();

		const first = await getRegistry("palettes");
		state.clock = 1_000;
		const second = await getRegistry("palettes");

		expect(first).toEqual([{ id: "palette-1" }]);
		expect(second).toEqual(first);
		expect(state.fetch).toHaveBeenCalledTimes(1);
		expect(state.writeFile).toHaveBeenCalledTimes(1);
	});

	it("falls back to the snapshot when upstream refresh fails", async () => {
		state.fetch.mockRejectedValue(new Error("offline"));
		state.readFile.mockResolvedValue('[{"id":"model-1"}]');
		const { getRegistry } = await loadRegistry();

		await expect(getRegistry("models")).resolves.toEqual([{ id: "model-1" }]);
		expect(state.readFile).toHaveBeenCalledTimes(1);
	});

	it("proxies every request when live proxy mode is enabled", async () => {
		process.env.TRMNL_PROXY_LIVE = "true";
		state.fetch
			.mockResolvedValueOnce(Response.json([{ id: "first" }], { status: 200 }))
			.mockResolvedValueOnce(
				Response.json([{ id: "second" }], { status: 200 }),
			);
		const { getRegistry, isProxyLive } = await loadRegistry();

		await expect(getRegistry("categories")).resolves.toEqual([{ id: "first" }]);
		await expect(getRegistry("categories")).resolves.toEqual([
			{ id: "second" },
		]);

		expect(isProxyLive()).toBe(true);
		expect(state.fetch).toHaveBeenCalledTimes(2);
		expect(state.writeFile).not.toHaveBeenCalled();
	});

	it("deduplicates concurrent refreshes for the same resource", async () => {
		let resolveResponse: (response: Response) => void = () => {};
		state.fetch.mockReturnValue(
			new Promise<Response>((resolve) => {
				resolveResponse = resolve;
			}),
		);
		const { getRegistry } = await loadRegistry();

		const first = getRegistry("palettes");
		const second = getRegistry("palettes");
		resolveResponse(Response.json([{ id: "shared" }], { status: 200 }));

		await expect(Promise.all([first, second])).resolves.toEqual([
			[{ id: "shared" }],
			[{ id: "shared" }],
		]);
		expect(state.fetch).toHaveBeenCalledTimes(1);
	});

	it("surfaces upstream status errors when no snapshot exists", async () => {
		state.fetch.mockResolvedValue(
			Response.json({ error: "nope" }, { status: 503 }),
		);
		state.readFile.mockRejectedValue(new Error("missing"));
		const { registryResponse } = await loadRegistry();

		const response = await registryResponse("models");

		expect(response.status).toBe(502);
		await expect(response.json()).resolves.toEqual({
			error: "Failed to load models registry",
			message: "TRMNL /api/models returned 503",
		});
	});

	it("returns a 502 response when no upstream or snapshot data is available", async () => {
		state.fetch.mockRejectedValue(new Error("offline"));
		state.readFile.mockRejectedValue(new Error("missing"));
		const { registryResponse } = await loadRegistry();

		const response = await registryResponse("ips");

		expect(response.status).toBe(502);
		await expect(response.json()).resolves.toEqual({
			error: "Failed to load ips registry",
			message: "offline",
		});
	});
});
