import { afterEach, describe, expect, it, vi } from "vitest";

const fakeSqlStatements = {
	"0000_initial_schema": { sql: "CREATE TABLE initial_schema;" },
	"0012_create_schema_migrations": { sql: "CREATE TABLE schema_migrations;" },
	validate_schema: { sql: "SELECT * FROM missing_tables;" },
} as const;

const initialSchemaChecksum =
	"a043e77b0d6401596a3910deda0a7a3563c42c54388eb55562ab89271193de5d";

const state = vi.hoisted(() => ({
	auth: null as unknown,
	checkDbConnection: vi.fn(),
	createClientCalls: [] as string[],
	getCurrentUser: vi.fn(),
	kyselyExecute: vi.fn(),
	mainClient: {
		end: vi.fn(),
		unsafe: vi.fn(),
	},
	noticeClient: {
		begin: vi.fn(),
		end: vi.fn(),
	},
	postgresFactory: vi.fn(),
}));

async function loadExecuteSql() {
	vi.resetModules();
	vi.doMock("postgres", () => ({
		default: state.postgresFactory,
	}));
	vi.doMock("kysely", () => ({
		sql: Object.assign(
			(strings: TemplateStringsArray) => ({
				execute: async () => {
					const text = strings.join("");
					const result = state.kyselyExecute(text);
					if (result !== undefined) {
						return await result;
					}
					if (text.includes("information_schema.tables")) {
						return { rows: [{ count: 2 }] };
					}
					return { rows: [] };
				},
			}),
			{ raw: vi.fn() },
		),
	}));
	vi.doMock("@/lib/auth/auth", () => ({
		auth: state.auth,
	}));
	vi.doMock("@/lib/auth/get-user", () => ({
		getCurrentUser: state.getCurrentUser,
	}));
	vi.doMock("@/lib/database/db", () => ({
		db: { name: "mock-db" },
	}));
	vi.doMock("@/lib/database/sql-statements", () => ({
		SQL_STATEMENTS: fakeSqlStatements,
	}));
	vi.doMock("@/lib/database/utils", () => ({
		checkDbConnection: state.checkDbConnection,
	}));

	return import("./execute-sql");
}

function installSuccessfulNoticeClient() {
	state.noticeClient.begin.mockImplementation(async (callback) => {
		const trx = Object.assign(vi.fn().mockResolvedValue(undefined), {
			unsafe: vi.fn().mockResolvedValue(undefined),
		});
		await callback(trx);
	});
	state.noticeClient.end.mockResolvedValue(undefined);
}

describe("execute-sql action", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.resetModules();
		vi.unstubAllEnvs();
		state.auth = null;
		state.checkDbConnection.mockReset();
		state.createClientCalls.length = 0;
		state.getCurrentUser.mockReset();
		state.kyselyExecute.mockReset();
		state.mainClient.end.mockReset();
		state.mainClient.unsafe.mockReset();
		state.noticeClient.begin.mockReset();
		state.noticeClient.end.mockReset();
		state.postgresFactory.mockReset();
	});

	it("returns unauthorized when setup sql cannot run", async () => {
		state.auth = {};
		state.getCurrentUser.mockResolvedValue({ id: "user-1", role: "user" });
		state.checkDbConnection.mockResolvedValue({ ready: true });
		const { executeSqlStatements } = await loadExecuteSql();

		const result = await executeSqlStatements();

		expect(result.validate_schema).toEqual(
			expect.objectContaining({
				status: "error",
				error: "Unauthorized",
			}),
		);
		expect(result["0000_initial_schema"]).toEqual(
			expect.objectContaining({
				status: "error",
				error: "Unauthorized",
			}),
		);
	});

	it("returns an error state when DATABASE_URL is missing", async () => {
		const { executeSqlStatements } = await loadExecuteSql();

		const result = await executeSqlStatements();

		expect(result.validate_schema).toEqual(
			expect.objectContaining({
				status: "error",
				error: "DATABASE_URL is not defined",
			}),
		);
	});

	it("returns an error state when DATABASE_URL is invalid", async () => {
		vi.stubEnv("DATABASE_URL", "not-a-postgres-url");
		const { executeSqlStatements } = await loadExecuteSql();

		await expect(executeSqlStatements()).rejects.toThrow("Invalid URL format");
	});

	it("runs migrations and schema validation with a transformed connection string", async () => {
		vi.stubEnv(
			"DATABASE_URL",
			"postgres://user:pass@localhost:5432/byos?sslmode=disable",
		);
		state.mainClient.unsafe.mockResolvedValue([]);
		state.mainClient.end.mockResolvedValue(undefined);
		installSuccessfulNoticeClient();
		state.postgresFactory.mockImplementation((connectionString: string) => {
			state.createClientCalls.push(connectionString);
			if (state.createClientCalls.length === 1) {
				const mainTag = vi.fn(async (strings: TemplateStringsArray) => {
					const sqlText = strings.join("");
					if (sqlText.includes("SELECT name, checksum")) {
						return [];
					}
					return [];
				});
				return Object.assign(mainTag, state.mainClient);
			}

			return Object.assign(
				vi.fn().mockResolvedValue(undefined),
				state.noticeClient,
			);
		});
		const { executeSqlStatements } = await loadExecuteSql();

		const result = await executeSqlStatements();

		expect(state.createClientCalls[0]).toBe(
			"postgresql://user:pass@localhost:5432/byos?sslmode=disable",
		);
		expect(result["0012_create_schema_migrations"]).toEqual(
			expect.objectContaining({ status: "success" }),
		);
		expect(result["0000_initial_schema"]).toEqual(
			expect.objectContaining({ status: "success" }),
		);
		expect(result.validate_schema).toEqual(
			expect.objectContaining({ status: "success" }),
		);
		expect(state.mainClient.end).toHaveBeenCalledTimes(1);
	});

	it("allows setup on a fresh install when auth tables do not exist yet", async () => {
		vi.stubEnv(
			"DATABASE_URL",
			"postgres://user:pass@localhost:5432/byos?sslmode=disable",
		);
		state.auth = {};
		state.getCurrentUser.mockResolvedValue(null);
		state.checkDbConnection.mockResolvedValue({
			ready: false,
			error: "Missing required tables: user, session",
		});
		state.mainClient.unsafe
			.mockResolvedValueOnce(undefined)
			.mockResolvedValueOnce([]);
		state.mainClient.end.mockResolvedValue(undefined);
		installSuccessfulNoticeClient();
		state.postgresFactory.mockImplementation((connectionString: string) => {
			state.createClientCalls.push(connectionString);
			if (state.createClientCalls.length === 1) {
				const mainTag = vi.fn(async (strings: TemplateStringsArray) => {
					const sqlText = strings.join("");
					if (sqlText.includes("SELECT name, checksum")) {
						return [];
					}
					return [];
				});
				return Object.assign(mainTag, state.mainClient);
			}

			return Object.assign(
				vi.fn().mockResolvedValue(undefined),
				state.noticeClient,
			);
		});
		const { executeSqlStatements } = await loadExecuteSql();
		state.kyselyExecute.mockResolvedValue({ rows: [{ count: 0 }] });

		const result = await executeSqlStatements();

		expect(result["0000_initial_schema"]).toEqual(
			expect.objectContaining({ status: "success" }),
		);
		expect(result.validate_schema).toEqual(
			expect.objectContaining({ status: "success" }),
		);
	});

	it("stops when the schema migration ledger checksum does not match", async () => {
		vi.stubEnv(
			"DATABASE_URL",
			"postgres://user:pass@localhost:5432/byos?sslmode=disable",
		);
		state.mainClient.unsafe.mockResolvedValue(undefined);
		state.mainClient.end.mockResolvedValue(undefined);
		state.postgresFactory.mockImplementation((connectionString: string) => {
			state.createClientCalls.push(connectionString);
			const mainTag = vi.fn(async (strings: TemplateStringsArray) => {
				const sqlText = strings.join("");
				if (sqlText.includes("SELECT name, checksum")) {
					return [
						{
							name: "0012_create_schema_migrations",
							checksum: "wrong-checksum",
						},
					];
				}
				return [];
			});
			return Object.assign(mainTag, state.mainClient);
		});
		const { executeSqlStatements } = await loadExecuteSql();

		const result = await executeSqlStatements();

		expect(result["0012_create_schema_migrations"]).toEqual(
			expect.objectContaining({
				status: "error",
				error:
					"Migration 0012_create_schema_migrations was already applied with a different checksum",
			}),
		);
		expect(result.validate_schema).toEqual(
			expect.objectContaining({
				status: "error",
				error:
					"Skipped schema validation because migration 0012_create_schema_migrations failed",
			}),
		);
	});

	it("reports schema validation failures when missing tables remain", async () => {
		vi.stubEnv(
			"DATABASE_URL",
			"postgres://user:pass@localhost:5432/byos?sslmode=disable",
		);
		state.mainClient.unsafe
			.mockResolvedValueOnce(undefined)
			.mockResolvedValueOnce([{ table: "devices" }]);
		state.mainClient.end.mockResolvedValue(undefined);
		installSuccessfulNoticeClient();
		state.postgresFactory.mockImplementation((connectionString: string) => {
			state.createClientCalls.push(connectionString);
			if (state.createClientCalls.length === 1) {
				const mainTag = vi.fn(async (strings: TemplateStringsArray) => {
					const sqlText = strings.join("");
					if (sqlText.includes("SELECT name, checksum")) {
						return [];
					}
					return [];
				});
				return Object.assign(mainTag, state.mainClient);
			}

			return Object.assign(
				vi.fn().mockResolvedValue(undefined),
				state.noticeClient,
			);
		});
		const { executeSqlStatements } = await loadExecuteSql();

		const result = await executeSqlStatements();

		expect(result.validate_schema).toEqual(
			expect.objectContaining({
				status: "error",
				error: "Schema validation found missing tables",
				result: [{ table: "devices" }],
			}),
		);
	});

	it("skips already applied migrations with matching checksums", async () => {
		vi.stubEnv(
			"DATABASE_URL",
			"postgres://user:pass@localhost:5432/byos?sslmode=disable",
		);
		state.mainClient.unsafe
			.mockResolvedValueOnce(undefined)
			.mockResolvedValueOnce([]);
		state.mainClient.end.mockResolvedValue(undefined);
		state.postgresFactory.mockImplementation((connectionString: string) => {
			state.createClientCalls.push(connectionString);
			if (state.createClientCalls.length === 1) {
				let selectCount = 0;
				const mainTag = vi.fn(async (strings: TemplateStringsArray) => {
					const sqlText = strings.join("");
					if (sqlText.includes("SELECT name, checksum")) {
						selectCount += 1;
						return selectCount === 1
							? []
							: [
									{
										name: "0000_initial_schema",
										checksum: initialSchemaChecksum,
									},
								];
					}
					return [];
				});
				return Object.assign(mainTag, state.mainClient);
			}

			return Object.assign(
				vi.fn().mockResolvedValue(undefined),
				state.noticeClient,
			);
		});
		const { executeSqlStatements } = await loadExecuteSql();

		const result = await executeSqlStatements();

		expect(result["0000_initial_schema"]).toEqual(
			expect.objectContaining({
				status: "success",
				result: [{ skipped: true, reason: "Already applied" }],
			}),
		);
	});

	it("captures unexpected validation errors in the validate_schema result", async () => {
		vi.stubEnv(
			"DATABASE_URL",
			"postgres://user:pass@localhost:5432/byos?sslmode=disable",
		);
		state.mainClient.unsafe
			.mockResolvedValueOnce(undefined)
			.mockRejectedValueOnce(new Error("validation crashed"));
		state.mainClient.end.mockResolvedValue(undefined);
		installSuccessfulNoticeClient();
		state.postgresFactory.mockImplementation((connectionString: string) => {
			state.createClientCalls.push(connectionString);
			if (state.createClientCalls.length === 1) {
				const mainTag = vi.fn(async (strings: TemplateStringsArray) => {
					const sqlText = strings.join("");
					if (sqlText.includes("SELECT name, checksum")) {
						return [];
					}
					return [];
				});
				return Object.assign(mainTag, state.mainClient);
			}

			return Object.assign(
				vi.fn().mockResolvedValue(undefined),
				state.noticeClient,
			);
		});
		const { executeSqlStatements } = await loadExecuteSql();

		const result = await executeSqlStatements();

		expect(result.validate_schema).toEqual(
			expect.objectContaining({
				status: "error",
				error: "validation crashed",
			}),
		);
	});
});
