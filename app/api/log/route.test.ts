import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	checkDbConnection: vi.fn(),
	createMockDeviceIdentity: vi.fn(),
	findDeviceByApiKeyAndUpdateMac: vi.fn(),
	generateFriendlyId: vi.fn(),
	generateMockMacAddress: vi.fn(),
	getCurrentUserId: vi.fn(),
	logError: vi.fn(),
	logInfo: vi.fn(),
	db: {
		insertInto: vi.fn(),
		selectFrom: vi.fn(),
		updateTable: vi.fn(),
	},
}));

vi.mock("@/app/api/device-api-key", () => ({
	createMockDeviceIdentity: state.createMockDeviceIdentity,
	findDeviceByApiKeyAndUpdateMac: state.findDeviceByApiKeyAndUpdateMac,
	generateMockMacAddress: state.generateMockMacAddress,
}));

vi.mock("@/lib/auth/get-user", () => ({
	getCurrentUserId: state.getCurrentUserId,
}));

vi.mock("@/lib/database/db", () => ({
	db: state.db,
}));

vi.mock("@/lib/database/utils", () => ({
	checkDbConnection: state.checkDbConnection,
}));

vi.mock("@/lib/logger", () => ({
	logError: state.logError,
	logInfo: state.logInfo,
}));

vi.mock("@/utils/helpers", () => ({
	generateFriendlyId: state.generateFriendlyId,
}));

const loadRoute = () => import("./route");

function makeSelectAllBuilder(result: unknown) {
	return {
		selectAll() {
			return this;
		},
		where() {
			return this;
		},
		executeTakeFirst: vi.fn().mockResolvedValue(result),
	};
}

function makeUpdateTableBuilder() {
	const execute = vi.fn().mockResolvedValue(undefined);
	return {
		builder: {
			set() {
				return this;
			},
			where() {
				return this;
			},
			execute,
		},
		execute,
	};
}

describe("app/api/log route", () => {
	beforeEach(() => {
		vi.resetModules();
		state.checkDbConnection.mockReset();
		state.createMockDeviceIdentity.mockReset();
		state.findDeviceByApiKeyAndUpdateMac.mockReset();
		state.generateFriendlyId.mockReset();
		state.generateMockMacAddress.mockReset();
		state.getCurrentUserId.mockReset();
		state.logError.mockReset();
		state.logInfo.mockReset();
		state.db.insertInto.mockReset();
		state.db.selectFrom.mockReset();
		state.db.updateTable.mockReset();
	});

	it("rejects GET requests with a 404 payload", async () => {
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/log?foo=1"),
		);

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({
			status: 404,
			message: "Not found",
		});
	});

	it("requires an Access-Token header for POST requests", async () => {
		const { POST } = await loadRoute();

		const response = await POST(
			new Request("https://example.test/api/log", {
				method: "POST",
				headers: {
					ID: "aa:bb:cc",
				},
				body: JSON.stringify({ logs: [] }),
			}),
		);

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toEqual({
			error: "Access-Token header is required",
		});
		expect(state.checkDbConnection).not.toHaveBeenCalled();
	});

	it("acknowledges logs in no-db mode without touching persistence", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: false });
		const { POST } = await loadRoute();

		const response = await POST(
			new Request("https://example.test/api/log", {
				method: "POST",
				headers: {
					"Access-Token": "api-123",
					ID: "aa:bb:cc",
					"Refresh-Rate": "120",
					"Battery-Voltage": "3.61",
					"FW-Version": "1.0.0",
					RSSI: "-55",
				},
				body: JSON.stringify({ logs: [] }),
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			status: 200,
			message: "Log received",
		});
		expect(state.getCurrentUserId).not.toHaveBeenCalled();
		expect(state.logInfo).toHaveBeenCalledWith(
			"Database client not initialized, using noDB mode, skipping log processing",
			expect.objectContaining({
				source: "api/log",
				metadata: expect.objectContaining({
					macAddress: "AA:BB:CC",
					hasApiKey: true,
					refreshRate: "120",
					batteryVoltage: "3.61",
					fwVersion: "1.0.0",
					rssi: "-55",
				}),
			}),
		);
	});

	it("saves logs for a known device resolved by API key", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue(null);

		const executeTakeFirst = vi.fn().mockResolvedValueOnce({
			friendly_id: "device-1",
			api_key: "api-123",
			mac_address: "AA:BB:CC",
			user_id: "user-1",
			battery_voltage: 3.3,
			firmware_version: "1.0.0",
			rssi: -70,
		});
		state.db.selectFrom.mockReturnValue({
			selectAll() {
				return this;
			},
			where: vi.fn(() => ({
				executeTakeFirst,
			})),
		});
		const updateExecute = vi.fn().mockResolvedValue(undefined);
		state.db.updateTable.mockReturnValue({
			set() {
				return this;
			},
			where() {
				return this;
			},
			execute: updateExecute,
		});
		const insertExecute = vi.fn().mockResolvedValueOnce(undefined);
		state.db.insertInto.mockImplementation((table: string) => {
			if (table === "logs") {
				return {
					values: vi.fn((payload) => ({
						execute: vi.fn(async () => {
							expect(payload).toEqual({
								friendly_id: "device-1",
								log_data: expect.stringContaining('"message":"hello"'),
							});
							return insertExecute();
						}),
					})),
				};
			}

			return {
				values: vi.fn(() => ({
					returningAll: vi.fn(() => ({
						executeTakeFirst: vi.fn(),
					})),
				})),
			};
		});
		const { POST } = await loadRoute();

		const response = await POST(
			new Request("https://example.test/api/log", {
				method: "POST",
				headers: {
					"Access-Token": "api-123",
					ID: "aa:bb:cc",
					"Refresh-Rate": "120",
				},
				body: JSON.stringify({ logs: ["hello"] }),
			}),
		);

		expect(response.status).toBe(204);
		expect(updateExecute).toHaveBeenCalled();
		expect(insertExecute).toHaveBeenCalled();
		expect(state.logInfo).toHaveBeenCalledWith(
			"Log saved successfully",
			expect.objectContaining({
				source: "api/log",
				metadata: expect.objectContaining({
					device_id: "device-1",
					logs_count: 1,
					device_status: "known",
				}),
			}),
		);
	});

	it("returns a compatibility error when an unknown logger cannot be auto-provisioned", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue(null);
		state.generateMockMacAddress.mockReturnValue("MOCK:AA");
		state.db.selectFrom.mockReturnValue({
			selectAll() {
				return this;
			},
			where: vi.fn(() => ({
				executeTakeFirst: vi.fn().mockResolvedValue(undefined),
			})),
		});
		const { POST } = await loadRoute();

		const response = await POST(
			new Request("https://example.test/api/log", {
				method: "POST",
				headers: {
					"Access-Token": "api-unknown",
				},
				body: JSON.stringify({ logs: [] }),
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			status: 400,
			message: "Device owner is required before logs can be accepted",
		});
		expect(state.createMockDeviceIdentity).not.toHaveBeenCalled();
	});

	it("returns a compatibility auth error when a MAC-matched device belongs to someone else", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue(null);
		state.db.selectFrom.mockReturnValueOnce(
			makeSelectAllBuilder({
				friendly_id: "device-9",
				api_key: "api-old",
				mac_address: "AA:BB:CC",
				user_id: "user-9",
				battery_voltage: 3.3,
				firmware_version: "1.0.0",
				rssi: -70,
			}),
		);
		const { POST } = await loadRoute();

		const response = await POST(
			new Request("https://example.test/api/log", {
				method: "POST",
				headers: {
					"Access-Token": "api-new",
					ID: "aa:bb:cc",
				},
				body: JSON.stringify({ logs: [] }),
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			status: 401,
			message: "Valid access token required for registered device",
		});
		expect(state.logError).toHaveBeenCalledWith(
			"Refusing logs for device without owner or valid access token",
			expect.any(Object),
		);
	});

	it("returns 422 for an invalid request body after authenticating the device", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue(null);
		state.db.selectFrom.mockReturnValueOnce(
			makeSelectAllBuilder({
				friendly_id: "device-10",
				api_key: "api-123",
				mac_address: "AA:BB:CC",
				user_id: "user-1",
				battery_voltage: 3.3,
				firmware_version: "1.0.0",
				rssi: -70,
			}),
		);
		const update = makeUpdateTableBuilder();
		state.db.updateTable.mockReturnValue(update.builder);
		const { POST } = await loadRoute();

		const response = await POST(
			new Request("https://example.test/api/log", {
				method: "POST",
				headers: {
					"Access-Token": "api-123",
				},
				body: JSON.stringify({ foo: [] }),
			}),
		);

		expect(response.status).toBe(422);
		await expect(response.json()).resolves.toEqual({
			error: "Invalid request body. Expected { 'logs': [] }",
		});
		expect(state.db.insertInto).not.toHaveBeenCalled();
	});

	it("accepts logs when the API-key helper resolves the device and MAC together", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue(null);
		state.db.selectFrom.mockReturnValueOnce(makeSelectAllBuilder(undefined));
		state.findDeviceByApiKeyAndUpdateMac.mockResolvedValue({
			friendly_id: "device-11",
			api_key: "api-123",
			mac_address: "OLD:MAC",
			user_id: "user-1",
			battery_voltage: 3.3,
			firmware_version: "1.0.0",
			rssi: -70,
		});
		state.db.updateTable.mockReturnValue(makeUpdateTableBuilder().builder);
		const insertExecute = vi.fn().mockResolvedValue(undefined);
		state.db.insertInto.mockReturnValue({
			values: vi.fn((payload) => ({
				execute: vi.fn(async () => {
					expect(payload).toEqual({
						friendly_id: "device-11",
						log_data: expect.stringContaining(
							'"timestamp":"2023-11-14T22:13:20.000Z"',
						),
					});
					return insertExecute();
				}),
			})),
		});
		const { POST } = await loadRoute();

		const response = await POST(
			new Request("https://example.test/api/log", {
				method: "POST",
				headers: {
					"Access-Token": "api-123",
					ID: "new:mac",
				},
				body: JSON.stringify({
					logs: [{ creation_timestamp: 1_700_000_000, message: "warn" }],
				}),
			}),
		);

		expect(response.status).toBe(204);
		expect(insertExecute).toHaveBeenCalled();
		expect(state.logInfo).toHaveBeenCalledWith(
			"Device authenticated by API key and updated with MAC address",
			expect.objectContaining({
				metadata: expect.objectContaining({
					device_id: "device-11",
					device_status: "known",
					mac_address: "NEW:MAC",
				}),
			}),
		);
	});

	it("returns a compatibility save error when log persistence fails", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue(null);
		state.db.selectFrom.mockReturnValueOnce(
			makeSelectAllBuilder({
				friendly_id: "device-12",
				api_key: "api-123",
				mac_address: "AA:BB:CC",
				user_id: "user-1",
				battery_voltage: 3.3,
				firmware_version: "1.0.0",
				rssi: -70,
			}),
		);
		state.db.updateTable.mockReturnValue(makeUpdateTableBuilder().builder);
		state.db.insertInto.mockReturnValue({
			values: vi.fn(() => ({
				execute: vi.fn().mockRejectedValue(new Error("insert failed")),
			})),
		});
		const { POST } = await loadRoute();

		const response = await POST(
			new Request("https://example.test/api/log", {
				method: "POST",
				headers: {
					"Access-Token": "api-123",
				},
				body: JSON.stringify({ logs: ["hello"] }),
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			status: 500,
			message: "Failed to save logs",
		});
		expect(state.logError).toHaveBeenCalledWith(
			expect.any(Error),
			expect.any(Object),
		);
	});

	it("auto-provisions a real owned device when MAC and API key are both new", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue("user-2");
		state.generateFriendlyId.mockReturnValue("NEW123");
		state.db.selectFrom.mockReturnValueOnce(makeSelectAllBuilder(undefined));
		state.findDeviceByApiKeyAndUpdateMac.mockResolvedValue(undefined);
		const insertLogsExecute = vi.fn().mockResolvedValue(undefined);
		state.db.insertInto.mockImplementation((table: string) => {
			if (table === "devices") {
				return {
					values: vi.fn(() => ({
						returningAll: vi.fn(() => ({
							executeTakeFirst: vi.fn().mockResolvedValue({
								friendly_id: "NEW123",
							}),
						})),
					})),
				};
			}

			return {
				values: vi.fn(() => ({
					execute: vi.fn(() => insertLogsExecute()),
				})),
			};
		});
		const { POST } = await loadRoute();

		const response = await POST(
			new Request("https://example.test/api/log", {
				method: "POST",
				headers: {
					"Access-Token": "api-456",
					ID: "aa:bb:dd",
					"Refresh-Rate": "45",
				},
				body: JSON.stringify({ logs: ["boot"] }),
			}),
		);

		expect(response.status).toBe(204);
		expect(insertLogsExecute).toHaveBeenCalled();
		expect(state.logInfo).toHaveBeenCalledWith(
			"Created new device with provided MAC address",
			expect.objectContaining({
				metadata: expect.objectContaining({
					device_id: "NEW123",
					device_status: "known",
				}),
			}),
		);
	});

	it("reuses an existing mock device for an unknown logger", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue("user-4");
		state.generateMockMacAddress.mockReturnValue("MOCK:CC");
		state.db.selectFrom
			.mockReturnValueOnce(makeSelectAllBuilder(undefined))
			.mockReturnValueOnce(
				makeSelectAllBuilder({
					friendly_id: "mock-1",
					api_key: "mock-api",
					mac_address: "MOCK:CC",
					user_id: "user-4",
					battery_voltage: 3.1,
					firmware_version: "1.0.0",
					rssi: -60,
				}),
			);
		state.db.updateTable.mockReturnValue(makeUpdateTableBuilder().builder);
		const insertLogsExecute = vi.fn().mockResolvedValue(undefined);
		state.db.insertInto.mockReturnValue({
			values: vi.fn(() => ({
				execute: vi.fn(() => insertLogsExecute()),
			})),
		});
		const { POST } = await loadRoute();

		const response = await POST(
			new Request("https://example.test/api/log", {
				method: "POST",
				headers: {
					"Access-Token": "api-unknown",
				},
				body: JSON.stringify({ logs: ["ping"] }),
			}),
		);

		expect(response.status).toBe(204);
		expect(insertLogsExecute).toHaveBeenCalled();
		expect(state.logInfo).toHaveBeenCalledWith(
			"Using existing mock device for unknown logger",
			expect.objectContaining({
				metadata: expect.objectContaining({
					device_status: "existing_mock",
				}),
			}),
		);
	});

	it("creates a new mock device for an unknown owned logger", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue("user-5");
		state.generateMockMacAddress.mockReturnValue("MOCK:DD");
		state.createMockDeviceIdentity.mockReturnValue({
			friendlyId: "MOCK22",
			apiKey: "generated-api",
		});
		state.db.selectFrom
			.mockReturnValueOnce(makeSelectAllBuilder(undefined))
			.mockReturnValueOnce(makeSelectAllBuilder(undefined));
		const insertLogsExecute = vi.fn().mockResolvedValue(undefined);
		state.db.insertInto.mockImplementation((table: string) => {
			if (table === "devices") {
				return {
					values: vi.fn(() => ({
						returningAll: vi.fn(() => ({
							executeTakeFirst: vi.fn().mockResolvedValue({
								friendly_id: "MOCK22",
							}),
						})),
					})),
				};
			}

			return {
				values: vi.fn(() => ({
					execute: vi.fn(() => insertLogsExecute()),
				})),
			};
		});
		const { POST } = await loadRoute();

		const response = await POST(
			new Request("https://example.test/api/log", {
				method: "POST",
				headers: {
					"Access-Token": "long-unknown-api",
				},
				body: JSON.stringify({ logs: ["cold-start"] }),
			}),
		);

		expect(response.status).toBe(204);
		expect(insertLogsExecute).toHaveBeenCalled();
		expect(state.logInfo).toHaveBeenCalledWith(
			"Created new device for unknown logger",
			expect.objectContaining({
				metadata: expect.objectContaining({
					device_status: "new_mock",
					new_device_id: "MOCK22",
				}),
			}),
		);
	});

	it("returns a compatibility error when creating a new unknown mock device fails", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue("user-6");
		state.generateMockMacAddress.mockReturnValue("MOCK:EE");
		state.createMockDeviceIdentity.mockReturnValue({
			friendlyId: "MOCK33",
			apiKey: "generated-api",
		});
		state.db.selectFrom
			.mockReturnValueOnce(makeSelectAllBuilder(undefined))
			.mockReturnValueOnce(makeSelectAllBuilder(undefined));
		state.db.insertInto.mockImplementation((table: string) => {
			if (table === "devices") {
				return {
					values: vi.fn(() => ({
						returningAll: vi.fn(() => ({
							executeTakeFirst: vi
								.fn()
								.mockRejectedValue(new Error("device insert failed")),
						})),
					})),
				};
			}

			return {
				values: vi.fn(() => ({
					execute: vi.fn(),
				})),
			};
		});
		const { POST } = await loadRoute();

		const response = await POST(
			new Request("https://example.test/api/log", {
				method: "POST",
				headers: {
					"Access-Token": "brand-new-api",
				},
				body: JSON.stringify({ logs: ["cold-start"] }),
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			status: 500,
			message: "Failed to process logs from unknown device",
		});
		expect(state.logError).toHaveBeenCalledWith(
			expect.objectContaining({
				message: "Error creating device for unknown logger",
				originalError: expect.any(Error),
			}),
			expect.objectContaining({
				metadata: expect.objectContaining({
					apiKey: "xxxx-api",
					mockMacAddress: "MOCK:EE",
					friendly_id: "MOCK33",
					new_api_key: "generated-api",
					device_status: "new_mock",
				}),
			}),
		);
	});

	it("returns the internal compat error when reading the request body throws", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue(null);
		state.db.selectFrom.mockReturnValueOnce(
			makeSelectAllBuilder({
				friendly_id: "device-13",
				api_key: "api-123",
				mac_address: "AA:BB:CC",
				user_id: "user-1",
				battery_voltage: 3.3,
				firmware_version: "1.0.0",
				rssi: -70,
			}),
		);
		state.db.updateTable.mockReturnValue(makeUpdateTableBuilder().builder);
		const { POST } = await loadRoute();
		const request = new Request("https://example.test/api/log", {
			method: "POST",
			headers: {
				"Access-Token": "api-123",
			},
			body: JSON.stringify({ logs: [] }),
		});
		vi.spyOn(request, "json").mockRejectedValueOnce(new Error("bad json"));

		const response = await POST(request);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			status: 500,
			message: "Internal server error",
		});
		expect(state.logError).toHaveBeenCalledWith(
			expect.objectContaining({ message: "bad json" }),
			expect.objectContaining({
				source: "api/log",
			}),
		);
	});
});
