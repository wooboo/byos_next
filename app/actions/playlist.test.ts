import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	checkDbConnection: vi.fn(),
	getCurrentUserId: vi.fn(),
	revalidatePath: vi.fn(),
	withUserScope: vi.fn(),
	withUserScopeTransaction: vi.fn(),
}));

async function loadPlaylist() {
	vi.resetModules();
	vi.doMock("next/cache", () => ({
		revalidatePath: state.revalidatePath,
	}));
	vi.doMock("@/lib/auth/get-user", () => ({
		getCurrentUserId: state.getCurrentUserId,
	}));
	vi.doMock("@/lib/database/scoped-db", () => ({
		withUserScope: state.withUserScope,
		withUserScopeTransaction: state.withUserScopeTransaction,
	}));
	vi.doMock("@/lib/database/utils", () => ({
		checkDbConnection: state.checkDbConnection,
	}));

	return import("./playlist");
}

describe("playlist actions", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.resetModules();
		state.checkDbConnection.mockReset();
		state.getCurrentUserId.mockReset();
		state.revalidatePath.mockReset();
		state.withUserScope.mockReset();
		state.withUserScopeTransaction.mockReset();
	});

	it("returns an empty playlist payload when the database is unavailable", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: false });
		const { fetchPlaylistWithItems } = await loadPlaylist();

		await expect(fetchPlaylistWithItems("playlist-1")).resolves.toEqual({
			playlist: null,
			items: [],
		});
	});

	it("returns an empty playlist payload when the playlist does not exist", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.withUserScope.mockResolvedValue([undefined, [{ id: "item-1" }]]);
		const { fetchPlaylistWithItems } = await loadPlaylist();

		await expect(fetchPlaylistWithItems("playlist-missing")).resolves.toEqual({
			playlist: null,
			items: [],
		});
	});

	it("fetches a playlist together with its ordered items", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.withUserScope.mockResolvedValue([
			{ id: "playlist-7", name: "Morning" },
			[{ id: "item-1", order_index: 0 }],
		]);
		const { fetchPlaylistWithItems } = await loadPlaylist();

		await expect(fetchPlaylistWithItems("playlist-7")).resolves.toEqual({
			playlist: { id: "playlist-7", name: "Morning" },
			items: [{ id: "item-1", order_index: 0 }],
		});
	});

	it("deletes a playlist and revalidates the listing", async () => {
		const where = vi.fn().mockReturnThis();
		const execute = vi.fn().mockResolvedValue(undefined);

		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.withUserScope.mockImplementation(async (callback) =>
			callback({
				deleteFrom: vi.fn().mockReturnValue({
					where,
					execute,
				}),
			}),
		);
		const { deletePlaylist } = await loadPlaylist();

		await expect(deletePlaylist("playlist-2")).resolves.toEqual({
			success: true,
		});
		expect(where).toHaveBeenCalledWith("id", "=", "playlist-2");
		expect(state.revalidatePath).toHaveBeenCalledWith("/playlists");
	});

	it("creates a playlist with JSON-encoded schedule constraints", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue("user-1");
		state.withUserScopeTransaction.mockImplementation(async (callback) =>
			callback({
				insertInto: vi.fn((table: string) => {
					if (table === "playlists") {
						return {
							values: vi.fn().mockReturnValue({
								returning: vi.fn().mockReturnValue({
									executeTakeFirstOrThrow: vi
										.fn()
										.mockResolvedValue({ id: "playlist-1" }),
								}),
							}),
						};
					}

					return {
						values: vi.fn().mockReturnValue({
							execute: vi.fn().mockResolvedValue(undefined),
						}),
					};
				}),
			}),
		);
		const { savePlaylistWithItems } = await loadPlaylist();

		await expect(
			savePlaylistWithItems({
				name: "Morning",
				items: [
					{
						screen_id: "screen-1",
						duration: 60,
						order_index: 0,
						days_of_week: ["mon", "wed"],
					},
				],
			}),
		).resolves.toEqual({
			success: true,
			playlistId: "playlist-1",
		});
		expect(state.revalidatePath).toHaveBeenCalledWith("/playlists");
	});

	it("updates an existing playlist by replacing its items", async () => {
		const deleteWhere = vi.fn().mockReturnThis();
		const deleteExecute = vi.fn().mockResolvedValue(undefined);
		const updateWhere = vi.fn().mockReturnThis();
		const updateExecute = vi.fn().mockResolvedValue(undefined);
		const insertItemsExecute = vi.fn().mockResolvedValue(undefined);

		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue("user-1");
		state.withUserScopeTransaction.mockImplementation(async (callback) =>
			callback({
				deleteFrom: vi.fn().mockReturnValue({
					where: deleteWhere,
					execute: deleteExecute,
				}),
				insertInto: vi.fn().mockReturnValue({
					values: vi.fn().mockReturnValue({
						execute: insertItemsExecute,
					}),
				}),
				updateTable: vi.fn().mockReturnValue({
					set: vi.fn().mockReturnValue({
						where: updateWhere,
						execute: updateExecute,
					}),
				}),
			}),
		);
		const { savePlaylistWithItems } = await loadPlaylist();

		await expect(
			savePlaylistWithItems({
				id: "playlist-2",
				name: "Updated",
				items: [],
			}),
		).resolves.toEqual({
			success: true,
			playlistId: "playlist-2",
		});
		expect(updateWhere).toHaveBeenCalledWith("id", "=", "playlist-2");
		expect(deleteWhere).toHaveBeenCalledWith("playlist_id", "=", "playlist-2");
	});

	it("returns action errors when deleting a playlist fails", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.withUserScope.mockRejectedValue(new Error("playlist delete failed"));
		const { deletePlaylist } = await loadPlaylist();

		await expect(deletePlaylist("playlist-9")).resolves.toEqual({
			success: false,
			error: "playlist delete failed",
		});
	});
});
