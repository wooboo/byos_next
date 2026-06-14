import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	checkDbConnection: vi.fn(),
	fetchRecipeConfig: vi.fn(),
	getScreenParams: vi.fn(),
	withExplicitUserScope: vi.fn(),
	db: {
		selectFrom: vi.fn(),
	},
}));

function makeRecipeQuery(result: unknown) {
	return {
		select() {
			return this;
		},
		where() {
			return this;
		},
		orderBy() {
			return this;
		},
		executeTakeFirst: vi.fn().mockResolvedValue(result),
	};
}

function makeScreenQuery(result: unknown) {
	return {
		innerJoin() {
			return this;
		},
		select() {
			return this;
		},
		where() {
			return this;
		},
		executeTakeFirst: vi.fn().mockResolvedValue(result),
	};
}

async function loadRenderTarget() {
	vi.resetModules();
	vi.doMock("@/app/actions/screens-params", () => ({
		getScreenParams: state.getScreenParams,
	}));
	vi.doMock("@/lib/database/db", () => ({
		db: state.db,
	}));
	vi.doMock("@/lib/database/scoped-db", () => ({
		withExplicitUserScope: state.withExplicitUserScope,
	}));
	vi.doMock("@/lib/database/utils", () => ({
		checkDbConnection: state.checkDbConnection,
	}));
	vi.doMock("@/lib/recipes/recipe-renderer", () => ({
		fetchRecipeConfig: state.fetchRecipeConfig,
	}));
	return import("./render-target");
}

describe("render target", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.resetModules();
		state.checkDbConnection.mockReset();
		state.fetchRecipeConfig.mockReset();
		state.getScreenParams.mockReset();
		state.withExplicitUserScope.mockReset();
		state.db.selectFrom.mockReset();
	});

	it("returns null when the database is not ready", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: false });
		const { resolveRenderableRef } = await loadRenderTarget();

		await expect(
			resolveRenderableRef({ type: "recipe", id: "recipe-1" }),
		).resolves.toBeNull();
	});

	it("resolves recipe refs to recipe defaults", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.db.selectFrom.mockImplementation((table: string) => {
			expect(table).toBe("recipes");
			return makeRecipeQuery({
				id: "recipe-1",
				slug: "weather",
				name: "Weather",
			});
		});
		state.fetchRecipeConfig.mockResolvedValue({
			params: [{ name: "city" }],
		});
		state.getScreenParams.mockResolvedValue({ city: "Warsaw" });
		const { resolveRenderableRef } = await loadRenderTarget();

		await expect(
			resolveRenderableRef({ type: "recipe", id: "weather" }),
		).resolves.toEqual({
			type: "recipe",
			id: "recipe-1",
			recipeId: "recipe-1",
			recipeSlug: "weather",
			recipeName: "Weather",
			params: { city: "Warsaw" },
			sourceName: "Weather",
		});
	});

	it("resolves recipe refs through an explicit user scope", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.withExplicitUserScope.mockImplementation(async (userId, runQuery) => {
			expect(userId).toBe("user-1");
			return runQuery({
				selectFrom: () =>
					makeRecipeQuery({
						id: "recipe-2",
						slug: "calendar",
						name: "Calendar",
					}),
			});
		});
		state.fetchRecipeConfig.mockResolvedValue(undefined);
		state.getScreenParams.mockResolvedValue({});
		const { resolveRecipeByIdOrSlug, resolveRenderableRef } =
			await loadRenderTarget();

		await expect(
			resolveRecipeByIdOrSlug("calendar", "user-1"),
		).resolves.toEqual({
			id: "recipe-2",
			slug: "calendar",
			name: "Calendar",
		});
		await expect(
			resolveRenderableRef({
				type: "recipe",
				id: "calendar",
				userId: "user-1",
			}),
		).resolves.toEqual({
			type: "recipe",
			id: "recipe-2",
			recipeId: "recipe-2",
			recipeSlug: "calendar",
			recipeName: "Calendar",
			params: {},
			sourceName: "Calendar",
		});
		expect(state.getScreenParams).toHaveBeenCalledWith(
			"calendar",
			undefined,
			"user-1",
		);
	});

	it("returns null when a recipe ref does not match a recipe", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.db.selectFrom.mockReturnValue(makeRecipeQuery(undefined));
		const { resolveRenderableRef } = await loadRenderTarget();

		await expect(
			resolveRenderableRef({ type: "recipe", id: "missing" }),
		).resolves.toBeNull();
		expect(state.fetchRecipeConfig).not.toHaveBeenCalled();
	});

	it("merges stored screen params over recipe defaults for valid screen ids", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.withExplicitUserScope.mockImplementation(async (userId, runQuery) => {
			expect(userId).toBe("user-2");
			return runQuery({
				selectFrom: () =>
					makeScreenQuery({
						screen_id: "550e8400-e29b-41d4-a716-446655440000",
						screen_name: "Living Room",
						screen_params: '{"city":"Berlin","units":"imperial"}',
						recipe_id: "recipe-1",
						recipe_slug: "weather",
						recipe_name: "Weather",
					}),
			});
		});
		state.fetchRecipeConfig.mockResolvedValue({
			params: [{ name: "city" }, { name: "units" }],
		});
		state.getScreenParams.mockResolvedValue({
			city: "Warsaw",
			units: "metric",
			theme: "dark",
		});
		const { resolveRenderableRef } = await loadRenderTarget();

		await expect(
			resolveRenderableRef({
				type: "screen",
				id: "550e8400-e29b-41d4-a716-446655440000",
				userId: "user-2",
			}),
		).resolves.toEqual({
			type: "screen",
			id: "550e8400-e29b-41d4-a716-446655440000",
			recipeId: "recipe-1",
			recipeSlug: "weather",
			recipeName: "Weather",
			params: {
				city: "Berlin",
				units: "imperial",
				theme: "dark",
			},
			sourceName: "Living Room",
		});
	});

	it("rejects invalid screen ids before querying", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		const { resolveRenderableRef } = await loadRenderTarget();

		await expect(
			resolveRenderableRef({ type: "screen", id: "screen-name" }),
		).resolves.toBeNull();
		expect(state.withExplicitUserScope).not.toHaveBeenCalled();
		expect(state.db.selectFrom).not.toHaveBeenCalled();
	});

	it("returns null when a valid screen id has no row", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.db.selectFrom.mockReturnValue(makeScreenQuery(undefined));
		const { resolveRenderableRef } = await loadRenderTarget();

		await expect(
			resolveRenderableRef({
				type: "screen",
				id: "550e8400-e29b-41d4-a716-446655440000",
			}),
		).resolves.toBeNull();
		expect(state.fetchRecipeConfig).not.toHaveBeenCalled();
	});

	it("uses object screen params without recipe defaults when no definitions exist", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.db.selectFrom.mockReturnValue(
			makeScreenQuery({
				screen_id: "550e8400-e29b-41d4-a716-446655440000",
				screen_name: "Desk",
				screen_params: { city: "Paris" },
				recipe_id: "recipe-3",
				recipe_slug: "weather",
				recipe_name: "Weather",
			}),
		);
		state.fetchRecipeConfig.mockResolvedValue(undefined);
		const { resolveRenderableRef } = await loadRenderTarget();

		await expect(
			resolveRenderableRef({
				type: "screen",
				id: "550e8400-e29b-41d4-a716-446655440000",
			}),
		).resolves.toEqual({
			type: "screen",
			id: "550e8400-e29b-41d4-a716-446655440000",
			recipeId: "recipe-3",
			recipeSlug: "weather",
			recipeName: "Weather",
			params: { city: "Paris" },
			sourceName: "Desk",
		});
		expect(state.getScreenParams).not.toHaveBeenCalled();
	});
});
