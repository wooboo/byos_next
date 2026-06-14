import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	generateApiKey: vi.fn(),
	generateFriendlyId: vi.fn(),
	logError: vi.fn(),
	logInfo: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
	logError: state.logError,
	logInfo: state.logInfo,
}));

vi.mock("@/utils/helpers", () => ({
	generateApiKey: state.generateApiKey,
	generateFriendlyId: state.generateFriendlyId,
}));

const loadModule = () => import("./device-api-key");

describe("app/api/device-api-key", () => {
	beforeEach(() => {
		vi.resetModules();
		state.generateApiKey.mockReset();
		state.generateFriendlyId.mockReset();
		state.logError.mockReset();
		state.logInfo.mockReset();
	});

	it("derives a deterministic mock MAC address from an API key", async () => {
		const { generateMockMacAddress } = await loadModule();

		expect(generateMockMacAddress("api-123")).toBe("A1:B2:C3:74:D9:8C");
	});

	it("creates a mock identity using the provided MAC address and API key", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2024-03-04T05:06:07.000Z"));
		state.generateFriendlyId.mockReturnValue("friendly-1");
		const { createMockDeviceIdentity } = await loadModule();

		const identity = createMockDeviceIdentity("api-123", "AA:BB:CC");

		expect(identity).toEqual({
			mockMacAddress: "A1:B2:C3:74:D9:8C",
			friendlyId: "friendly-1",
			apiKey: "api-123",
		});
		expect(state.generateFriendlyId).toHaveBeenCalledWith(
			"A1:B2:C3:74:D9:8C",
			"20240304T050607.000",
		);
		vi.useRealTimers();
	});

	it("generates a new API key when the logger did not send a MAC address", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2024-03-04T05:06:07.000Z"));
		state.generateFriendlyId.mockReturnValue("friendly-2");
		state.generateApiKey.mockReturnValue("generated-api");
		const { createMockDeviceIdentity } = await loadModule();

		const identity = createMockDeviceIdentity("api-123", null);

		expect(identity).toEqual({
			mockMacAddress: "A1:B2:C3:74:D9:8C",
			friendlyId: "friendly-2",
			apiKey: "generated-api",
		});
		expect(state.generateApiKey).toHaveBeenCalledWith(
			"A1:B2:C3:74:D9:8C",
			"20240304T050607.000",
		);
		vi.useRealTimers();
	});

	it("updates the device MAC address and logs success for known API keys", async () => {
		const execute = vi.fn().mockResolvedValue(undefined);
		const database = {
			selectFrom: vi.fn(() => ({
				selectAll() {
					return this;
				},
				where: vi.fn(() => ({
					executeTakeFirst: vi.fn().mockResolvedValue({
						friendly_id: "device-1",
						api_key: "api-123",
					}),
				})),
			})),
			updateTable: vi.fn(() => ({
				set() {
					return this;
				},
				where() {
					return this;
				},
				execute,
			})),
		};
		const { findDeviceByApiKeyAndUpdateMac } = await loadModule();

		const device = await findDeviceByApiKeyAndUpdateMac(database as never, {
			apiKey: "api-123",
			macAddress: "AA:BB:CC",
			source: "api/log",
			successMessage: "Updated logger device",
		});

		expect(device).toEqual({
			friendly_id: "device-1",
			api_key: "api-123",
		});
		expect(execute).toHaveBeenCalled();
		expect(state.logInfo).toHaveBeenCalledWith(
			"Updated logger device",
			expect.objectContaining({
				source: "api/log",
				metadata: {
					device_id: "device-1",
					mac_address: "AA:BB:CC",
					has_api_key: true,
				},
			}),
		);
	});

	it("logs update failures but still returns the matched device", async () => {
		const database = {
			selectFrom: vi.fn(() => ({
				selectAll() {
					return this;
				},
				where: vi.fn(() => ({
					executeTakeFirst: vi.fn().mockResolvedValue({
						friendly_id: "device-9",
						api_key: "api-999",
					}),
				})),
			})),
			updateTable: vi.fn(() => ({
				set() {
					return this;
				},
				where() {
					return this;
				},
				execute: vi.fn().mockRejectedValue(new Error("write failed")),
			})),
		};
		const { findDeviceByApiKeyAndUpdateMac } = await loadModule();

		const device = await findDeviceByApiKeyAndUpdateMac(database as never, {
			apiKey: "api-999",
			macAddress: "AA:BB:CC",
			source: "api/setup",
			successMessage: "Updated device MAC address",
		});

		expect(device).toEqual({
			friendly_id: "device-9",
			api_key: "api-999",
		});
		expect(state.logError).toHaveBeenCalledWith(
			expect.any(Error),
			expect.objectContaining({
				source: "api/setup",
				metadata: expect.objectContaining({
					device_id: "device-9",
					mac_address: "AA:BB:CC",
					has_api_key: true,
				}),
			}),
		);
	});
});
