import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	checkDbConnection: vi.fn(),
	db: {
		selectFrom: vi.fn(),
	},
	logError: vi.fn(),
	logInfo: vi.fn(),
	resolveRenderableContentType: vi.fn(),
}));

vi.mock("@/lib/content-ref", () => ({
	resolveRenderableContentType: state.resolveRenderableContentType,
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

const loadRoute = () => import("./route");

describe("app/api/display/current GET", () => {
	const mockDeviceLookup = (result: unknown) => {
		state.db.selectFrom.mockReturnValue({
			selectAll() {
				return this;
			},
			where: vi.fn(() => ({
				executeTakeFirst: vi.fn().mockResolvedValue(result),
			})),
		});
	};

	beforeEach(() => {
		vi.resetModules();
		state.checkDbConnection.mockReset();
		state.db.selectFrom.mockReset();
		state.logError.mockReset();
		state.logInfo.mockReset();
		state.resolveRenderableContentType.mockReset();
		state.resolveRenderableContentType.mockImplementation((type) => type);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("requires an access token", async () => {
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/display/current"),
		);

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toEqual({
			status: 401,
			error: "Access-Token header is required",
		});
	});

	it("returns 503 when the database is unavailable", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: false });
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/display/current", {
				headers: {
					"Access-Token": "token-1",
				},
			}),
		);

		expect(response.status).toBe(503);
		await expect(response.json()).resolves.toEqual({
			status: 503,
			error: "Database not available",
		});
		expect(state.logInfo).toHaveBeenCalledWith(
			"Database not available for /api/display/current",
			expect.objectContaining({
				source: "api/display/current",
				metadata: { apiKey: "token-1" },
			}),
		);
	});

	it("returns 404 when the device cannot be found", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		mockDeviceLookup(undefined);
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/display/current", {
				headers: {
					"Access-Token": "token-1",
				},
			}),
		);

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({
			status: 404,
			error: "Device not found",
		});
	});

	it("returns the current mixup bitmap URL using device dimensions and defaults", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		mockDeviceLookup({
			friendly_id: "device-1",
			screen_id: "screen-7",
			screen_type: "screen",
			screen_orientation: "landscape",
			screen_width: 600,
			screen_height: 448,
			grayscale: 7,
			display_mode: "mixup",
			mixup_id: "mix-9",
			refresh_schedule: { default_refresh_rate: 240 },
			last_update_time: "2026-06-13T10:00:00.000Z",
		});
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/display/current", {
				headers: {
					"Access-Token": "token-1",
					host: "example.test",
					"x-forwarded-proto": "https",
				},
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			status: 200,
			refresh_rate: 240,
			image_url:
				"https://example.test/api/bitmap/mixup/mix-9.bmp?width=600&height=448&grayscale=2&access_token=token-1",
			filename: "screen-7.bmp",
			rendered_at: "2026-06-13T10:00:00.000Z",
		});
		expect(state.logInfo).toHaveBeenCalledWith(
			"Current display request successful",
			expect.objectContaining({
				source: "api/display/current",
				metadata: {
					deviceId: "device-1",
					screen: "screen-7",
				},
			}),
		);
	});

	it("builds a screen bitmap URL with portrait defaults and fallback timestamps", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-13T12:34:56.000Z"));
		state.checkDbConnection.mockResolvedValue({ ready: true });
		mockDeviceLookup({
			friendly_id: "device-portrait",
			screen: "screen-9",
			screen_id: "screen-9",
			screen_type: "screen",
			screen_orientation: "portrait",
			screen_width: null,
			screen_height: null,
			grayscale: 16,
			display_mode: "screen",
			mixup_id: null,
			refresh_schedule: null,
			last_update_time: null,
		});
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://origin.test/api/display/current", {
				headers: {
					"Access-Token": "portrait-token",
					"x-forwarded-host": "proxy.example",
					"x-forwarded-proto": "https",
				},
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			status: 200,
			refresh_rate: 180,
			image_url:
				"https://proxy.example/api/bitmap/screen/screen-9.bmp?width=480&height=800&grayscale=16&access_token=portrait-token",
			filename: "screen-9.bmp",
			rendered_at: "2026-06-13T12:34:56.000Z",
		});
		expect(state.resolveRenderableContentType).toHaveBeenCalledWith(
			"screen",
			"screen-9",
		);
	});

	it("omits the access token for non-screen render targets", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.resolveRenderableContentType.mockReturnValue("recipe");
		mockDeviceLookup({
			friendly_id: "device-recipe",
			screen: "recipe-sunrise",
			screen_id: null,
			screen_type: "recipe",
			screen_orientation: "landscape",
			screen_width: 300,
			screen_height: 200,
			grayscale: 4,
			display_mode: "mixup",
			mixup_id: null,
			refresh_schedule: { default_refresh_rate: 99 },
			last_update_time: "2026-06-13T13:00:00.000Z",
		});
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://origin.test/api/display/current", {
				headers: {
					"Access-Token": "recipe-token",
					host: "origin.test",
					"x-forwarded-proto": "https",
				},
			}),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			status: 200,
			refresh_rate: 99,
			image_url:
				"https://origin.test/api/bitmap/recipe-sunrise.bmp?width=300&height=200&grayscale=4",
			filename: "recipe-sunrise.bmp",
			rendered_at: "2026-06-13T13:00:00.000Z",
		});
		expect(state.resolveRenderableContentType).toHaveBeenCalledWith(
			"recipe",
			"recipe-sunrise",
		);
	});

	it("returns 500 when the device lookup throws", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.db.selectFrom.mockReturnValue({
			selectAll() {
				return this;
			},
			where: vi.fn(() => ({
				executeTakeFirst: vi.fn().mockRejectedValue(new Error("db exploded")),
			})),
		});
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/display/current", {
				headers: {
					"Access-Token": "token-1",
				},
			}),
		);

		expect(response.status).toBe(500);
		await expect(response.json()).resolves.toEqual({
			status: 500,
			error: "Internal server error",
		});
		expect(state.logError).toHaveBeenCalledWith(
			expect.any(Error),
			expect.objectContaining({
				source: "api/display/current",
				metadata: { apiKey: "token-1" },
			}),
		);
	});
});
