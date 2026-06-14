import { afterEach, describe, expect, it, vi } from "vitest";

async function loadModule(options?: {
	dbReady?: boolean;
	insertRejects?: Error | null;
}) {
	vi.resetModules();

	const executeMock = options?.insertRejects
		? vi.fn().mockRejectedValue(options.insertRejects)
		: vi.fn().mockResolvedValue(undefined);
	const valuesMock = vi.fn(() => ({
		execute: executeMock,
	}));
	const insertIntoMock = vi.fn(() => ({
		values: valuesMock,
	}));
	const checkDbConnectionMock = vi
		.fn()
		.mockResolvedValue({ ready: options?.dbReady ?? true });
	const db = { insertInto: insertIntoMock };

	vi.doMock("@/lib/database/db", () => ({ db }));
	vi.doMock("@/lib/database/utils", () => ({
		checkDbConnection: checkDbConnectionMock,
	}));

	const mod = await import("./logger");
	return {
		...mod,
		db,
		insertIntoMock,
		valuesMock,
		executeMock,
		checkDbConnectionMock,
	};
}

describe("lib logger", () => {
	afterEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
	});

	it("falls back to colorized console output when the database is unavailable", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
		const { log } = await loadModule({ dbReady: false });

		await log("warn", new Error("no db"));

		expect(logSpy).toHaveBeenNthCalledWith(1, "\x1b[33m[WARN]\x1b[0m no db");
		expect(logSpy).toHaveBeenNthCalledWith(
			2,
			expect.stringContaining("[WARN]"),
		);
	});

	it("writes to console and enqueues a database log entry", async () => {
		const infoSpy = vi
			.spyOn(console, "log")
			.mockImplementation(() => undefined);
		const { log, valuesMock, executeMock } = await loadModule();

		await log("info", "hello", {
			source: "route",
			metadata: { ok: true },
			trace: "trace-id",
		});
		await Promise.resolve();

		expect(infoSpy).toHaveBeenCalledWith("hello");
		expect(valuesMock).toHaveBeenCalledWith({
			level: "info",
			message: "hello",
			source: "route",
			metadata: JSON.stringify({ ok: true }),
			trace: "trace-id",
		});
		expect(executeMock).toHaveBeenCalledTimes(1);
	});

	it("logs insert failures from the async database writer", async () => {
		const errorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const { log } = await loadModule({
			insertRejects: new Error("insert failed"),
		});

		await log("error", "broken");
		await Promise.resolve();

		expect(errorSpy).toHaveBeenCalledWith("broken");
		expect(errorSpy).toHaveBeenCalledWith(
			"Error writing to system_logs:",
			expect.any(Error),
		);
	});

	it("exposes convenience wrappers", async () => {
		const infoSpy = vi
			.spyOn(console, "log")
			.mockImplementation(() => undefined);
		const errorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const { logInfo, logError } = await loadModule();

		await logInfo("hello");
		await logError("broken");
		await Promise.resolve();

		expect(infoSpy).toHaveBeenCalledWith("hello");
		expect(errorSpy).toHaveBeenCalledWith("broken");
	});
});
