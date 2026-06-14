import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	checkDbConnection: vi.fn(),
	logError: vi.fn(),
	logInfo: vi.fn(),
	withUserScope: vi.fn(),
}));

vi.mock("@/lib/database/scoped-db", () => ({
	withUserScope: state.withUserScope,
}));

vi.mock("@/lib/database/utils", () => ({
	checkDbConnection: state.checkDbConnection,
}));

vi.mock("@/lib/logger", () => ({
	logError: state.logError,
	logInfo: state.logInfo,
}));

const loadRoute = () => import("./route");

describe("app/api/devices GET", () => {
	beforeEach(() => {
		vi.resetModules();
		state.checkDbConnection.mockReset();
		state.logError.mockReset();
		state.logInfo.mockReset();
		state.withUserScope.mockReset();
	});

	it("returns 503 when the database is unavailable", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: false });
		const { GET } = await loadRoute();

		const response = await GET(new Request("https://example.test/api/devices"));

		expect(response.status).toBe(503);
		await expect(response.json()).resolves.toEqual({
			error: "Database not available",
		});
		expect(state.withUserScope).not.toHaveBeenCalled();
	});

	it("returns transformed device data", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.withUserScope.mockImplementation(async (runQuery) =>
			runQuery({
				selectFrom: vi.fn(() => ({
					selectAll() {
						return this;
					},
					orderBy() {
						return this;
					},
					execute: vi.fn().mockResolvedValue([
						{
							id: "11",
							name: "Office",
							friendly_id: "office-11",
							mac_address: "AA:BB",
							battery_voltage: "4.2",
							rssi: -30,
						},
					]),
				})),
			} as never),
		);
		const { GET } = await loadRoute();

		const response = await GET(new Request("https://example.test/api/devices"));

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			data: [
				{
					id: 11,
					name: "Office",
					friendly_id: "office-11",
					mac_address: "AA:BB",
					battery_voltage: 4.2,
					rssi: -30,
					percent_charged: 100,
					wifi_strength: 100,
				},
			],
		});
		expect(state.logInfo).toHaveBeenCalledWith(
			"Devices list request successful",
			expect.objectContaining({
				source: "api/devices",
				metadata: { count: 1 },
			}),
		);
	});
});
