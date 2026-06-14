import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	checkDbConnection: vi.fn(),
	getCurrentUserId: vi.fn(),
	revalidatePath: vi.fn(),
	withExplicitUserScope: vi.fn(),
	withUserScope: vi.fn(),
}));

async function loadScreensParams() {
	vi.resetModules();
	vi.doMock("kysely", () => ({
		sql: vi.fn((_strings: TemplateStringsArray) => "order-clause"),
	}));
	vi.doMock("next/cache", () => ({
		revalidatePath: state.revalidatePath,
	}));
	vi.doMock("@/lib/auth/get-user", () => ({
		getCurrentUserId: state.getCurrentUserId,
	}));
	vi.doMock("@/lib/database/scoped-db", () => ({
		withExplicitUserScope: state.withExplicitUserScope,
		withUserScope: state.withUserScope,
	}));
	vi.doMock("@/lib/database/utils", () => ({
		checkDbConnection: state.checkDbConnection,
	}));

	return import("./screens-params");
}

describe("screens-params actions", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.resetModules();
		state.checkDbConnection.mockReset();
		state.getCurrentUserId.mockReset();
		state.revalidatePath.mockReset();
		state.withExplicitUserScope.mockReset();
		state.withUserScope.mockReset();
	});

	it("rejects param updates when the user is not signed in", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue(null);
		const { updateScreenParams } = await loadScreensParams();

		await expect(
			updateScreenParams("screen-1", { keep: true }),
		).resolves.toEqual({
			success: false,
			error: "You must be signed in to save params",
		});
	});

	it("saves only whitelisted params from definitions", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue("user-1");
		const execute = vi.fn().mockResolvedValue(undefined);
		const onConflict = vi.fn((handler: (builder: object) => unknown) => {
			handler({
				columns: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						doUpdateSet: vi.fn().mockReturnValue({ execute }),
					}),
				}),
			});
			return { execute };
		});

		state.withUserScope.mockImplementation(async (callback) =>
			callback({
				insertInto: vi.fn().mockReturnValue({
					values: vi.fn().mockReturnValue({
						onConflict,
						execute,
					}),
				}),
			}),
		);
		const { updateScreenParams } = await loadScreensParams();

		await expect(
			updateScreenParams(
				"screen-1",
				{ accent: "red", ignored: "value" },
				{ accent: { type: "string", label: "Accent", default: "blue" } },
			),
		).resolves.toEqual({ success: true });
		expect(state.revalidatePath).toHaveBeenNthCalledWith(
			1,
			"/recipes/screen-1",
		);
		expect(state.revalidatePath).toHaveBeenNthCalledWith(
			2,
			"/api/bitmap/screen-1.bmp",
		);
	});

	it("falls back to definition defaults when the database is unavailable", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: false });
		const { getScreenParams } = await loadScreensParams();

		await expect(
			getScreenParams("screen-1", {
				accent: { type: "string", label: "Accent", default: "blue" },
			}),
		).resolves.toEqual({ accent: "blue" });
	});

	it("merges stored params with defaults for the current user", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.withUserScope.mockImplementation(async (callback) =>
			callback({
				selectFrom: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						where: vi.fn().mockReturnValue({
							orderBy: vi.fn().mockReturnValue({
								executeTakeFirst: vi
									.fn()
									.mockResolvedValue({ params: { accent: "red", empty: "" } }),
							}),
						}),
					}),
				}),
			}),
		);
		const { getScreenParams } = await loadScreensParams();

		await expect(
			getScreenParams("screen-2", {
				accent: { type: "string", label: "Accent", default: "blue" },
				empty: { type: "string", label: "Empty", default: "fallback" },
			}),
		).resolves.toEqual({
			accent: "red",
			empty: "fallback",
		});
	});

	it("uses explicit user scope when a user id is provided", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.withExplicitUserScope.mockImplementation(async (_userId, callback) =>
			callback({
				selectFrom: vi.fn().mockReturnValue({
					select: vi.fn().mockReturnValue({
						where: vi.fn().mockReturnValue({
							orderBy: vi.fn().mockReturnValue({
								executeTakeFirst: vi
									.fn()
									.mockResolvedValue({ params: '{"theme":"mono"}' }),
							}),
						}),
					}),
				}),
			}),
		);
		const { getScreenParams } = await loadScreensParams();

		await expect(
			getScreenParams("screen-3", undefined, "user-9"),
		).resolves.toEqual({ theme: "mono" });
	});
});
