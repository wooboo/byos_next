import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	checkDbConnection: vi.fn(),
	findOrCreateDevice: vi.fn(),
	getActivePlaylistItem: vi.fn(),
	getLatestFirmware: vi.fn(),
	isUpdateAvailable: vi.fn(),
	logError: vi.fn(),
	logInfo: vi.fn(),
	precacheImageInBackground: vi.fn(),
	updateDeviceStatus: vi.fn(),
}));

vi.mock("@/lib/database/db", () => ({
	db: {
		updateTable: vi.fn(() => ({
			set() {
				return this;
			},
			where() {
				return this;
			},
			execute: vi.fn(),
		})),
	},
}));

vi.mock("@/lib/database/utils", () => ({
	checkDbConnection: state.checkDbConnection,
}));

vi.mock("@/lib/firmware", () => ({
	getLatestFirmware: state.getLatestFirmware,
	isUpdateAvailable: state.isUpdateAvailable,
}));

vi.mock("@/lib/logger", () => ({
	logError: state.logError,
	logInfo: state.logInfo,
}));

vi.mock("./utils", async () => {
	const actual = await vi.importActual<typeof import("./utils")>("./utils");
	return {
		...actual,
		findOrCreateDevice: state.findOrCreateDevice,
		getActivePlaylistItem: state.getActivePlaylistItem,
		precacheImageInBackground: state.precacheImageInBackground,
		updateDeviceStatus: state.updateDeviceStatus,
	};
});

const loadRoute = () => import("./route");

describe("app/api/display GET", () => {
	beforeEach(() => {
		vi.resetModules();
		state.checkDbConnection.mockReset();
		state.findOrCreateDevice.mockReset();
		state.getActivePlaylistItem.mockReset();
		state.getLatestFirmware.mockReset();
		state.isUpdateAvailable.mockReset();
		state.logError.mockReset();
		state.logInfo.mockReset();
		state.precacheImageInBackground.mockReset();
		state.updateDeviceStatus.mockReset();
	});

	it("requires an access token header", async () => {
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/display", {
				headers: { host: "example.test" },
			}),
		);

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toEqual({
			status: 401,
			error: "Access-Token header is required",
		});
	});

	it("returns the no-db fallback bitmap payload when the database is unavailable", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: false });
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/display", {
				headers: {
					"Access-Token": "token-1",
					host: "example.test",
					Width: "600",
					Height: "448",
					BASE64: "true",
				},
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual(
			expect.objectContaining({
				status: 0,
				image_url:
					"http://example.test/api/bitmap/album.bmp?width=600&height=448&grayscale=16&base64=true",
				refresh_rate: 180,
				special_function: "restart_playlist",
			}),
		);
	});

	it("returns a rendered mixup payload and firmware update metadata for a known device", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.findOrCreateDevice.mockResolvedValue({
			id: "1",
			friendly_id: "kitchen-1",
			screen: "screen-1",
			screen_type: "screen",
			screen_orientation: "portrait",
			screen_width: 800,
			screen_height: 480,
			grayscale: 4,
			display_mode: "mixup",
			mixup_id: "mix-9",
			refresh_schedule: null,
			timezone: "UTC",
			firmware_version: "1.0.0",
		});
		state.getLatestFirmware.mockResolvedValue({
			version: "1.2.0",
			downloadUrl: "https://firmware.test/fw.bin",
		});
		state.isUpdateAvailable.mockReturnValue(true);
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/display", {
				headers: {
					"Access-Token": "token-1",
					host: "example.test",
				},
			}),
		);

		await expect(response.json()).resolves.toEqual(
			expect.objectContaining({
				status: 0,
				image_url:
					"http://example.test/api/bitmap/mixup/mix-9.bmp?width=480&height=800&grayscale=4&access_token=token-1",
				refresh_rate: 180,
				update_firmware: true,
				firmware_url: "https://firmware.test/fw.bin",
				image_rotate: 0,
			}),
		);
		expect(state.precacheImageInBackground).toHaveBeenCalledWith(
			"http://example.test/api/bitmap/mixup/mix-9.bmp?width=480&height=800&grayscale=4&access_token=token-1",
			"kitchen-1",
		);
		expect(state.updateDeviceStatus).toHaveBeenCalledWith(
			expect.objectContaining({ friendly_id: "kitchen-1" }),
			expect.objectContaining({ apiKey: "token-1" }),
			180,
		);
	});

	it("returns a playlist fallback screen when no playlist is configured", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.findOrCreateDevice.mockResolvedValue({
			id: "2",
			friendly_id: "desk-1",
			screen: "screen-42",
			screen_id: "screen-42",
			screen_type: "screen",
			screen_orientation: "landscape",
			screen_width: 1200,
			screen_height: 800,
			grayscale: 7,
			display_mode: "playlist",
			playlist_id: null,
			refresh_schedule: null,
			timezone: "UTC",
			firmware_version: "1.0.0",
		});
		state.getLatestFirmware.mockResolvedValue(null);
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/display", {
				headers: {
					"Access-Token": "token-2",
					host: "example.test",
				},
			}),
		);

		await expect(response.json()).resolves.toEqual(
			expect.objectContaining({
				status: 0,
				image_url:
					"http://example.test/api/bitmap/screen-42.bmp?width=1200&height=800&grayscale=2",
				refresh_rate: 180,
				update_firmware: false,
				firmware_url: null,
				image_rotate: 1,
			}),
		);
		expect(state.getActivePlaylistItem).not.toHaveBeenCalled();
	});

	it("falls back to the device screen when a playlist has no active item", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.findOrCreateDevice.mockResolvedValue({
			id: "3",
			friendly_id: "hall-1",
			screen: "fallback-screen",
			screen_id: null,
			screen_type: "recipe",
			screen_orientation: "portrait",
			screen_width: 800,
			screen_height: 480,
			grayscale: 16,
			display_mode: "playlist",
			playlist_id: "playlist-1",
			current_playlist_index: 2,
			refresh_schedule: null,
			timezone: "UTC",
			user_id: "user-1",
			firmware_version: "1.0.0",
		});
		state.getActivePlaylistItem.mockResolvedValue(null);
		state.getLatestFirmware.mockResolvedValue(null);
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/display", {
				headers: {
					"Access-Token": "token-3",
					host: "example.test",
				},
			}),
		);

		await expect(response.json()).resolves.toEqual(
			expect.objectContaining({
				image_url:
					"http://example.test/api/bitmap/fallback-screen.bmp?width=480&height=800&grayscale=16",
				refresh_rate: 60,
				image_rotate: 0,
			}),
		);
		expect(state.logInfo).toHaveBeenCalledWith(
			"No active playlist item found, using fallback",
			expect.any(Object),
		);
	});

	it("renders playlist mixup items with a minimum refresh rate of 30 seconds", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.findOrCreateDevice.mockResolvedValue({
			id: "4",
			friendly_id: "kiosk-1",
			screen: "screen-4",
			screen_type: "screen",
			screen_orientation: "landscape",
			screen_width: 800,
			screen_height: 480,
			grayscale: 4,
			display_mode: "playlist",
			playlist_id: "playlist-4",
			current_playlist_index: 0,
			refresh_schedule: null,
			timezone: "UTC",
			user_id: "user-4",
			firmware_version: "1.0.0",
		});
		state.getActivePlaylistItem.mockResolvedValue({
			order_index: 3,
			screen_id: "mix-4",
			screen_type: "mixup",
			duration: 12,
		});
		state.getLatestFirmware.mockResolvedValue(null);
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/display", {
				headers: {
					"Access-Token": "token-4",
					host: "example.test",
				},
			}),
		);

		await expect(response.json()).resolves.toEqual(
			expect.objectContaining({
				image_url:
					"http://example.test/api/bitmap/mixup/mix-4.bmp?width=800&height=480&grayscale=4&access_token=token-4",
				refresh_rate: 30,
			}),
		);
		expect(state.updateDeviceStatus).toHaveBeenCalledWith(
			expect.objectContaining({ friendly_id: "kiosk-1" }),
			expect.any(Object),
			30,
		);
	});

	it("renders a single-screen device through the screen bitmap route", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.findOrCreateDevice.mockResolvedValue({
			id: "5",
			friendly_id: "panel-5",
			screen: "screen-5",
			screen_id: "screen-5",
			screen_type: "screen",
			screen_orientation: null,
			screen_width: null,
			screen_height: null,
			grayscale: null,
			palette_id: "color-6a",
			display_mode: "single",
			refresh_schedule: null,
			timezone: null,
			firmware_version: "1.0.0",
		});
		state.getLatestFirmware.mockResolvedValue({
			version: "1.0.0",
			downloadUrl: "https://firmware.test/fw.bin",
		});
		state.isUpdateAvailable.mockReturnValue(false);
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/display", {
				headers: {
					"Access-Token": "token-5",
					host: "example.test",
					BASE64: "true",
				},
			}),
		);

		await expect(response.json()).resolves.toEqual(
			expect.objectContaining({
				image_url:
					"http://example.test/api/bitmap/screen/screen-5.bmp?width=800&height=480&grayscale=2&palette=color-6a&base64=true&access_token=token-5",
				refresh_rate: 180,
				image_rotate: 1,
			}),
		);
		expect(state.logInfo).toHaveBeenCalledWith(
			"Display request successful",
			expect.objectContaining({
				metadata: expect.objectContaining({
					screen: "screen-5",
					displayMode: "single",
				}),
			}),
		);
	});

	it("uses a known Palette-Id header when the device has no stored palette", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.findOrCreateDevice.mockResolvedValue({
			id: "55",
			friendly_id: "paper-55",
			screen: "screen-paper",
			screen_id: "screen-paper",
			screen_type: "screen",
			screen_orientation: "landscape",
			screen_width: null,
			screen_height: null,
			grayscale: 256,
			palette_id: null,
			display_mode: "single",
			refresh_schedule: null,
			timezone: null,
			firmware_version: "1.0.0",
		});
		state.getLatestFirmware.mockResolvedValue(null);
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/display", {
				headers: {
					"Access-Token": "paper-token",
					host: "example.test",
					Width: "600",
					Height: "400",
					"Palette-Id": "m5papercolor-ed2208-m5gfx-v1",
					"Color-Count": "6",
					"Display-Technology": "eink-spectra6",
					"Dither-Location": "server",
					"Preferred-Image-Format": "palette-bmp",
				},
			}),
		);

		await expect(response.json()).resolves.toEqual(
			expect.objectContaining({
				image_url:
					"http://example.test/api/bitmap/screen/screen-paper.bmp?width=600&height=400&grayscale=2&palette=m5papercolor-ed2208-m5gfx-v1&access_token=paper-token",
			}),
		);
	});

	it("prefers the stored device palette over the Palette-Id header", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.findOrCreateDevice.mockResolvedValue({
			id: "56",
			friendly_id: "panel-56",
			screen: "screen-56",
			screen_id: "screen-56",
			screen_type: "screen",
			screen_orientation: "landscape",
			screen_width: 800,
			screen_height: 480,
			grayscale: 256,
			palette_id: "color-6a",
			display_mode: "single",
			refresh_schedule: null,
			timezone: null,
			firmware_version: "1.0.0",
		});
		state.getLatestFirmware.mockResolvedValue(null);
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/display", {
				headers: {
					"Access-Token": "token-56",
					host: "example.test",
					"Palette-Id": "m5papercolor-ed2208-m5gfx-v1",
				},
			}),
		);

		await expect(response.json()).resolves.toEqual(
			expect.objectContaining({
				image_url:
					"http://example.test/api/bitmap/screen/screen-56.bmp?width=800&height=480&grayscale=2&palette=color-6a&access_token=token-56",
			}),
		);
	});

	it("includes the access token when mixup mode falls back to a named screen", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.findOrCreateDevice.mockResolvedValue({
			id: "8",
			friendly_id: "x-8",
			screen: null,
			screen_id: "screen-x",
			screen_type: "screen",
			screen_orientation: "landscape",
			screen_width: 1872,
			screen_height: 1404,
			grayscale: 2,
			display_mode: "mixup",
			mixup_id: null,
			refresh_schedule: null,
			timezone: "UTC",
			firmware_version: "1.0.0",
		});
		state.getLatestFirmware.mockResolvedValue(null);
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/display", {
				headers: {
					"Access-Token": "token-x",
					Width: "1872",
					Height: "1404",
					host: "example.test",
				},
			}),
		);

		await expect(response.json()).resolves.toEqual(
			expect.objectContaining({
				image_url:
					"http://example.test/api/bitmap/screen/screen-x.bmp?width=1872&height=1404&grayscale=2&access_token=token-x",
			}),
		);
	});

	it("falls back to the device screen when mixup mode has no mixup id", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.findOrCreateDevice.mockResolvedValue({
			id: "6",
			friendly_id: "hall-6",
			screen: "recipe-6",
			screen_id: null,
			screen_type: "recipe",
			screen_orientation: "landscape",
			screen_width: 1024,
			screen_height: 600,
			grayscale: 99,
			display_mode: "mixup",
			mixup_id: null,
			refresh_schedule: null,
			timezone: "UTC",
			firmware_version: "1.0.0",
		});
		state.getLatestFirmware.mockResolvedValue(null);
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/display", {
				headers: {
					"Access-Token": "token-6",
					host: "example.test",
				},
			}),
		);

		await expect(response.json()).resolves.toEqual(
			expect.objectContaining({
				image_url:
					"http://example.test/api/bitmap/recipe-6.bmp?width=1024&height=600&grayscale=2",
				refresh_rate: 180,
				image_rotate: 1,
			}),
		);
		expect(state.logInfo).not.toHaveBeenCalledWith(
			"Using mixup display mode",
			expect.anything(),
		);
	});

	it("returns a compat error response when device resolution fails", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.findOrCreateDevice.mockResolvedValue(null);
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/display", {
				headers: {
					"Access-Token": "token-5",
					host: "example.test",
				},
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual(
			expect.objectContaining({
				status: 500,
				message: "Device not found",
				image_url: "http://example.test/api/bitmap/not-found.bmp",
				reset_firmware: true,
			}),
		);
		expect(state.logError).toHaveBeenCalledWith(
			"Error fetching/creating device",
			expect.any(Object),
		);
	});

	it("returns an internal server compat response when display rendering throws", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.findOrCreateDevice.mockRejectedValue(new Error("boom"));
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/display", {
				headers: {
					"Access-Token": "token-6",
					host: "example.test",
				},
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual(
			expect.objectContaining({
				status: 500,
				message: "Internal server error",
				image_url: "http://example.test/api/bitmap/not-found.bmp",
			}),
		);
		expect(state.logError).toHaveBeenCalledWith(
			"Internal server error",
			expect.any(Object),
		);
	});
});
