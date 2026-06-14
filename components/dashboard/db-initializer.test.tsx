import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";
import {
	allStatementsSucceeded,
	CopyErrorNotice,
	createInitialExecutionState,
	ExecutionSummary,
	ExpandToggle,
	formatJsonAsSqlComment,
	getAllSql,
	getExecutionAppendixSql,
	getExecutionCounts,
	getExecutionNoticesSql,
	getExecutionResultSql,
	getSqlStatuses,
	getStatusText,
	getTitleWithStatus,
	getWarningSql,
	StatementExecutionDetails,
} from "./db-initializer";

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		refresh: () => undefined,
	}),
}));

vi.mock("@/app/actions/execute-sql", () => ({
	executeSqlStatements: vi.fn(),
}));

vi.mock("@/lib/database/sql-statements", () => ({
	SQL_STATEMENTS: {
		create_devices: {
			title: "Create devices table",
			description: "Creates the devices table used by the dashboard",
			sql: "CREATE TABLE devices (id uuid primary key);",
		},
		create_logs: {
			title: "Create logs table",
			description: "Creates the logs table used by the dashboard",
			sql: "CREATE TABLE logs (id uuid primary key);",
		},
	},
}));

type DbInitializerModule = typeof import("./db-initializer");
type ExecutionState = ReturnType<typeof createInitialExecutionState>;
let moduleCache: DbInitializerModule | null = null;

async function getDbInitializer() {
	if (!moduleCache) {
		moduleCache = await import("./db-initializer");
	}
	return moduleCache.DbInitializer;
}

describe("DbInitializer", () => {
	it("formats execution helper output for loading, warnings, notices, and aggregates", () => {
		const loadingState = createInitialExecutionState();
		assert.deepEqual(getSqlStatuses(loadingState), ["loading", "loading"]);
		assert.equal(allStatementsSucceeded(loadingState), false);

		const executionState = {
			create_devices: {
				status: "success" as const,
				result: [{ table: "devices" }],
				notices: [{ message: "created index" }],
				executionTime: 11,
			},
			create_logs: {
				status: "warning" as const,
				result: [],
				notices: [],
				error: "already exists",
			},
		};
		const typedExecutionState = executionState as unknown as ExecutionState;

		assert.equal(getStatusText("idle"), "");
		assert.equal(getStatusText("loading"), "running...");
		assert.equal(
			getTitleWithStatus("Create logs table", "warning"),
			"-- Create logs table (warning!)",
		);
		assert.equal(
			getExecutionResultSql("loading", executionState.create_devices),
			"-- Executing...\n",
		);
		assert.equal(
			getWarningSql("already exists"),
			"-- WARNING: already exists\n-- (This warning was non-fatal and execution continued)\n",
		);
		assert.equal(
			getExecutionAppendixSql("success", executionState.create_devices),
			'\n\n-- Result: (11ms)\n-- [\n--   {\n--     "table": "devices"\n--   }\n-- ]\n\n-- Database Notices:\n-- [\n--   {\n--     "message": "created index"\n--   }\n-- ]\n',
		);
		assert.equal(getExecutionNoticesSql(executionState.create_logs), "");
		assert.deepEqual(getExecutionCounts(typedExecutionState), {
			errorCount: 0,
			loadingCount: 0,
			successCount: 1,
			warningCount: 1,
		});
		assert.equal(allStatementsSucceeded(typedExecutionState), true);
		assert.match(getAllSql(typedExecutionState), /already exists/);
	});

	it("formats JSON values as SQL comments", () => {
		assert.equal(
			formatJsonAsSqlComment({ nested: ["value"] }),
			'-- {\n--   "nested": [\n--     "value"\n--   ]\n-- }\n',
		);
	});

	it("renders execution summary, statement details, and copy feedback states", () => {
		const executionState = {
			create_devices: {
				status: "success" as const,
				result: [{ table: "devices" }],
				notices: [{ message: "created index" }],
				executionTime: 11,
			},
			create_logs: {
				status: "error" as const,
				result: [],
				notices: [],
				error: "permission denied",
			},
		};
		const typedExecutionState = executionState as unknown as ExecutionState;

		const summaryHtml = renderToStaticMarkup(
			<ExecutionSummary executionState={typedExecutionState} />,
		);
		const loadingSummaryHtml = renderToStaticMarkup(
			<ExecutionSummary executionState={createInitialExecutionState()} />,
		);
		const detailsHtml = renderToStaticMarkup(
			<StatementExecutionDetails
				status="success"
				execution={executionState.create_devices}
			/>,
		);
		const errorHtml = renderToStaticMarkup(
			<StatementExecutionDetails
				status="error"
				execution={executionState.create_logs}
			/>,
		);
		const copyErrorHtml = renderToStaticMarkup(
			<CopyErrorNotice copyError="Copy failed" />,
		);
		const expandHtml = renderToStaticMarkup(
			<ExpandToggle isExpanded={false} onToggle={() => undefined} />,
		);

		assert.match(summaryHtml, /1 succeeded/);
		assert.match(summaryHtml, /1 failed/);
		assert.match(
			summaryHtml,
			/Some operations failed\. Please check the errors and try again\./,
		);
		assert.match(loadingSummaryHtml, /Executing statements/);
		assert.match(detailsHtml, /-- Result: \(11ms\)/);
		assert.match(detailsHtml, /Database Notices/);
		assert.match(errorHtml, /-- ERROR: permission denied/);
		assert.match(copyErrorHtml, /Copy failed/);
		assert.match(expandHtml, /Show more/);
	});

	it("renders the SQL panel and initialize action when a connection url exists", async () => {
		const DbInitializer = await getDbInitializer();
		const html = renderToStaticMarkup(
			<DbInitializer connectionUrl="postgres://user:pass@db.internal/app" />,
		);

		assert.match(html, /Initialize database/);
		assert.match(html, /Copy all/);
		assert.match(html, /Show more/);
		assert.match(html, /Create devices table/);
		assert.match(html, /Create logs table/);
		assert.match(html, /CREATE TABLE devices/);
		assert.match(html, /CREATE TABLE logs/);
		assert.match(html, /postgres:\/\/user:pass@db\.internal\/app/);
	});

	it("falls back to a generic header without initializer actions", async () => {
		const DbInitializer = await getDbInitializer();
		const html = renderToStaticMarkup(<DbInitializer />);

		assert.doesNotMatch(html, /Initialize database/);
		assert.match(html, /Database initialization SQL/);
		assert.match(html, /Copy all/);
	});
});
