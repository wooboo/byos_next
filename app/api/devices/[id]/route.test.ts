import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	checkDbConnection: vi.fn(),
	findDeviceByIdOrFriendlyId: vi.fn(),
	logError: vi.fn(),
	logInfo: vi.fn(),
	toDeviceApiData: vi.fn(),
	withUserScope: vi.fn(),
}));

vi.mock("../devices-api", () => ({
	findDeviceByIdOrFriendlyId: state.findDeviceByIdOrFriendlyId,
	toDeviceApiData: state.toDeviceApiData,
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

describe("app/api/devices/[id] GET", () => {
	beforeEach(() => {
		vi.resetModules();
		state.checkDbConnection.mockReset();
		state.findDeviceByIdOrFriendlyId.mockReset();
		state.logError.mockReset();
		state.logInfo.mockReset();
		state.toDeviceApiData.mockReset();
		state.withUserScope.mockReset();
	});

	it("returns 404 when the device does not exist", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.withUserScope.mockImplementation(async (runQuery) =>
			runQuery({} as never),
		);
		state.findDeviceByIdOrFriendlyId.mockResolvedValue(null);
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/devices/abc"),
			{
				params: Promise.resolve({ id: "abc" }),
			},
		);

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({
			error: "Device not found",
		});
		expect(state.findDeviceByIdOrFriendlyId).toHaveBeenCalledWith({}, "abc");
	});

	it("returns 503 when the database is unavailable", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: false });
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/devices/abc"),
			{
				params: Promise.resolve({ id: "abc" }),
			},
		);

		expect(response.status).toBe(503);
		await expect(response.json()).resolves.toEqual({
			error: "Database not available",
		});
		expect(state.logInfo).toHaveBeenCalledWith(
			"Database not available for /api/devices/{id}",
			expect.objectContaining({
				source: "api/devices/[id]",
				metadata: { id: "abc" },
			}),
		);
		expect(state.withUserScope).not.toHaveBeenCalled();
	});

	it("returns 500 and logs when device lookup fails", async () => {
		const error = new Error("lookup failed");
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.withUserScope.mockRejectedValue(error);
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/devices/abc"),
			{
				params: Promise.resolve({ id: "abc" }),
			},
		);

		expect(response.status).toBe(500);
		await expect(response.json()).resolves.toEqual({
			error: "Internal server error",
		});
		expect(state.logError).toHaveBeenCalledWith(
			error,
			expect.objectContaining({
				source: "api/devices/[id]",
				metadata: { id: "abc" },
			}),
		);
	});

	it("returns transformed device data for an existing device", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.withUserScope.mockImplementation(async (runQuery) =>
			runQuery({ scoped: true } as never),
		);
		state.findDeviceByIdOrFriendlyId.mockResolvedValue({ id: "9" });
		state.toDeviceApiData.mockReturnValue({ id: 9, friendly_id: "office-9" });
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/devices/9"),
			{
				params: Promise.resolve({ id: "9" }),
			},
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			data: { id: 9, friendly_id: "office-9" },
		});
		expect(state.logInfo).toHaveBeenCalledWith(
			"Device data request successful",
			expect.objectContaining({
				source: "api/devices/[id]",
				metadata: { deviceId: "9" },
			}),
		);
	});
});
