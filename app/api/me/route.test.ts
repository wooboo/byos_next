import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	logInfo: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
	logInfo: state.logInfo,
}));

const loadRoute = () => import("./route");

describe("app/api/me GET", () => {
	beforeEach(() => {
		vi.resetModules();
		state.logInfo.mockReset();
	});

	it("returns the stub user without an API key", async () => {
		const { GET } = await loadRoute();

		const response = await GET(new Request("https://example.test/api/me"));

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			data: {
				id: 0,
				name: "BYOS User",
				email: null,
				first_name: null,
				last_name: null,
				locale: "en",
				time_zone: "UTC",
				time_zone_iana: "UTC",
				utc_offset: 0,
				api_key: null,
			},
		});
		expect(state.logInfo).toHaveBeenCalledWith("User data request", {
			source: "api/me",
			metadata: { hasAuth: false },
		});
	});

	it("echoes the bearer token into the compatibility payload", async () => {
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/me", {
				headers: {
					Authorization: "Bearer api-123",
				},
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual(
			expect.objectContaining({
				data: expect.objectContaining({
					api_key: "api-123",
				}),
			}),
		);
		expect(state.logInfo).toHaveBeenCalledWith("User data request", {
			source: "api/me",
			metadata: { hasAuth: true },
		});
	});
});
