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

describe("app/api/playlists/items GET", () => {
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

		const response = await GET(
			new Request("https://example.test/api/playlists/items"),
		);

		expect(response.status).toBe(503);
		await expect(response.json()).resolves.toEqual({
			error: "Database not available",
		});
		expect(state.withUserScope).not.toHaveBeenCalled();
	});

	it("maps playlist items to the TRMNL response contract", async () => {
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
							id: "7",
							screen_id: "screen-7",
							order_index: 3,
							created_at: new Date("2024-02-03T04:05:06.000Z"),
						},
					]),
				})),
			} as never),
		);
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/playlists/items"),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			data: [
				{
					id: 7,
					device_id: null,
					playlist_group_id: null,
					plugin_setting_id: null,
					mashup_id: null,
					screen_id: "screen-7",
					visible: true,
					mirror: false,
					row_order: 3,
					created_at: "2024-02-03T04:05:06.000Z",
					updated_at: "2024-02-03T04:05:06.000Z",
					rendered_at: null,
					plugin_setting: null,
				},
			],
		});
		expect(state.logInfo).toHaveBeenCalledWith(
			"Playlist items list request successful",
			expect.objectContaining({
				source: "api/playlists/items",
				metadata: { count: 1 },
			}),
		);
	});
});
