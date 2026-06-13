"use server";

import { createHash } from "crypto";
import { sql as kyselySql } from "kysely";
import postgres from "postgres";
import { auth } from "@/lib/auth/auth";
import { getCurrentUser } from "@/lib/auth/get-user";
import { db } from "@/lib/database/db";
import { SQL_STATEMENTS } from "@/lib/database/sql-statements";
import { checkDbConnection } from "@/lib/database/utils";

export type SqlExecutionStatus =
	| "idle"
	| "loading"
	| "success"
	| "error"
	| "warning";

export interface SqlExecutionResult {
	status: SqlExecutionStatus;
	result: Record<string, unknown>[];
	notices: Record<string, unknown>[];
	error?: string;
	executionTime?: number;
}

export type SqlExecutionState = {
	[key in keyof typeof SQL_STATEMENTS]: SqlExecutionResult;
};

const SCHEMA_MIGRATIONS_MIGRATION = "0012_create_schema_migrations";
type SqlStatementKey = keyof typeof SQL_STATEMENTS;

function checksumSql(sql: string): string {
	return createHash("sha256").update(sql).digest("hex");
}

function migrationEntries() {
	return Object.entries(SQL_STATEMENTS).filter(
		([key]) => key !== "validate_schema" && key !== SCHEMA_MIGRATIONS_MIGRATION,
	);
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function errorResult(
	error: string,
	notices: Record<string, unknown>[] = [],
): SqlExecutionResult {
	return {
		status: "error",
		result: [],
		notices,
		error,
	};
}

function buildResultState(
	status: SqlExecutionStatus,
	error?: string,
): SqlExecutionState {
	return Object.keys(SQL_STATEMENTS).reduce((acc, key) => {
		acc[key as SqlStatementKey] = {
			status,
			result: [],
			notices: [],
			...(error ? { error } : {}),
		};
		return acc;
	}, {} as SqlExecutionState);
}

function transformPostgresUrl(url: string): string {
	try {
		const parsedUrl = new URL(url);
		const username = parsedUrl.username;
		const password = parsedUrl.password;
		return `postgresql://${username}:${password}@${parsedUrl.host}${parsedUrl.pathname}${parsedUrl.search}`;
	} catch (error) {
		console.error("Error transforming URL:", error);
		throw new Error("Invalid URL format");
	}
}

function postgresSsl(connectionString: string) {
	return connectionString.includes("sslmode=disable") ? false : "require";
}

function createSqlClient(
	connectionString: string,
	onnotice: postgres.Options<Record<string, never>>["onnotice"] = () => {
		// We'll handle notices per query.
	},
) {
	return postgres(connectionString, {
		ssl: postgresSsl(connectionString),
		onnotice,
	});
}

async function authTablesExist(): Promise<boolean> {
	const result = await kyselySql<{
		count: string | number | bigint;
	}>`
		SELECT COUNT(*) AS count
		FROM information_schema.tables
		WHERE table_schema = 'public'
			AND table_name IN ('user', 'session')
	`.execute(db);

	const count = Number(result.rows[0]?.count ?? 0);
	return count >= 2;
}

async function canRunSetupSql(): Promise<boolean> {
	if (!auth) {
		return true;
	}

	const user = await getCurrentUser().catch(() => null);
	if (user?.role === "admin") {
		return true;
	}

	const status = await checkDbConnection();
	if (!status.ready && status.error?.startsWith("Missing required tables:")) {
		// Fresh installs do not have auth tables yet, so setup must be runnable
		// before anyone can sign in. Once auth tables exist, require admin.
		return !(await authTablesExist().catch(() => false));
	}

	return false;
}

async function getAppliedMigrations(
	sql: postgres.Sql,
): Promise<Map<string, string>> {
	const rows = await sql<{ name: string; checksum: string }[]>`
		SELECT name, checksum
		FROM schema_migrations
	`;

	return new Map(rows.map((row) => [row.name, row.checksum]));
}

async function ensureMigrationLedger(
	sql: postgres.Sql,
	resultState: SqlExecutionState,
): Promise<void> {
	const statement = SQL_STATEMENTS[SCHEMA_MIGRATIONS_MIGRATION];
	const checksum = checksumSql(statement.sql);
	const startTime = performance.now();

	await sql.unsafe(statement.sql);

	const applied = await getAppliedMigrations(sql);
	const appliedChecksum = applied.get(SCHEMA_MIGRATIONS_MIGRATION);

	if (appliedChecksum && appliedChecksum !== checksum) {
		throw new Error(
			`Migration ${SCHEMA_MIGRATIONS_MIGRATION} was already applied with a different checksum`,
		);
	}

	if (!appliedChecksum) {
		await sql`
			INSERT INTO schema_migrations (name, checksum)
			VALUES (${SCHEMA_MIGRATIONS_MIGRATION}, ${checksum})
		`;
	}

	resultState[SCHEMA_MIGRATIONS_MIGRATION] = {
		status: "success",
		result: appliedChecksum
			? [{ skipped: true, reason: "Already applied" }]
			: [{ applied: true }],
		notices: [],
		executionTime: Math.round(performance.now() - startTime),
	};
}

function markExistingMigration(
	resultState: SqlExecutionState,
	key: string,
	checksum: string,
	appliedChecksum: string | undefined,
	notices: Record<string, unknown>[],
): "pending" | "skipped" | "failed" {
	if (!appliedChecksum) {
		return "pending";
	}

	if (appliedChecksum !== checksum) {
		resultState[key as SqlStatementKey] = errorResult(
			`Migration ${key} was already applied with a different checksum`,
			notices,
		);
		return "failed";
	}

	resultState[key as SqlStatementKey] = {
		status: "success",
		result: [{ skipped: true, reason: "Already applied" }],
		notices,
	};
	return "skipped";
}

async function applyMigration(
	sqlWithNotices: postgres.Sql,
	key: string,
	statementSql: string,
	checksum: string,
) {
	await sqlWithNotices.begin(async (trx) => {
		await trx.unsafe(statementSql);
		await trx`
			INSERT INTO schema_migrations (name, checksum)
			VALUES (${key}, ${checksum})
		`;
	});
}

async function executeMigrationEntry(
	connectionString: string,
	resultState: SqlExecutionState,
	applied: Map<string, string>,
	[key, statement]: ReturnType<typeof migrationEntries>[number],
): Promise<string | null> {
	const notices: Record<string, unknown>[] = [];
	const sqlWithNotices = createSqlClient(connectionString, (notice) => {
		console.log(`Database notice for ${key}:`, notice);
		notices.push(notice);
	});

	try {
		const checksum = checksumSql(statement.sql);
		const existingStatus = markExistingMigration(
			resultState,
			key,
			checksum,
			applied.get(key),
			notices,
		);

		if (existingStatus === "failed") {
			return key;
		}

		if (existingStatus === "skipped") {
			return null;
		}

		const startTime = performance.now();
		await applyMigration(sqlWithNotices, key, statement.sql, checksum);

		resultState[key as SqlStatementKey] = {
			status: "success",
			result: [{ applied: true }],
			notices,
			executionTime: Math.round(performance.now() - startTime),
		};
		return null;
	} catch (error) {
		console.error(`Error executing SQL for ${key}:`, error);
		resultState[key as SqlStatementKey] = errorResult(
			errorMessage(error),
			notices,
		);
		return key;
	} finally {
		await sqlWithNotices.end();
	}
}

async function executeMigrations(
	connectionString: string,
	sql: postgres.Sql,
	resultState: SqlExecutionState,
): Promise<string | null> {
	try {
		await ensureMigrationLedger(sql, resultState);
	} catch (error) {
		resultState[SCHEMA_MIGRATIONS_MIGRATION] = errorResult(errorMessage(error));
		return SCHEMA_MIGRATIONS_MIGRATION;
	}

	const applied = await getAppliedMigrations(sql);
	for (const entry of migrationEntries()) {
		const failedMigration = await executeMigrationEntry(
			connectionString,
			resultState,
			applied,
			entry,
		);
		if (failedMigration) {
			return failedMigration;
		}
	}

	return null;
}

async function validateSchema(
	sql: postgres.Sql,
	resultState: SqlExecutionState,
	migrationFailed: string | null,
): Promise<void> {
	if (migrationFailed) {
		resultState.validate_schema = errorResult(
			`Skipped schema validation because migration ${migrationFailed} failed`,
		);
		return;
	}

	const validationStartTime = performance.now();
	const validationResult = await sql.unsafe(SQL_STATEMENTS.validate_schema.sql);
	resultState.validate_schema = {
		status: validationResult.length === 0 ? "success" : "error",
		result: validationResult,
		notices: [],
		error:
			validationResult.length === 0
				? undefined
				: "Schema validation found missing tables",
		executionTime: Math.round(performance.now() - validationStartTime),
	};
}

export async function executeSqlStatements(): Promise<SqlExecutionState> {
	if (!(await canRunSetupSql())) {
		return buildResultState("error", "Unauthorized");
	}

	const postgresUrl = process.env.DATABASE_URL;

	if (!postgresUrl) {
		return buildResultState("error", "DATABASE_URL is not defined");
	}

	const connectionString = transformPostgresUrl(postgresUrl);
	const resultState = buildResultState("idle");
	const sql = createSqlClient(connectionString);

	try {
		const migrationFailed = await executeMigrations(
			connectionString,
			sql,
			resultState,
		);
		await validateSchema(sql, resultState, migrationFailed);
	} catch (error) {
		console.error("Unexpected error during SQL execution:", error);
		resultState.validate_schema = errorResult(errorMessage(error));
	} finally {
		// Close the main connection
		await sql.end();
	}

	return resultState;
}
