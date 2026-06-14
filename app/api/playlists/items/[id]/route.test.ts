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

describe("app/api/playlists/items/[id] PATCH", () => {
	beforeEach(() => {
		vi.resetModules();
		state.checkDbConnection.mockReset();
		state.logError.mockReset();
		state.logInfo.mockReset();
		state.withUserScope.mockReset();
	});

	it("returns 503 when the database is unavailable", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: false });
		const { PATCH } = await loadRoute();

		const response = await PATCH(
			new Request("https://example.test/api/playlists/items/7", {
				method: "PATCH",
				body: JSON.stringify({ visible: true }),
			}),
			{ params: Promise.resolve({ id: "7" }) },
		);

		expect(response.status).toBe(503);
		await expect(response.json()).resolves.toEqual({
			error: "Database not available",
		});
		expect(state.withUserScope).not.toHaveBeenCalled();
	});

	it("validates the visible flag", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		const { PATCH } = await loadRoute();

		const response = await PATCH(
			new Request("https://example.test/api/playlists/items/7", {
				method: "PATCH",
				body: JSON.stringify({ visible: "yes" }),
			}),
			{ params: Promise.resolve({ id: "7" }) },
		);

		expect(response.status).toBe(422);
		await expect(response.json()).resolves.toEqual({
			error: "visible field is required and must be a boolean",
		});
	});

	it("returns 404 when the item does not exist", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.withUserScope.mockImplementation(async (runQuery) =>
			runQuery({
				selectFrom: vi.fn(() => ({
					selectAll() {
						return this;
					},
					where: vi.fn(() => ({
						executeTakeFirst: vi.fn().mockResolvedValue(undefined),
					})),
				})),
			} as never),
		);
		const { PATCH } = await loadRoute();

		const response = await PATCH(
			new Request("https://example.test/api/playlists/items/7", {
				method: "PATCH",
				body: JSON.stringify({ visible: false }),
			}),
			{ params: Promise.resolve({ id: "7" }) },
		);

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({
			error: "Playlist item not found",
		});
	});

	it("returns a compatibility success payload for existing items", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.withUserScope.mockImplementation(async (runQuery) =>
			runQuery({
				selectFrom: vi.fn(() => ({
					selectAll() {
						return this;
					},
					where: vi.fn(() => ({
						executeTakeFirst: vi.fn().mockResolvedValue({
							id: "7",
						}),
					})),
				})),
			} as never),
		);
		const { PATCH } = await loadRoute();

		const response = await PATCH(
			new Request("https://example.test/api/playlists/items/7", {
				method: "PATCH",
				body: JSON.stringify({ visible: true }),
			}),
			{ params: Promise.resolve({ id: "7" }) },
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			status: 200,
			message: "Playlist item updated",
		});
		expect(state.logInfo).toHaveBeenCalledWith(
			"Playlist item visibility update requested",
			{
				source: "api/playlists/items/[id]",
				metadata: { id: "7", visible: true },
			},
		);
	});

	it("returns 500 when the scoped query throws", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.withUserScope.mockRejectedValue(new Error("db failed"));
		const { PATCH } = await loadRoute();

		const response = await PATCH(
			new Request("https://example.test/api/playlists/items/7", {
				method: "PATCH",
				body: JSON.stringify({ visible: true }),
			}),
			{ params: Promise.resolve({ id: "7" }) },
		);

		expect(response.status).toBe(500);
		await expect(response.json()).resolves.toEqual({
			error: "Internal server error",
		});
		expect(state.logError).toHaveBeenCalledWith(expect.any(Error), {
			source: "api/playlists/items/[id]",
			metadata: { id: "7" },
		});
	});
});
