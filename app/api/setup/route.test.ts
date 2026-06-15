import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	checkDbConnection: vi.fn(),
	findDeviceByApiKeyAndUpdateMac: vi.fn(),
	generateApiKey: vi.fn(),
	generateFriendlyId: vi.fn(),
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
	findDeviceByApiKeyAndUpdateMac: state.findDeviceByApiKeyAndUpdateMac,
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
	generateApiKey: state.generateApiKey,
	generateFriendlyId: state.generateFriendlyId,
}));

const loadRoute = () => import("./route");

describe("app/api/setup GET", () => {
	beforeEach(() => {
		vi.resetModules();
		state.checkDbConnection.mockReset();
		state.findDeviceByApiKeyAndUpdateMac.mockReset();
		state.generateApiKey.mockReset();
		state.generateFriendlyId.mockReset();
		state.getCurrentUserId.mockReset();
		state.logError.mockReset();
		state.logInfo.mockReset();
		state.db.insertInto.mockReset();
		state.db.selectFrom.mockReset();
		state.db.updateTable.mockReset();
	});

	it("skips setup in no-db mode", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: false });
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/setup", {
				headers: {
					"Access-Token": "api-1",
					ID: "aa:bb:cc",
				},
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			status: 200,
			message: "Device setup skipped",
		});
		expect(state.logInfo).toHaveBeenCalledWith(
			"Database client not initialized, using noDB mode, skipping device setup",
			expect.objectContaining({
				source: "api/setup",
				metadata: {
					macAddress: "AA:BB:CC",
					hasApiKey: true,
				},
			}),
		);
	});

	it("returns a compatibility payload when the ID header is missing", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/setup", {
				headers: {
					Model: "TRMNL",
				},
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			status: 404,
			api_key: null,
			friendly_id: null,
			image_url: null,
			message: "ID header is required",
		});
		expect(state.logError).toHaveBeenCalledWith(
			expect.any(Error),
			expect.objectContaining({
				source: "api/setup",
				metadata: {
					macAddress: null,
					hasApiKey: false,
					model: "TRMNL",
				},
			}),
		);
	});

	it("requires the Model header", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/setup", {
				headers: {
					ID: "aa:bb:cc",
				},
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			status: 400,
			api_key: null,
			friendly_id: null,
			image_url: null,
			message: "Model header is required",
		});
	});

	it("returns an existing device resolved by API key and updates its MAC address", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue(null);
		state.db.selectFrom.mockReturnValue({
			selectAll() {
				return this;
			},
			where: vi.fn(() => ({
				executeTakeFirst: vi.fn().mockResolvedValue(undefined),
			})),
		});
		state.findDeviceByApiKeyAndUpdateMac.mockResolvedValue({
			api_key: "api-1",
			friendly_id: "device-1",
			mac_address: "AA:BB:CC",
			user_id: "user-1",
		});
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/setup", {
				headers: {
					"Access-Token": "api-1",
					ID: "aa:bb:cc",
					Model: "TRMNL",
				},
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			status: 200,
			api_key: "api-1",
			friendly_id: "device-1",
			image_url: null,
			filename: null,
			message: "Device device-1 updated with new MAC address!",
		});
		expect(state.findDeviceByApiKeyAndUpdateMac).toHaveBeenCalledWith(
			state.db,
			{
				apiKey: "api-1",
				macAddress: "AA:BB:CC",
				source: "api/setup",
				successMessage: "Updated device MAC address",
			},
		);
	});

	it("creates a new owned device when no record exists", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue("user-7");
		state.generateFriendlyId.mockReturnValue("friendly-7");
		state.generateApiKey.mockReturnValue("generated-api");
		state.db.selectFrom.mockReturnValue({
			selectAll() {
				return this;
			},
			where: vi.fn(() => ({
				executeTakeFirst: vi.fn().mockResolvedValue(undefined),
			})),
		});
		const executeTakeFirst = vi.fn().mockResolvedValue({
			api_key: "generated-api",
			friendly_id: "friendly-7",
		});
		state.db.insertInto.mockReturnValue({
			values: vi.fn((values) => {
				expect(values).toEqual(
					expect.objectContaining({
						mac_address: "AA:BB:CC",
						friendly_id: "friendly-7",
						api_key: "generated-api",
						user_id: "user-7",
						name: "TRMNL Device friendly-7",
						timezone: "Europe/London",
					}),
				);
				return {
					returningAll: vi.fn(() => ({
						executeTakeFirst,
					})),
				};
			}),
		});
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/setup", {
				headers: {
					ID: "aa:bb:cc",
					Model: "TRMNL",
				},
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			status: 200,
			api_key: "generated-api",
			friendly_id: "friendly-7",
			image_url: null,
			filename: null,
			message: "Device friendly-7 added to BYOS!",
		});
		expect(state.logInfo).toHaveBeenCalledWith(
			"New device friendly-7 created!",
			expect.objectContaining({
				source: "api/setup",
				metadata: {
					friendly_id: "friendly-7",
					mac_address: "AA:BB:CC",
					has_api_key: true,
				},
			}),
		);
	});

	it("rejects creating a new unowned device", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue(null);
		state.db.selectFrom.mockReturnValue({
			selectAll() {
				return this;
			},
			where: vi.fn(() => ({
				executeTakeFirst: vi.fn().mockResolvedValue(undefined),
			})),
		});
		state.findDeviceByApiKeyAndUpdateMac.mockResolvedValue(undefined);
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/setup", {
				headers: {
					ID: "aa:bb:cc",
					Model: "TRMNL",
				},
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			status: 403,
			api_key: null,
			friendly_id: null,
			image_url: null,
			message: "Device setup requires an authenticated owner",
		});
	});

	it("returns an existing device by MAC address without requiring a token", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue(null);
		state.db.selectFrom.mockReturnValue({
			selectAll() {
				return this;
			},
			where: vi.fn(() => ({
				executeTakeFirst: vi.fn().mockResolvedValue({
					api_key: "api-1",
					friendly_id: "device-2",
					mac_address: "AA:BB:CC",
					user_id: "user-1",
				}),
			})),
		});
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/setup", {
				headers: {
					ID: "aa:bb:cc",
					Model: "x",
				},
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			status: 200,
			api_key: "api-1",
			friendly_id: "device-2",
			image_url: null,
			filename: null,
			message: "Device device-2 added to BYOS!",
		});
	});

	it("rejects setup for an existing device with the wrong token", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue(null);
		state.db.selectFrom.mockReturnValue({
			selectAll() {
				return this;
			},
			where: vi.fn(() => ({
				executeTakeFirst: vi.fn().mockResolvedValue({
					api_key: "api-1",
					friendly_id: "device-2",
					mac_address: "AA:BB:CC",
					user_id: "user-1",
				}),
			})),
		});
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/setup", {
				headers: {
					"Access-Token": "wrong-token",
					ID: "aa:bb:cc",
					Model: "TRMNL",
				},
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			status: 403,
			api_key: null,
			friendly_id: null,
			image_url: null,
			message: "Device setup requires a valid access token or owner session",
		});
		expect(state.logError).toHaveBeenCalledWith(
			"Refusing setup for device without owner or valid access token",
			expect.objectContaining({
				source: "api/setup",
				metadata: {
					friendly_id: "device-2",
					mac_address: "AA:BB:CC",
					hasApiKey: true,
				},
			}),
		);
	});

	it("rejects setup for an existing device with an empty token header", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue(null);
		state.db.selectFrom.mockReturnValue({
			selectAll() {
				return this;
			},
			where: vi.fn(() => ({
				executeTakeFirst: vi.fn().mockResolvedValue({
					api_key: "api-1",
					friendly_id: "device-2",
					mac_address: "AA:BB:CC",
					user_id: "user-1",
				}),
			})),
		});
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/setup", {
				headers: {
					"Access-Token": "",
					ID: "aa:bb:cc",
					Model: "TRMNL",
				},
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			status: 403,
			api_key: null,
			friendly_id: null,
			image_url: null,
			message: "Device setup requires a valid access token or owner session",
		});
	});

	it("rejects MAC-only setup for an existing device from a non-owner session", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue("user-2");
		state.db.selectFrom.mockReturnValue({
			selectAll() {
				return this;
			},
			where: vi.fn(() => ({
				executeTakeFirst: vi.fn().mockResolvedValue({
					api_key: "api-1",
					friendly_id: "device-2",
					mac_address: "AA:BB:CC",
					user_id: "user-1",
				}),
			})),
		});
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/setup", {
				headers: {
					ID: "aa:bb:cc",
					Model: "TRMNL",
				},
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			status: 403,
			api_key: null,
			friendly_id: null,
			image_url: null,
			message: "Device setup requires a valid access token or owner session",
		});
	});

	it("keeps the current API key when updating an existing device key fails", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue("user-1");
		state.db.selectFrom.mockReturnValue({
			selectAll() {
				return this;
			},
			where: vi.fn(() => ({
				executeTakeFirst: vi.fn().mockResolvedValue({
					api_key: "existing-api",
					friendly_id: "device-3",
					mac_address: "AA:BB:CC",
					user_id: "user-1",
				}),
			})),
		});
		state.db.updateTable.mockReturnValue({
			set: vi.fn(() => ({
				where: vi.fn(() => ({
					execute: vi.fn().mockRejectedValue(new Error("write failed")),
				})),
			})),
		});
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/setup", {
				headers: {
					"Access-Token": "replacement-api",
					ID: "aa:bb:cc",
					Model: "TRMNL",
				},
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			status: 200,
			api_key: "existing-api",
			friendly_id: "device-3",
			image_url: null,
			filename: null,
			message: "Device device-3 added to BYOS!",
		});
		expect(state.logError).toHaveBeenCalledWith(
			expect.any(Error),
			expect.objectContaining({
				source: "api/setup",
				metadata: expect.objectContaining({
					device_id: "device-3",
					mac_address: "AA:BB:CC",
				}),
			}),
		);
	});

	it("returns a compatibility error when inserting a new device fails", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue("user-7");
		state.generateFriendlyId.mockReturnValue("friendly-7");
		state.generateApiKey.mockReturnValue("generated-api");
		state.db.selectFrom.mockReturnValue({
			selectAll() {
				return this;
			},
			where: vi.fn(() => ({
				executeTakeFirst: vi.fn().mockResolvedValue(undefined),
			})),
		});
		state.db.insertInto.mockReturnValue({
			values: vi.fn(() => ({
				returningAll: vi.fn(() => ({
					executeTakeFirst: vi.fn().mockResolvedValue(undefined),
				})),
			})),
		});
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/setup", {
				headers: {
					ID: "aa:bb:cc",
					Model: "TRMNL",
				},
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			status: 500,
			reset_firmware: false,
			message: "Error creating new device. friendly-7",
		});
		expect(state.logError).toHaveBeenCalledWith(
			expect.objectContaining({
				message: "Error creating device",
			}),
			expect.objectContaining({
				source: "api/setup",
				metadata: {
					macAddress: "AA:BB:CC",
					friendly_id: "friendly-7",
					has_api_key: true,
				},
			}),
		);
	});

	it("generates an API key for an existing device without one", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue("user-1");
		state.generateApiKey.mockReturnValue("generated-api");
		state.db.selectFrom.mockReturnValue({
			selectAll() {
				return this;
			},
			where: vi.fn(() => ({
				executeTakeFirst: vi.fn().mockResolvedValue({
					api_key: null,
					friendly_id: "device-4",
					mac_address: "AA:BB:CC",
					user_id: "user-1",
				}),
			})),
		});
		state.db.updateTable.mockReturnValue({
			set: vi.fn((values) => {
				expect(values).toMatchObject({ api_key: "generated-api" });
				return {
					where: vi.fn(() => ({
						execute: vi.fn().mockResolvedValue(undefined),
					})),
				};
			}),
		});
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/setup", {
				headers: {
					ID: "aa:bb:cc",
					Model: "TRMNL",
				},
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			status: 200,
			api_key: "generated-api",
			friendly_id: "device-4",
			image_url: null,
			filename: null,
			message: "Device device-4 added to BYOS!",
		});
	});
});
