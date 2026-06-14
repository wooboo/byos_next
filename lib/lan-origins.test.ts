import { afterEach, describe, expect, it, vi } from "vitest";

const networkInterfacesMock = vi.hoisted(() => vi.fn());

vi.mock("os", () => ({
	networkInterfaces: networkInterfacesMock,
}));

async function loadModule() {
	vi.resetModules();
	return import("./lan-origins");
}

describe("lan origins", () => {
	afterEach(() => {
		vi.clearAllMocks();
		delete process.env.PORT;
		delete process.env.NEXT_PUBLIC_PORT;
		delete process.env.BETTER_AUTH_URL;
		delete process.env.ALLOWED_SERVER_ACTION_ORIGINS;
	});

	it("builds trusted origins from loopback, LAN hosts, auth URL, and explicit origins", async () => {
		networkInterfacesMock.mockReturnValue({
			en0: [
				{ family: "IPv4", internal: false, address: "192.168.1.25" },
				{ family: "IPv6", internal: false, address: "fe80::1" },
			],
			lo0: [{ family: "IPv4", internal: true, address: "127.0.0.1" }],
		});
		process.env.PORT = "4321";
		process.env.NEXT_PUBLIC_PORT = "4322";
		process.env.BETTER_AUTH_URL = "https://auth.example.com";
		process.env.ALLOWED_SERVER_ACTION_ORIGINS =
			"screen.local:5555, https://already.example:8080";

		const { getLanTrustedOrigins } = await loadModule();

		expect(getLanTrustedOrigins()).toEqual([
			"http://localhost:4321",
			"http://localhost:4322",
			"http://localhost:3000",
			"http://localhost:3001",
			"http://127.0.0.1:4321",
			"http://127.0.0.1:4322",
			"http://127.0.0.1:3000",
			"http://127.0.0.1:3001",
			"http://192.168.1.25:4321",
			"http://192.168.1.25:4322",
			"http://192.168.1.25:3000",
			"http://192.168.1.25:3001",
			"https://auth.example.com",
			"http://screen.local:5555",
			"https://already.example:8080",
		]);
	});

	it("expands configured server action hosts across known ports and preserves explicit ports", async () => {
		networkInterfacesMock.mockReturnValue({
			en0: [{ family: "IPv4", internal: false, address: "10.0.0.5" }],
		});
		process.env.PORT = "4100";
		process.env.ALLOWED_SERVER_ACTION_ORIGINS =
			"panel.local, https://api.example:9443";

		const { getLanServerActionOrigins } = await loadModule();

		expect(getLanServerActionOrigins()).toEqual([
			"localhost:4100",
			"localhost:3001",
			"localhost:3000",
			"127.0.0.1:4100",
			"127.0.0.1:3001",
			"127.0.0.1:3000",
			"0.0.0.0:4100",
			"0.0.0.0:3001",
			"0.0.0.0:3000",
			"10.0.0.5:4100",
			"10.0.0.5:3001",
			"10.0.0.5:3000",
			"panel.local:4100",
			"panel.local:3001",
			"panel.local:3000",
			"api.example:9443",
		]);
	});
});
