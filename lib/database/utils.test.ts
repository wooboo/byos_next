import { afterEach, describe, expect, it, vi } from "vitest";

type ExecuteResult = { rows: unknown[] };

const state = vi.hoisted(() => ({
	checkConnectionResult: undefined as ExecuteResult | undefined,
	db: { name: "mock-db" },
	selectExecuteResult: undefined as ExecuteResult | undefined,
	sqlCalls: [] as Array<{ kind: "tag" | "raw"; value: string }>,
}));

async function loadUtils() {
	vi.resetModules();
	state.sqlCalls.length = 0;
	vi.doMock("kysely", () => {
		const sql = Object.assign(
			(strings: TemplateStringsArray) => ({
				execute: vi.fn().mockImplementation(async () => {
					state.sqlCalls.push({ kind: "tag", value: strings.join("") });
					if (!state.checkConnectionResult) {
						throw new Error("No SELECT 1 result configured");
					}
					return state.checkConnectionResult;
				}),
			}),
			{
				raw: (value: string) => ({
					execute: vi.fn().mockImplementation(async () => {
						state.sqlCalls.push({ kind: "raw", value });
						if (!state.selectExecuteResult) {
							throw new Error("No validation result configured");
						}
						return state.selectExecuteResult;
					}),
				}),
			},
		);
		return { sql };
	});
	vi.doMock("./db", () => ({
		db: state.db,
	}));
	return import("./utils");
}

describe("database utils", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.resetModules();
		delete process.env.DATABASE_URL;
		state.checkConnectionResult = undefined;
		state.selectExecuteResult = undefined;
		state.sqlCalls.length = 0;
	});

	it("reports ready when the connection works and the schema is complete", async () => {
		process.env.DATABASE_URL = "postgres://example";
		state.checkConnectionResult = { rows: [] };
		state.selectExecuteResult = { rows: [] };
		const { checkDbConnection } = await loadUtils();

		await expect(checkDbConnection()).resolves.toEqual({
			ready: true,
			PostgresUrl: "postgres://example",
		});
		expect(state.sqlCalls).toEqual([
			{ kind: "tag", value: "SELECT 1" },
			expect.objectContaining({ kind: "raw" }),
		]);
	});

	it("surfaces missing tables from the validation query", async () => {
		process.env.DATABASE_URL = "postgres://example";
		state.checkConnectionResult = { rows: [] };
		state.selectExecuteResult = {
			rows: [{ missing_table: "devices" }, { missing_table: "playlists" }],
		};
		const { checkDbConnection } = await loadUtils();

		await expect(checkDbConnection()).resolves.toEqual({
			ready: false,
			error: "Missing required tables: devices, playlists",
			PostgresUrl: "postgres://example",
		});
	});

	it("short-circuits getDbStatus when DATABASE_URL is missing", async () => {
		const { getDbStatus } = await loadUtils();

		await expect(getDbStatus()).resolves.toEqual({
			ready: false,
			error: "ERROR_ENV_VAR_DATABASE_URL_NOT_SET",
		});
	});
});
