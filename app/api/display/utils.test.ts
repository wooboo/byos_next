import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	checkDbConnection: vi.fn(),
	createMockDeviceIdentity: vi.fn(),
	currentUserId: vi.fn(),
	db: {
		selectFrom: vi.fn(),
		updateTable: vi.fn(),
		insertInto: vi.fn(),
	},
	generateMockMacAddress: vi.fn(),
	logError: vi.fn(),
	logInfo: vi.fn(),
	recipeLogger: {
		error: vi.fn(),
		info: vi.fn(),
	},
	withExplicitUserScope: vi.fn(),
}));

vi.mock("@/app/api/device-api-key", () => ({
	createMockDeviceIdentity: state.createMockDeviceIdentity,
	generateMockMacAddress: state.generateMockMacAddress,
}));

vi.mock("@/lib/auth/get-user", () => ({
	getCurrentUserId: state.currentUserId,
}));

vi.mock("@/lib/database/db", () => ({
	db: state.db,
}));

vi.mock("@/lib/database/scoped-db", () => ({
	withExplicitUserScope: state.withExplicitUserScope,
}));

vi.mock("@/lib/database/utils", () => ({
	checkDbConnection: state.checkDbConnection,
}));

vi.mock("@/lib/logger", () => ({
	logError: state.logError,
	logInfo: state.logInfo,
}));

vi.mock("@/lib/recipes/logger", () => ({
	logger: state.recipeLogger,
}));

const loadUtils = () => import("./utils");

function makeSelectFirstBuilder(result: unknown) {
	return {
		select() {
			return this;
		},
		selectAll() {
			return this;
		},
		where() {
			return this;
		},
		executeTakeFirst: vi.fn().mockResolvedValue(result),
	};
}

function makeQueryBuilder(result: unknown) {
	return {
		select() {
			return this;
		},
		selectAll() {
			return this;
		},
		where() {
			return this;
		},
		orderBy() {
			return this;
		},
		execute: vi.fn().mockResolvedValue(result),
		executeTakeFirst: vi.fn().mockResolvedValue(result),
	};
}

function makeUpdateBuilder() {
	const execute = vi.fn().mockResolvedValue(undefined);
	const where = vi.fn(() => ({
		execute,
	}));
	const set = vi.fn(() => ({
		where,
	}));

	return {
		builder: {
			set,
		},
		execute,
		set,
		where,
	};
}

function makePlaylistDb(items: unknown[]) {
	return {
		selectFrom: vi.fn(() => ({
			selectAll() {
				return this;
			},
			where() {
				return this;
			},
			orderBy() {
				return this;
			},
			execute: vi.fn().mockResolvedValue(items),
		})),
	};
}

describe("app/api/display/utils", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2024-01-01T10:30:00Z"));
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.currentUserId.mockResolvedValue(null);
		state.db.selectFrom.mockReset();
		state.db.updateTable.mockReset();
		state.db.insertInto.mockReset();
		state.createMockDeviceIdentity.mockReset();
		state.generateMockMacAddress.mockReset();
		state.logError.mockReset();
		state.logInfo.mockReset();
		state.recipeLogger.error.mockReset();
		state.recipeLogger.info.mockReset();
		state.withExplicitUserScope.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("parses TRMNL headers and falls back to access_token query param", async () => {
		const { parseRequestHeaders } = await loadUtils();
		const request = new Request(
			"https://example.test/api/display?access_token=query-token",
			{
				headers: {
					ID: "aa:bb:cc",
					Width: "800",
					Height: "480",
					Model: "  Inkplate  ",
					"Battery-Voltage": "3.71",
					"FW-Version": "1.2.3",
					RSSI: "-61",
					"Refresh-Rate": "900",
					"Special-Function": "true",
					"Color-Count": "6",
					"Display-Technology": "eink-spectra6",
					"Color-Model": "eink-spectra6",
					"Palette-Id": "m5papercolor-ed2208-m5gfx-v1",
					"Dither-Location": "server",
					"Preferred-Image-Format": "palette-bmp",
					BASE64: "true",
					"x-forwarded-proto": "https",
					"x-forwarded-host": "display.example.test",
				},
			},
		);

		expect(parseRequestHeaders(request)).toEqual({
			apiKey: "query-token",
			macAddress: "AA:BB:CC",
			refreshRate: "900",
			batteryVoltage: "3.71",
			fwVersion: "1.2.3",
			rssi: "-61",
			width: 800,
			height: 480,
			model: "Inkplate",
			colorCount: 6,
			displayTechnology: "eink-spectra6",
			colorModel: "eink-spectra6",
			paletteId: "m5papercolor-ed2208-m5gfx-v1",
			ditherLocation: "server",
			preferredImageFormat: "palette-bmp",
			specialFunction: true,
			base64: true,
			hostUrl: "https://display.example.test",
		});
	});

	it("falls back cleanly when request.url is not a valid absolute URL", async () => {
		const { parseRequestHeaders } = await loadUtils();

		expect(
			parseRequestHeaders({
				url: "::bad-url::",
				headers: new Headers({
					host: "device.local",
					Model: "   ",
				}),
			} as Request),
		).toEqual({
			apiKey: null,
			macAddress: null,
			refreshRate: null,
			batteryVoltage: null,
			fwVersion: null,
			rssi: null,
			width: null,
			height: null,
			model: null,
			colorCount: null,
			displayTechnology: null,
			colorModel: null,
			paletteId: null,
			ditherLocation: null,
			preferredImageFormat: null,
			specialFunction: false,
			base64: false,
			hostUrl: "http://device.local",
		});
	});

	it("matches time ranges including overnight windows", async () => {
		const { isTimeInRange } = await loadUtils();

		expect(isTimeInRange("10:30", "09:00", "11:00")).toBe(true);
		expect(isTimeInRange("08:59", "09:00", "11:00")).toBe(false);
		expect(isTimeInRange("23:30", "22:00", "06:00")).toBe(true);
		expect(isTimeInRange("12:30", "22:00", "06:00")).toBe(false);
	});

	it("uses the matching refresh schedule override before the default rate", async () => {
		const { calculateRefreshRate } = await loadUtils();

		expect(
			calculateRefreshRate(
				{
					default_refresh_rate: 300,
					time_ranges: [
						{
							start_time: "09:00",
							end_time: "11:00",
							refresh_rate: 45,
						},
					],
				},
				180,
				"UTC",
			),
		).toBe(45);

		expect(
			calculateRefreshRate(
				{
					default_refresh_rate: 300,
					time_ranges: [
						{
							start_time: "11:01",
							end_time: "12:00",
							refresh_rate: 45,
						},
					],
				},
				180,
				"UTC",
			),
		).toBe(300);
	});

	it("falls back to the provided default refresh rate when no schedule exists", async () => {
		const { calculateRefreshRate } = await loadUtils();

		expect(calculateRefreshRate(null, 123, "UTC")).toBe(123);
	});

	it("selects the next active playlist item via explicit user scope", async () => {
		const { getActivePlaylistItem } = await loadUtils();
		const items = [
			{
				id: "1",
				order_index: 0,
				screen_id: "screen-a",
				start_time: "00:00",
				end_time: "00:15",
				days_of_week: ["monday"],
			},
			{
				id: "2",
				order_index: 1,
				screen_id: "screen-b",
				start_time: "10:00",
				end_time: "11:00",
				days_of_week: ["monday"],
			},
		];
		const scopedDb = makePlaylistDb(items);
		state.withExplicitUserScope.mockImplementation(async (userId, runQuery) => {
			expect(userId).toBe("user-1");
			return runQuery(scopedDb as never);
		});

		const item = await getActivePlaylistItem("playlist-1", 0, "UTC", "user-1");

		expect(item?.screen_id).toBe("screen-b");
		expect(state.withExplicitUserScope).toHaveBeenCalledTimes(1);
		expect(state.logInfo).toHaveBeenCalledWith(
			"Checking playlist items for time/day match",
			expect.objectContaining({
				source: "api/display",
				metadata: expect.objectContaining({
					playlistId: "playlist-1",
					currentDay: "monday",
					currentTime: "10:30",
				}),
			}),
		);
	});

	it("returns null when playlist lookup is skipped because the database is unavailable", async () => {
		const { getActivePlaylistItem } = await loadUtils();
		state.checkDbConnection.mockResolvedValue({ ready: false });

		await expect(getActivePlaylistItem("playlist-1", 0)).resolves.toBeNull();
		expect(state.db.selectFrom).not.toHaveBeenCalled();
	});

	it("logs and returns null when a playlist has no items", async () => {
		const { getActivePlaylistItem } = await loadUtils();
		state.db.selectFrom.mockReturnValue(makePlaylistDb([]).selectFrom());

		await expect(
			getActivePlaylistItem("playlist-empty", 0, "UTC"),
		).resolves.toBe(null);
		expect(state.logError).toHaveBeenCalledWith(
			"No items in playlist",
			expect.objectContaining({
				source: "api/display",
				metadata: { playlistId: "playlist-empty" },
			}),
		);
	});

	it("returns the first unconstrained playlist item when no day or time filters are present", async () => {
		const { getActivePlaylistItem } = await loadUtils();
		const items = [
			{
				id: "item-0",
				order_index: 0,
				screen_id: "screen-a",
				start_time: "22:00",
				end_time: "23:00",
				days_of_week: ["sunday"],
			},
			{
				id: "item-1",
				order_index: 1,
				screen_id: "screen-b",
				start_time: null,
				end_time: null,
				days_of_week: null,
			},
		];
		state.db.selectFrom.mockReturnValue(makePlaylistDb(items).selectFrom());

		await expect(
			getActivePlaylistItem("playlist-free", 0, "UTC"),
		).resolves.toEqual(expect.objectContaining({ id: "item-1" }));
	});

	it("resolves a device owner from the API key when the database is ready", async () => {
		const { resolveUserIdFromApiKey } = await loadUtils();
		state.db.selectFrom.mockReturnValue(
			makeSelectFirstBuilder({ user_id: "user-42" }),
		);

		await expect(resolveUserIdFromApiKey("api-123")).resolves.toBe("user-42");
		expect(state.db.selectFrom).toHaveBeenCalledWith("devices");
	});

	it("returns null for missing device owners when the database is unavailable or empty", async () => {
		const { resolveUserIdFromApiKey } = await loadUtils();

		state.checkDbConnection.mockResolvedValueOnce({ ready: false });
		await expect(resolveUserIdFromApiKey("api-123")).resolves.toBeNull();

		state.checkDbConnection.mockResolvedValueOnce({ ready: true });
		state.db.selectFrom.mockReturnValueOnce(makeSelectFirstBuilder(undefined));
		await expect(resolveUserIdFromApiKey("api-456")).resolves.toBeNull();
	});

	it("updates device status with parsed telemetry and rounded refresh duration", async () => {
		const { updateDeviceStatus } = await loadUtils();
		const update = makeUpdateBuilder();
		state.db.updateTable.mockReturnValue(update.builder);

		await updateDeviceStatus(
			{
				id: "device-1",
				friendly_id: "friendly-1",
				timezone: "Europe/Warsaw",
			} as never,
			{
				apiKey: "api-123",
				macAddress: "AA:BB",
				refreshRate: "60",
				batteryVoltage: "3.52",
				fwVersion: "2.0.0",
				rssi: "-58",
				width: null,
				height: null,
				model: null,
				specialFunction: false,
				base64: false,
				hostUrl: "https://example.test",
			},
			61.7,
		);

		expect(state.db.updateTable).toHaveBeenCalledWith("devices");
		expect(update.set).toHaveBeenCalledWith(
			expect.objectContaining({
				battery_voltage: 3.52,
				firmware_version: "2.0.0",
				rssi: -58,
				last_refresh_duration: 62,
				timezone: "Europe/Warsaw",
				last_update_time: "2024-01-01T10:30:00.000Z",
				next_expected_update: "2024-01-01T10:31:01.700Z",
				updated_at: "2024-01-01T10:30:00.000Z",
			}),
		);
		expect(update.where).toHaveBeenCalledWith("id", "=", "device-1");
		expect(update.execute).toHaveBeenCalledTimes(1);
	});

	it("logs a device status update failure without throwing", async () => {
		const { updateDeviceStatus } = await loadUtils();
		const execute = vi.fn().mockRejectedValue(new Error("db failed"));
		state.db.updateTable.mockReturnValue({
			set() {
				return this;
			},
			where() {
				return this;
			},
			execute,
		});

		await expect(
			updateDeviceStatus(
				{
					id: "device-2",
					friendly_id: "friendly-2",
					timezone: null,
				} as never,
				{
					apiKey: "api-123",
					macAddress: "AA:CC",
					refreshRate: null,
					batteryVoltage: null,
					fwVersion: null,
					rssi: null,
					width: null,
					height: null,
					model: null,
					specialFunction: false,
					base64: false,
					hostUrl: "https://example.test",
				},
				60,
			),
		).resolves.toBeUndefined();
		expect(state.logError).toHaveBeenCalledWith(
			"Error updating device status",
			expect.objectContaining({
				source: "api/display",
				metadata: expect.objectContaining({ deviceId: "device-2" }),
			}),
		);
	});

	it("pre-caches images in the background and logs both success and failure", async () => {
		const { precacheImageInBackground } = await loadUtils();
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce({ ok: true })
			.mockResolvedValueOnce({ ok: false, status: 502 });
		vi.stubGlobal("fetch", fetchMock);

		precacheImageInBackground("https://example.test/ok.bmp", "friendly-1");
		precacheImageInBackground("https://example.test/fail.bmp", "friendly-2");
		await Promise.resolve();
		await Promise.resolve();

		expect(fetchMock).toHaveBeenNthCalledWith(
			1,
			"https://example.test/ok.bmp",
			{
				method: "GET",
			},
		);
		expect(state.logInfo).toHaveBeenCalledWith(
			"Image pre-cached successfully",
			expect.objectContaining({
				metadata: {
					imageUrl: "https://example.test/ok.bmp",
					friendlyId: "friendly-1",
				},
			}),
		);
		expect(state.logError).toHaveBeenCalledWith(
			"Failed to precache image",
			expect.objectContaining({
				metadata: expect.objectContaining({
					imageUrl: "https://example.test/fail.bmp",
					error: "Failed to cache image: 502",
					friendlyId: "friendly-2",
				}),
			}),
		);
	});

	it("returns an existing device by API key without updating it when headers match", async () => {
		const { findOrCreateDevice } = await loadUtils();
		const device = {
			id: "device-1",
			api_key: "api-123",
			mac_address: "AA:BB",
			model: "TRMNL",
			friendly_id: "friendly-1",
		};
		state.db.selectFrom.mockReturnValueOnce(makeQueryBuilder(device));

		await expect(
			findOrCreateDevice({
				apiKey: "api-123",
				macAddress: "AA:BB",
				refreshRate: null,
				batteryVoltage: null,
				fwVersion: null,
				rssi: null,
				width: null,
				height: null,
				model: "TRMNL",
				specialFunction: false,
				base64: false,
				hostUrl: "https://example.test",
			}),
		).resolves.toEqual(device);
		expect(state.db.updateTable).not.toHaveBeenCalled();
	});

	it("stores a known header palette on an existing device that has no palette", async () => {
		const { findOrCreateDevice } = await loadUtils();
		const update = makeUpdateBuilder();
		const device = {
			id: "device-paper",
			api_key: "api-paper",
			mac_address: "AA:BB",
			model: "M5Stack PaperColor",
			friendly_id: "paper-1",
			palette_id: null,
			grayscale: 256,
			screen_width: null,
			screen_height: null,
		};
		state.db.selectFrom.mockReturnValueOnce(makeQueryBuilder(device));
		state.db.updateTable.mockReturnValue(update.builder);

		await expect(
			findOrCreateDevice({
				apiKey: "api-paper",
				macAddress: "AA:BB",
				refreshRate: null,
				batteryVoltage: null,
				fwVersion: null,
				rssi: null,
				width: 600,
				height: 400,
				model: "M5Stack PaperColor",
				paletteId: "m5papercolor-ed2208-m5gfx-v1",
				colorCount: 6,
				specialFunction: false,
				base64: false,
				hostUrl: "https://example.test",
			}),
		).resolves.toEqual(
			expect.objectContaining({
				palette_id: "m5papercolor-ed2208-m5gfx-v1",
				grayscale: 2,
				screen_width: 600,
				screen_height: 400,
			}),
		);
		expect(update.set).toHaveBeenCalledWith(
			expect.objectContaining({
				palette_id: "m5papercolor-ed2208-m5gfx-v1",
				grayscale: 2,
				screen_width: 600,
				screen_height: 400,
			}),
		);
	});

	it("rejects MAC-only API key rotation for a different owner", async () => {
		const { findOrCreateDevice } = await loadUtils();
		state.db.selectFrom
			.mockReturnValueOnce(makeQueryBuilder(undefined))
			.mockReturnValueOnce(
				makeQueryBuilder({
					id: "device-2",
					api_key: "api-old",
					mac_address: "AA:BB",
					model: "TRMNL",
					user_id: "user-1",
					friendly_id: "friendly-2",
				}),
			);
		state.currentUserId.mockResolvedValue(null);

		await expect(
			findOrCreateDevice({
				apiKey: "api-new",
				macAddress: "AA:BB",
				refreshRate: null,
				batteryVoltage: null,
				fwVersion: null,
				rssi: null,
				width: null,
				height: null,
				model: "TRMNL",
				specialFunction: false,
				base64: false,
				hostUrl: "https://example.test",
			}),
		).resolves.toBeNull();
		expect(state.logError).toHaveBeenCalledWith(
			"Refusing to rotate device API key from MAC-only match",
			expect.any(Object),
		);
	});

	it("creates a real device for an owned API key when a MAC address is provided", async () => {
		const { findOrCreateDevice } = await loadUtils();
		const insertedDevice = { id: "device-3", friendly_id: "CRE123" };
		state.db.selectFrom
			.mockReturnValueOnce(makeQueryBuilder(undefined))
			.mockReturnValueOnce(makeQueryBuilder(undefined));
		state.currentUserId.mockResolvedValue("user-7");
		state.db.insertInto.mockReturnValue({
			values: vi.fn(() => ({
				returningAll: vi.fn(() => ({
					executeTakeFirst: vi.fn().mockResolvedValue(insertedDevice),
				})),
			})),
		});

		await expect(
			findOrCreateDevice({
				apiKey: "api-123",
				macAddress: "AA:BB:CC",
				refreshRate: "75",
				batteryVoltage: null,
				fwVersion: null,
				rssi: null,
				width: null,
				height: null,
				model: "TRMNL 7",
				specialFunction: false,
				base64: false,
				hostUrl: "https://example.test",
			}),
		).resolves.toEqual(insertedDevice);
		expect(state.db.insertInto).toHaveBeenCalledWith("devices");
		expect(state.logInfo).toHaveBeenCalledWith(
			"Created new device with provided MAC address",
			expect.any(Object),
		);
	});

	it("reuses an existing mock device and swaps in the real MAC address", async () => {
		const { findOrCreateDevice } = await loadUtils();
		const update = makeUpdateBuilder();
		state.db.selectFrom
			.mockReturnValueOnce(makeQueryBuilder(undefined))
			.mockReturnValueOnce(makeQueryBuilder(undefined))
			.mockReturnValueOnce(
				makeQueryBuilder({
					id: "device-4",
					friendly_id: "MOCK01",
					api_key: "mock-api",
					mac_address: "AA:00:00",
				}),
			);
		state.currentUserId.mockResolvedValue("user-8");
		state.generateMockMacAddress.mockReturnValue("AA:00:00");
		state.db.updateTable.mockReturnValue(update.builder);

		await expect(
			findOrCreateDevice({
				apiKey: "api-999",
				macAddress: "FF:EE:DD",
				refreshRate: null,
				batteryVoltage: null,
				fwVersion: null,
				rssi: null,
				width: null,
				height: null,
				model: null,
				specialFunction: false,
				base64: false,
				hostUrl: "https://example.test",
			}),
		).resolves.toEqual(
			expect.objectContaining({
				id: "device-4",
				friendly_id: "MOCK01",
			}),
		);
		expect(update.set).toHaveBeenCalledWith({ mac_address: "FF:EE:DD" });
		expect(state.logInfo).toHaveBeenCalledWith(
			"Using existing mock device",
			expect.any(Object),
		);
	});

	it("creates a mock device as the final fallback for an owned API key", async () => {
		const { findOrCreateDevice } = await loadUtils();
		const mockDevice = { id: "device-5", friendly_id: "MOCK99" };
		state.db.selectFrom
			.mockReturnValueOnce(makeQueryBuilder(undefined))
			.mockReturnValueOnce(makeQueryBuilder(undefined))
			.mockReturnValueOnce(makeQueryBuilder(undefined));
		state.currentUserId.mockResolvedValue("user-9");
		state.createMockDeviceIdentity.mockReturnValue({
			friendlyId: "MOCK99",
			apiKey: "generated-api",
		});
		state.generateMockMacAddress.mockReturnValue("AA:11:22");
		state.db.insertInto.mockReturnValue({
			values: vi.fn(() => ({
				returningAll: vi.fn(() => ({
					executeTakeFirst: vi.fn().mockResolvedValue(mockDevice),
				})),
			})),
		});

		await expect(
			findOrCreateDevice({
				apiKey: "api-final",
				macAddress: null,
				refreshRate: null,
				batteryVoltage: null,
				fwVersion: null,
				rssi: null,
				width: null,
				height: null,
				model: "TRMNL",
				specialFunction: false,
				base64: false,
				hostUrl: "https://example.test",
			}),
		).resolves.toEqual(mockDevice);
		expect(state.recipeLogger.info).toHaveBeenCalledWith(
			"Created new mock device: MOCK99",
		);
	});
});
