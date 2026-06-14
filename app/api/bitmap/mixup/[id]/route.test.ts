import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	auth: null as null | {
		api: {
			getSession: ReturnType<typeof vi.fn>;
		};
	},
	checkDbConnection: vi.fn(),
	db: {
		selectFrom: vi.fn(),
	},
	getLayoutById: vi.fn(),
	logger: {
		error: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
	},
	parseBitmapOptions: vi.fn(),
	renderBmp: vi.fn(),
	renderRecipeToImage: vi.fn(),
	resolveRenderableRef: vi.fn(),
	sharp: vi.fn(),
	withExplicitUserScope: vi.fn(),
}));

vi.mock("next/headers", () => ({
	headers: vi.fn().mockResolvedValue(new Headers()),
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

vi.mock("@/lib/mixup/constants", () => ({
	getLayoutById: state.getLayoutById,
}));

vi.mock("@/lib/recipes/recipe-renderer", () => ({
	logger: state.logger,
	renderRecipeToImage: state.renderRecipeToImage,
}));

vi.mock("@/lib/screens/render-target", () => ({
	resolveRenderableRef: state.resolveRenderableRef,
}));

vi.mock("@/utils/render-bmp", () => ({
	DitheringMethod: { ATKINSON: "ATKINSON" },
	renderBmp: state.renderBmp,
}));

vi.mock("../../render-utils", async () => {
	const actual =
		await vi.importActual<typeof import("../../render-utils")>(
			"../../render-utils",
		);
	return {
		...actual,
		parseBitmapOptions: state.parseBitmapOptions,
	};
});

vi.mock("sharp", () => ({
	default: state.sharp,
}));

const loadRoute = () => {
	vi.doMock("@/lib/auth/auth", () => ({
		auth: state.auth,
	}));
	return import("./route");
};

describe("app/api/bitmap/mixup/[id] GET", () => {
	beforeEach(() => {
		vi.resetModules();
		state.auth = null;
		state.checkDbConnection.mockReset();
		state.db.selectFrom.mockReset();
		state.getLayoutById.mockReset();
		state.logger.error.mockReset();
		state.logger.info.mockReset();
		state.logger.warn.mockReset();
		state.parseBitmapOptions.mockReset();
		state.renderBmp.mockReset();
		state.renderRecipeToImage.mockReset();
		state.resolveRenderableRef.mockReset();
		state.sharp.mockReset();
		state.withExplicitUserScope.mockReset();
		state.parseBitmapOptions.mockReturnValue({
			width: 800,
			height: 480,
			grayscale: 16,
		});
		state.sharp.mockImplementation((input: Buffer | { create: unknown }) => {
			if (Buffer.isBuffer(input)) {
				return {
					resize: vi.fn((width: number, height: number) => ({
						toBuffer: vi.fn(async () =>
							Buffer.from(`resized:${width}x${height}:${input.toString()}`),
						),
					})),
				};
			}

			return {
				composite: vi.fn((overlays: unknown[]) => ({
					png: vi.fn(() => ({
						toBuffer: vi.fn(async () =>
							Buffer.from(`composited:${overlays.length}`),
						),
					})),
				})),
			};
		});
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("returns 401 when no access token or authenticated session is available", async () => {
		vi.stubEnv("AUTH_ENABLED", "true");
		state.checkDbConnection.mockResolvedValue({ ready: true });
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/bitmap/mixup/mix-1.bmp") as never,
			{ params: Promise.resolve({ id: "mix-1.bmp" }) },
		);

		expect(response.status).toBe(401);
		await expect(response.text()).resolves.toBe("Access token is required");
	});

	it("returns 404 when the device token does not map to an owned device", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.db.selectFrom.mockReturnValue({
			select: vi.fn(() => ({
				where: vi.fn(() => ({
					executeTakeFirst: vi.fn().mockResolvedValue(undefined),
				})),
			})),
		});
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/bitmap/mixup/mix-1.bmp", {
				headers: { "Access-Token": "token-1" },
			}) as never,
			{ params: Promise.resolve({ id: "mix-1.bmp" }) },
		);

		expect(response.status).toBe(404);
		await expect(response.text()).resolves.toBe("Mixup not found");
	});

	it("returns 503 when the database is unavailable", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: false });
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/bitmap/mixup/mix-1.bmp") as never,
			{ params: Promise.resolve({ id: "mix-1.bmp" }) },
		);

		expect(response.status).toBe(503);
		await expect(response.text()).resolves.toBe("Database not available");
		expect(state.logger.error).toHaveBeenCalledWith(
			"Database not available for mixup rendering",
		);
	});

	it("uses the authenticated session when no device token is provided", async () => {
		state.auth = {
			api: {
				getSession: vi.fn().mockResolvedValue({
					user: { id: "user-1" },
				}),
			},
		};
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.db.selectFrom.mockImplementation((table: string) => {
			if (table === "mixups") {
				return {
					select: vi.fn(() => ({
						where: vi.fn(() => ({
							executeTakeFirst: vi
								.fn()
								.mockResolvedValue({ user_id: "user-1" }),
						})),
					})),
				};
			}

			throw new Error(`Unexpected table lookup: ${table}`);
		});
		state.withExplicitUserScope.mockResolvedValue([
			{ layout_id: "layout-1" },
			[],
		]);
		state.getLayoutById.mockReturnValue({ slots: [] });
		state.renderBmp.mockResolvedValue(Buffer.from("session-bmp"));
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/bitmap/mixup/mix-1.bmp") as never,
			{ params: Promise.resolve({ id: "mix-1.bmp" }) },
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("image/bmp");
		expect(Buffer.from(await response.arrayBuffer())).toEqual(
			Buffer.from("session-bmp"),
		);
		expect(state.auth.api.getSession).toHaveBeenCalledWith({
			headers: expect.any(Headers),
		});
		expect(state.withExplicitUserScope).toHaveBeenCalledWith(
			"user-1",
			expect.any(Function),
		);
	});

	it("returns 401 when the authenticated session is missing a user id", async () => {
		state.auth = {
			api: {
				getSession: vi.fn().mockResolvedValue(null),
			},
		};
		state.checkDbConnection.mockResolvedValue({ ready: true });
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/bitmap/mixup/mix-1.bmp") as never,
			{ params: Promise.resolve({ id: "mix-1.bmp" }) },
		);

		expect(response.status).toBe(401);
		await expect(response.text()).resolves.toBe("Access token is required");
	});

	it("returns 404 when the authenticated session does not own the mixup", async () => {
		state.auth = {
			api: {
				getSession: vi.fn().mockResolvedValue({
					user: { id: "user-2" },
				}),
			},
		};
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.db.selectFrom.mockImplementation((table: string) => {
			if (table === "mixups") {
				return {
					select: vi.fn(() => ({
						where: vi.fn(() => ({
							executeTakeFirst: vi
								.fn()
								.mockResolvedValue({ user_id: "user-1" }),
						})),
					})),
				};
			}

			throw new Error(`Unexpected table lookup: ${table}`);
		});
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/bitmap/mixup/mix-1.bmp") as never,
			{ params: Promise.resolve({ id: "mix-1.bmp" }) },
		);

		expect(response.status).toBe(404);
		await expect(response.text()).resolves.toBe("Mixup not found");
	});

	it("renders a mixup bitmap using the query access token and slot assignments", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.db.selectFrom.mockReturnValue({
			select: vi.fn(() => ({
				where: vi.fn(() => ({
					executeTakeFirst: vi.fn().mockResolvedValue({ user_id: "user-1" }),
				})),
			})),
		});
		state.withExplicitUserScope.mockResolvedValue([
			{ layout_id: "layout-1" },
			[
				{
					slot_id: "slot-a",
					recipe_slug: "fallback-slug",
					recipe_id: "recipe-1",
					ref_type: "recipe",
					ref_id: null,
					resolved_slug: "resolved-slug",
				},
				{
					slot_id: "slot-b",
					recipe_slug: null,
					recipe_id: null,
					ref_type: "screen",
					ref_id: null,
					resolved_slug: null,
				},
			],
		]);
		state.getLayoutById.mockReturnValue({
			slots: [
				{ id: "slot-a", x: 1, y: 2, width: 100, height: 50 },
				{ id: "slot-b", x: 10, y: 20, width: 90, height: 45 },
			],
		});
		state.resolveRenderableRef.mockResolvedValue({
			recipeSlug: "resolved-slug",
			params: { city: "Warsaw" },
		});
		state.renderRecipeToImage.mockResolvedValue({
			png: Buffer.from("slot-a-png"),
		});
		state.renderBmp.mockResolvedValue(Buffer.from("bmp-output"));
		const { GET } = await loadRoute();

		const response = await GET(
			new Request(
				"https://example.test/api/bitmap/mixup/mix-1.bmp?access_token=query-token",
			) as never,
			{ params: Promise.resolve({ id: "mix-1.bmp" }) },
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("image/bmp");
		expect(response.headers.get("Content-Length")).toBe("10");
		expect(Buffer.from(await response.arrayBuffer())).toEqual(
			Buffer.from("bmp-output"),
		);
		expect(state.withExplicitUserScope).toHaveBeenCalledWith(
			"user-1",
			expect.any(Function),
		);
		expect(state.resolveRenderableRef).toHaveBeenCalledWith({
			type: "recipe",
			id: "recipe-1",
			userId: "user-1",
		});
		expect(state.renderRecipeToImage).toHaveBeenCalledWith({
			slug: "resolved-slug",
			imageWidth: 100,
			imageHeight: 50,
			formats: ["png"],
			userId: "user-1",
			paramsOverride: { city: "Warsaw" },
		});
		expect(state.renderBmp).toHaveBeenCalledWith(Buffer.from("composited:1"), {
			ditheringMethod: "ATKINSON",
			width: 800,
			height: 480,
			grayscale: 16,
		});
	});

	it("returns 404 in dev mode when the mixup cannot be loaded for rendering", async () => {
		vi.stubEnv("AUTH_ENABLED", "false");
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.db.selectFrom.mockImplementation((table: string) => {
			if (table === "mixups") {
				return {
					select: vi.fn(() => ({
						where: vi.fn(() => ({
							executeTakeFirst: vi
								.fn()
								.mockResolvedValue({ user_id: "user-1" }),
						})),
					})),
				};
			}

			throw new Error(`Unexpected table lookup: ${table}`);
		});
		state.withExplicitUserScope.mockResolvedValue([undefined, []]);
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/bitmap/mixup/mix-1.bmp") as never,
			{ params: Promise.resolve({ id: "mix-1.bmp" }) },
		);

		expect(response.status).toBe(404);
		await expect(response.text()).resolves.toBe("Mixup not found");
		expect(state.logger.warn).toHaveBeenCalledWith("Mixup not found: mix-1");
	});

	it("returns 400 when the mixup layout cannot be resolved", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.db.selectFrom.mockReturnValue({
			select: vi.fn(() => ({
				where: vi.fn(() => ({
					executeTakeFirst: vi.fn().mockResolvedValue({ user_id: "user-1" }),
				})),
			})),
		});
		state.withExplicitUserScope.mockResolvedValue([
			{ layout_id: "missing-layout" },
			[],
		]);
		state.getLayoutById.mockReturnValue(null);
		const { GET } = await loadRoute();

		const response = await GET(
			new Request(
				"https://example.test/api/bitmap/mixup/mix-1.bmp?width=640&height=384",
				{
					headers: { "Access-Token": "token-1" },
				},
			) as never,
			{ params: Promise.resolve({ id: "mix-1.bmp" }) },
		);

		expect(state.withExplicitUserScope).toHaveBeenCalledWith(
			"user-1",
			expect.any(Function),
		);
		expect(state.getLayoutById).toHaveBeenCalledWith(
			"missing-layout",
			800,
			480,
		);
		expect(response.status).toBe(400);
		await expect(response.text()).resolves.toBe("Invalid layout");
	});

	it("continues rendering when individual slots fail to render or resize", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.db.selectFrom.mockReturnValue({
			select: vi.fn(() => ({
				where: vi.fn(() => ({
					executeTakeFirst: vi.fn().mockResolvedValue({ user_id: "user-1" }),
				})),
			})),
		});
		state.withExplicitUserScope.mockResolvedValue([
			{ layout_id: "layout-1" },
			[
				{
					slot_id: "slot-screen",
					recipe_slug: null,
					recipe_id: null,
					ref_type: "screen",
					ref_id: "screen-1",
					resolved_slug: null,
				},
				{
					slot_id: "slot-recipe",
					recipe_slug: "recipe-fallback",
					recipe_id: "recipe-2",
					ref_type: "recipe",
					ref_id: null,
					resolved_slug: "recipe-b",
				},
				{
					slot_id: "slot-empty",
					recipe_slug: null,
					recipe_id: null,
					ref_type: null,
					ref_id: null,
					resolved_slug: null,
				},
			],
		]);
		state.getLayoutById.mockReturnValue({
			slots: [
				{ id: "slot-screen", x: 1, y: 2, width: 100, height: 50 },
				{ id: "slot-recipe", x: 10, y: 20, width: 90, height: 45 },
				{ id: "slot-empty", x: 20, y: 30, width: 80, height: 40 },
			],
		});
		state.resolveRenderableRef.mockImplementation(async ({ id }) => {
			if (id === "screen-1") {
				return {
					recipeSlug: "screen-render",
					params: { source: "screen" },
				};
			}

			return {
				recipeSlug: "recipe-b",
				params: { source: "recipe" },
			};
		});
		state.renderRecipeToImage.mockImplementation(async ({ slug }) => {
			if (slug === "recipe-b") {
				throw new Error("render failed");
			}

			return { png: Buffer.from("broken-slot") };
		});
		state.sharp.mockImplementation((input: Buffer | { create: unknown }) => {
			if (Buffer.isBuffer(input)) {
				return {
					resize: vi.fn(() => ({
						toBuffer: vi.fn(async () => {
							if (input.equals(Buffer.from("broken-slot"))) {
								throw new Error("resize failed");
							}

							return Buffer.from(`resized:${input.toString()}`);
						}),
					})),
				};
			}

			return {
				composite: vi.fn((overlays: unknown[]) => ({
					png: vi.fn(() => ({
						toBuffer: vi.fn(async () =>
							Buffer.from(`composited:${overlays.length}`),
						),
					})),
				})),
			};
		});
		state.renderBmp.mockResolvedValue(Buffer.from("bmp-output"));
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/bitmap/mixup/mix-1.bmp", {
				headers: { "Access-Token": "token-1" },
			}) as never,
			{ params: Promise.resolve({ id: "mix-1.bmp" }) },
		);

		expect(response.status).toBe(200);
		expect(Buffer.from(await response.arrayBuffer())).toEqual(
			Buffer.from("bmp-output"),
		);
		expect(state.resolveRenderableRef).toHaveBeenCalledWith({
			type: "screen",
			id: "screen-1",
			userId: "user-1",
		});
		expect(state.renderBmp).toHaveBeenCalledWith(Buffer.from("composited:0"), {
			ditheringMethod: "ATKINSON",
			width: 800,
			height: 480,
			grayscale: 16,
		});
		expect(state.logger.error).toHaveBeenCalledWith(
			"Error resizing slot slot-screen:",
			expect.any(Error),
		);
		expect(state.logger.error).toHaveBeenCalledWith(
			"Error rendering slot slot-recipe with recipe recipe-2:",
			expect.any(Error),
		);
	});

	it("returns 500 when rendering the mixup image fails", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.db.selectFrom.mockReturnValue({
			select: vi.fn(() => ({
				where: vi.fn(() => ({
					executeTakeFirst: vi.fn().mockResolvedValue({ user_id: "user-1" }),
				})),
			})),
		});
		state.withExplicitUserScope.mockResolvedValue([
			{ layout_id: "layout-1" },
			[
				{
					slot_id: "slot-a",
					recipe_slug: "recipe-a",
					recipe_id: "recipe-1",
					ref_type: "recipe",
					ref_id: null,
					resolved_slug: "recipe-a",
				},
			],
		]);
		state.getLayoutById.mockReturnValue({
			slots: [{ id: "slot-a", x: 1, y: 2, width: 100, height: 50 }],
		});
		state.resolveRenderableRef.mockResolvedValue({
			recipeSlug: "recipe-a",
			params: null,
		});
		state.renderRecipeToImage.mockResolvedValue({
			png: Buffer.from("slot-a-png"),
		});
		state.renderBmp.mockRejectedValue(new Error("bmp failed"));
		const { GET } = await loadRoute();

		const response = await GET(
			new Request("https://example.test/api/bitmap/mixup/mix-1.bmp", {
				headers: { "Access-Token": "token-1" },
			}) as never,
			{ params: Promise.resolve({ id: "mix-1.bmp" }) },
		);

		expect(response.status).toBe(500);
		await expect(response.text()).resolves.toBe("Error generating image");
		expect(state.logger.error).toHaveBeenCalledWith(
			"Error generating mixup image:",
			expect.any(Error),
		);
	});
});
