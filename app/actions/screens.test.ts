import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	checkDbConnection: vi.fn(),
	getCurrentUserId: vi.fn(),
	getRecipeDefaultsSnapshot: vi.fn(),
	revalidatePath: vi.fn(),
	resolveRecipeByIdOrSlug: vi.fn(),
	withUserScope: vi.fn(),
}));

async function loadScreens() {
	vi.resetModules();
	vi.doMock("next/cache", () => ({
		revalidatePath: state.revalidatePath,
	}));
	vi.doMock("@/lib/auth/get-user", () => ({
		getCurrentUserId: state.getCurrentUserId,
	}));
	vi.doMock("@/lib/database/scoped-db", () => ({
		withUserScope: state.withUserScope,
	}));
	vi.doMock("@/lib/database/utils", () => ({
		checkDbConnection: state.checkDbConnection,
	}));
	vi.doMock("@/lib/screens/render-target", () => ({
		getRecipeDefaultsSnapshot: state.getRecipeDefaultsSnapshot,
		resolveRecipeByIdOrSlug: state.resolveRecipeByIdOrSlug,
	}));

	return import("./screens");
}

describe("screens actions", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.resetModules();
		state.checkDbConnection.mockReset();
		state.getCurrentUserId.mockReset();
		state.getRecipeDefaultsSnapshot.mockReset();
		state.revalidatePath.mockReset();
		state.resolveRecipeByIdOrSlug.mockReset();
		state.withUserScope.mockReset();
	});

	it("lists screens only when the database is ready", async () => {
		state.checkDbConnection.mockResolvedValueOnce({ ready: false });
		const { listScreens } = await loadScreens();

		await expect(listScreens()).resolves.toEqual([]);

		state.checkDbConnection.mockResolvedValueOnce({ ready: true });
		state.withUserScope.mockResolvedValueOnce([{ id: "screen-1" }]);

		await expect(listScreens()).resolves.toEqual([{ id: "screen-1" }]);
		expect(state.withUserScope).toHaveBeenCalledTimes(1);
	});

	it("creates a screen from a recipe with trimmed name and defaults", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue("user-1");
		state.resolveRecipeByIdOrSlug.mockResolvedValue({
			id: "recipe-1",
			slug: "clock",
		});
		state.getRecipeDefaultsSnapshot.mockResolvedValue({ theme: "dark" });
		state.withUserScope.mockImplementation(async (callback) =>
			callback({
				insertInto: vi.fn().mockReturnValue({
					values: vi.fn().mockReturnValue({
						returning: vi.fn().mockReturnValue({
							execute: vi
								.fn()
								.mockResolvedValue([{ id: "screen-1", name: "Lobby" }]),
						}),
					}),
				}),
			}),
		);
		const { createScreenFromRecipe } = await loadScreens();

		await expect(createScreenFromRecipe("clock", "  Lobby  ")).resolves.toEqual(
			{
				success: true,
				screen: { id: "screen-1", name: "Lobby" },
			},
		);
		expect(state.revalidatePath).toHaveBeenCalledWith("/screens");
	});

	it("rejects creating a screen when the database is unavailable", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: false });
		const { createScreenFromRecipe } = await loadScreens();

		await expect(createScreenFromRecipe("clock", "Lobby")).resolves.toEqual({
			success: false,
			error: "Database client not initialized",
		});
	});

	it("rejects creating a screen when the user is not signed in", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue(null);
		const { createScreenFromRecipe } = await loadScreens();

		await expect(createScreenFromRecipe("clock", "Lobby")).resolves.toEqual({
			success: false,
			error: "You must be signed in",
		});
	});

	it("rejects creating a screen when the recipe is missing", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue("user-1");
		state.resolveRecipeByIdOrSlug.mockResolvedValue(null);
		const { createScreenFromRecipe } = await loadScreens();

		await expect(createScreenFromRecipe("missing", "Lobby")).resolves.toEqual({
			success: false,
			error: "Recipe not found",
		});
	});

	it("rejects creating a screen when the trimmed name is blank", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue("user-1");
		state.resolveRecipeByIdOrSlug.mockResolvedValue({
			id: "recipe-1",
			slug: "clock",
		});
		const { createScreenFromRecipe } = await loadScreens();

		await expect(createScreenFromRecipe("clock", "   ")).resolves.toEqual({
			success: false,
			error: "Screen name is required",
		});
	});

	it("clones a screen with the same recipe and params", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue("user-1");
		const values = vi.fn().mockReturnThis();
		const returning = vi.fn().mockReturnThis();
		const execute = vi
			.fn()
			.mockResolvedValue([{ id: "screen-copy", name: "Lobby copy" }]);

		state.withUserScope
			.mockImplementationOnce(async (callback) =>
				callback({
					selectFrom: vi.fn().mockReturnValue({
						select: vi.fn().mockReturnThis(),
						where: vi.fn().mockReturnThis(),
						executeTakeFirst: vi.fn().mockResolvedValue({
							name: "Lobby",
							recipe_id: "recipe-1",
							params: '{"theme":"dark"}',
						}),
					}),
				}),
			)
			.mockImplementationOnce(async (callback) =>
				callback({
					insertInto: vi.fn().mockReturnValue({
						values,
						returning,
						execute,
					}),
				}),
			);
		const { cloneScreen } = await loadScreens();

		await expect(cloneScreen("screen-1")).resolves.toEqual({
			success: true,
			screen: { id: "screen-copy", name: "Lobby copy" },
		});
		expect(values).toHaveBeenCalledWith({
			user_id: "user-1",
			name: "Lobby copy",
			recipe_id: "recipe-1",
			params: { theme: "dark" },
		});
		expect(returning).toHaveBeenCalledWith(["id", "name"]);
		expect(execute).toHaveBeenCalled();
		expect(state.revalidatePath).toHaveBeenNthCalledWith(1, "/screens");
		expect(state.revalidatePath).toHaveBeenNthCalledWith(
			2,
			"/screens/screen-copy",
		);
	});

	it("rejects cloning when the source screen is missing", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue("user-1");
		state.withUserScope.mockImplementationOnce(async (callback) =>
			callback({
				selectFrom: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnThis(),
					where: vi.fn().mockReturnThis(),
					executeTakeFirst: vi.fn().mockResolvedValue(null),
				}),
			}),
		);
		const { cloneScreen } = await loadScreens();

		await expect(cloneScreen("missing")).resolves.toEqual({
			success: false,
			error: "Screen not found",
		});
	});

	it("renames a screen and revalidates the screen pages", async () => {
		const set = vi.fn().mockReturnThis();
		const where = vi.fn().mockReturnThis();
		const execute = vi.fn().mockResolvedValue(undefined);

		state.withUserScope.mockImplementation(async (callback) =>
			callback({
				updateTable: vi.fn().mockReturnValue({
					set,
					where,
					execute,
				}),
			}),
		);
		const { renameScreen } = await loadScreens();

		await expect(renameScreen("screen-1", "  Renamed  ")).resolves.toEqual({
			success: true,
		});
		expect(set).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Renamed",
				updated_at: expect.any(Date),
			}),
		);
		expect(state.revalidatePath).toHaveBeenNthCalledWith(1, "/screens");
		expect(state.revalidatePath).toHaveBeenNthCalledWith(
			2,
			"/screens/screen-1",
		);
	});

	it("rejects renaming a screen when the trimmed name is blank", async () => {
		const { renameScreen } = await loadScreens();

		await expect(renameScreen("screen-1", "   ")).resolves.toEqual({
			success: false,
			error: "Screen name is required",
		});
	});

	it("deletes a screen and revalidates the screen pages", async () => {
		const deleteFrom = vi.fn().mockReturnThis();
		const where = vi.fn().mockReturnThis();
		const execute = vi.fn().mockResolvedValue(undefined);

		state.withUserScope.mockImplementation(async (callback) =>
			callback({
				deleteFrom,
				where,
				execute,
			}),
		);
		const { deleteScreen } = await loadScreens();

		await expect(deleteScreen("screen-3")).resolves.toEqual({
			success: true,
		});
		expect(deleteFrom).toHaveBeenCalledWith("screens");
		expect(where).toHaveBeenCalledWith("id", "=", "screen-3");
		expect(execute).toHaveBeenCalled();
		expect(state.revalidatePath).toHaveBeenNthCalledWith(1, "/screens");
		expect(state.revalidatePath).toHaveBeenNthCalledWith(
			2,
			"/screens/screen-3",
		);
	});

	it("updates named screen params and refreshes bitmap output", async () => {
		const set = vi.fn().mockReturnThis();
		const where = vi.fn().mockReturnThis();
		const execute = vi.fn().mockResolvedValue(undefined);

		state.withUserScope.mockImplementation(async (callback) =>
			callback({
				updateTable: vi.fn().mockReturnValue({
					set,
					where,
					execute,
				}),
			}),
		);
		const { updateNamedScreenParams } = await loadScreens();

		await expect(
			updateNamedScreenParams("screen-2", { accent: "red" }),
		).resolves.toEqual({
			success: true,
		});
		expect(set).toHaveBeenCalledWith(
			expect.objectContaining({
				params: { accent: "red" },
				updated_at: expect.any(Date),
			}),
		);
		expect(state.revalidatePath).toHaveBeenNthCalledWith(
			1,
			"/screens/screen-2",
		);
		expect(state.revalidatePath).toHaveBeenNthCalledWith(
			2,
			"/api/bitmap/screen/screen-2.bmp",
		);
	});
});
