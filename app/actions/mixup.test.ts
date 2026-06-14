import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	checkDbConnection: vi.fn(),
	getCurrentUserId: vi.fn(),
	revalidatePath: vi.fn(),
	withUserScope: vi.fn(),
	withUserScopeTransaction: vi.fn(),
}));

async function loadMixup() {
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

	return import("./mixup");
}

describe("mixup actions", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-03T04:05:06.000Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		vi.resetModules();
		state.checkDbConnection.mockReset();
		state.getCurrentUserId.mockReset();
		state.revalidatePath.mockReset();
		state.withUserScope.mockReset();
		state.withUserScopeTransaction.mockReset();
	});

	it("returns an empty mixup list when the database is unavailable", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: false });
		const { fetchMixups } = await loadMixup();

		await expect(fetchMixups()).resolves.toEqual([]);
	});

	it("returns an empty payload for mixup slots when the database is unavailable", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: false });
		const { fetchMixupWithSlots } = await loadMixup();

		await expect(fetchMixupWithSlots("mixup-0")).resolves.toEqual({
			mixup: null,
			slots: [],
		});
	});

	it("creates a mixup for the current user", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue("user-1");
		state.withUserScope.mockImplementation(async (callback) =>
			callback({
				insertInto: vi.fn().mockReturnValue({
					values: vi.fn().mockReturnValue({
						returningAll: vi.fn().mockReturnValue({
							executeTakeFirst: vi
								.fn()
								.mockResolvedValue({ id: "mixup-1", name: "Board" }),
						}),
					}),
				}),
			}),
		);
		const { createMixup } = await loadMixup();

		await expect(createMixup("Board", "quarters")).resolves.toEqual({
			success: true,
			mixup: { id: "mixup-1", name: "Board" },
		});
	});

	it("returns a database error when creating a mixup without a connection", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: false });
		const { createMixup } = await loadMixup();

		await expect(createMixup("Board", "quarters")).resolves.toEqual({
			success: false,
			error: "Database client not initialized",
		});
	});

	it("returns create errors from createMixup", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue("user-1");
		state.withUserScope.mockRejectedValue(new Error("mixup create failed"));
		const { createMixup } = await loadMixup();

		await expect(createMixup("Board", "quarters")).resolves.toEqual({
			success: false,
			error: "mixup create failed",
		});
	});

	it("returns an empty payload when a mixup is not found", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.withUserScope.mockResolvedValue([undefined, [{ id: "slot-1" }]]);
		const { fetchMixupWithSlots } = await loadMixup();

		await expect(fetchMixupWithSlots("missing")).resolves.toEqual({
			mixup: null,
			slots: [],
		});
	});

	it("fetches a mixup together with its ordered slots", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.withUserScope.mockResolvedValue([
			{ id: "mixup-1", name: "Board" },
			[{ id: "slot-1", order_index: 0 }],
		]);
		const { fetchMixupWithSlots } = await loadMixup();

		await expect(fetchMixupWithSlots("mixup-1")).resolves.toEqual({
			mixup: { id: "mixup-1", name: "Board" },
			slots: [{ id: "slot-1", order_index: 0 }],
		});
	});

	it("updates an existing mixup", async () => {
		const execute = vi.fn().mockResolvedValue(undefined);
		const where = vi.fn().mockReturnValue({ execute });
		const set = vi.fn().mockReturnValue({ where });

		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.withUserScope.mockImplementation(async (callback) =>
			callback({
				updateTable: vi.fn().mockReturnValue({ set }),
			}),
		);
		const { updateMixup } = await loadMixup();

		await expect(
			updateMixup("mixup-7", "Renamed", "quarters"),
		).resolves.toEqual({ success: true });
		expect(set).toHaveBeenCalledWith({
			name: "Renamed",
			layout_id: "quarters",
			updated_at: "2026-02-03T04:05:06.000Z",
		});
		expect(where).toHaveBeenCalledWith("id", "=", "mixup-7");
	});

	it("returns update errors from updateMixup", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.withUserScope.mockRejectedValue(new Error("mixup update failed"));
		const { updateMixup } = await loadMixup();

		await expect(
			updateMixup("mixup-8", "Renamed", "quarters"),
		).resolves.toEqual({
			success: false,
			error: "mixup update failed",
		});
	});

	it("returns a database error when updating a mixup without a connection", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: false });
		const { updateMixup } = await loadMixup();

		await expect(
			updateMixup("mixup-8", "Renamed", "quarters"),
		).resolves.toEqual({
			success: false,
			error: "Database client not initialized",
		});
	});

	it("deletes a mixup and revalidates the page", async () => {
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
		const { deleteMixup } = await loadMixup();

		await expect(deleteMixup("mixup-2")).resolves.toEqual({ success: true });
		expect(where).toHaveBeenCalledWith("id", "=", "mixup-2");
		expect(state.revalidatePath).toHaveBeenCalledWith("/mixup");
	});

	it("returns delete errors from deleteMixup", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.withUserScope.mockRejectedValue(new Error("mixup delete failed"));
		const { deleteMixup } = await loadMixup();

		await expect(deleteMixup("mixup-3")).resolves.toEqual({
			success: false,
			error: "mixup delete failed",
		});
	});

	it("returns a database error when deleting a mixup without a connection", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: false });
		const { deleteMixup } = await loadMixup();

		await expect(deleteMixup("mixup-4")).resolves.toEqual({
			success: false,
			error: "Database client not initialized",
		});
	});

	it("stores slot assignments with explicit ref types", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue("user-1");
		state.withUserScopeTransaction.mockImplementation(async (callback) =>
			callback({
				insertInto: vi.fn((table: string) => {
					if (table === "mixups") {
						return {
							values: vi.fn().mockReturnValue({
								returning: vi.fn().mockReturnValue({
									executeTakeFirstOrThrow: vi
										.fn()
										.mockResolvedValue({ id: "mixup-3" }),
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
		const { saveMixupWithSlots } = await loadMixup();

		await expect(
			saveMixupWithSlots({
				name: "Layout",
				layout_id: "quarters",
				assignments: {
					"slot-a": "recipe:recipe-1",
					"slot-b": "screen-2",
				},
			}),
		).resolves.toEqual({
			success: true,
			mixupId: "mixup-3",
		});
		expect(state.revalidatePath).toHaveBeenCalledWith("/mixup");
	});

	it("updates an existing mixup and skips slot inserts when assignments are empty", async () => {
		const deleteExecute = vi.fn().mockResolvedValue(undefined);
		const updateExecute = vi.fn().mockResolvedValue(undefined);
		const insertInto = vi.fn();

		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue("user-1");
		state.withUserScopeTransaction.mockImplementation(async (callback) =>
			callback({
				deleteFrom: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						execute: deleteExecute,
					}),
				}),
				insertInto,
				updateTable: vi.fn().mockReturnValue({
					set: vi.fn().mockReturnValue({
						where: vi.fn().mockReturnValue({
							execute: updateExecute,
						}),
					}),
				}),
			}),
		);
		const { saveMixupWithSlots } = await loadMixup();

		await expect(
			saveMixupWithSlots({
				id: "mixup-10",
				name: "Updated",
				layout_id: "quarters",
				assignments: {},
			}),
		).resolves.toEqual({
			success: true,
			mixupId: "mixup-10",
		});
		expect(insertInto).not.toHaveBeenCalled();
		expect(deleteExecute).toHaveBeenCalledTimes(1);
	});

	it("returns transaction failures while saving a mixup", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue("user-1");
		state.withUserScopeTransaction.mockRejectedValue(
			new Error("slot insert failed"),
		);
		const { saveMixupWithSlots } = await loadMixup();

		await expect(
			saveMixupWithSlots({
				id: "mixup-9",
				name: "Broken",
				layout_id: "quarters",
				assignments: {},
			}),
		).resolves.toEqual({
			success: false,
			error: "slot insert failed",
		});
	});

	it("returns a database error when saving a mixup without a connection", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: false });
		const { saveMixupWithSlots } = await loadMixup();

		await expect(
			saveMixupWithSlots({
				name: "Offline",
				layout_id: "quarters",
				assignments: {},
			}),
		).resolves.toEqual({
			success: false,
			error: "Database client not initialized",
		});
	});

	it("fetches visible recipes ordered by name", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.withUserScope.mockResolvedValue([
			{ id: "recipe-1", name: "Alpha" },
			{ id: "recipe-2", name: "Beta" },
		]);
		const { fetchRecipes } = await loadMixup();

		await expect(fetchRecipes()).resolves.toEqual([
			{ id: "recipe-1", name: "Alpha" },
			{ id: "recipe-2", name: "Beta" },
		]);
	});

	it("returns an empty recipe list when the database is unavailable", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: false });
		const { fetchRecipes } = await loadMixup();

		await expect(fetchRecipes()).resolves.toEqual([]);
	});
});
