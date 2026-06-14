import { afterEach, describe, expect, it, vi } from "vitest";

async function loadModule(options?: {
	dbReady?: boolean;
	backfilled?: number;
}) {
	vi.resetModules();

	const screens = {
		alpha: {
			title: "Alpha",
			published: true,
			description: "First screen",
			author: { name: "Ada", github: "ada" },
			category: "Status",
			version: "1.0.0",
		},
		beta: {
			title: "Beta",
			published: false,
		},
	};

	const insertedValues: unknown[] = [];
	const conflictCalls: unknown[] = [];
	const executeMock = vi.fn().mockResolvedValue(undefined);
	const insertBuilder = {
		values: vi.fn((value: unknown) => {
			insertedValues.push(value);
			return insertBuilder;
		}),
		onConflict: vi.fn((callback: (oc: Record<string, unknown>) => unknown) => {
			const oc = {
				columns: vi.fn(() => oc),
				where: vi.fn(() => oc),
				doUpdateSet: vi.fn((value: unknown) => {
					conflictCalls.push(value);
					return oc;
				}),
			};
			callback(oc);
			return insertBuilder;
		}),
		execute: executeMock,
	};
	const db = {
		insertInto: vi.fn(() => insertBuilder),
	};
	const sqlExecuteMock = vi.fn().mockResolvedValue({
		numAffectedRows: BigInt(options?.backfilled ?? 3),
	});
	const sqlMock = vi.fn(() => ({
		execute: sqlExecuteMock,
	}));
	const checkDbConnectionMock = vi
		.fn()
		.mockResolvedValue({ ready: options?.dbReady ?? true });
	const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
	const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

	vi.doMock("kysely", () => ({
		sql: sqlMock,
	}));
	vi.doMock("@/app/(app)/recipes/screens.json", () => ({
		default: screens,
	}));
	vi.doMock("@/lib/database/db", () => ({ db }));
	vi.doMock("@/lib/database/utils", () => ({
		checkDbConnection: checkDbConnectionMock,
	}));

	const mod = await import("./sync-react-recipes");
	return {
		...mod,
		screens,
		insertedValues,
		conflictCalls,
		executeMock,
		sqlExecuteMock,
		sqlMock,
		checkDbConnectionMock,
		warnSpy,
		logSpy,
		db,
	};
}

describe("syncReactRecipes", () => {
	afterEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
		vi.doUnmock("kysely");
		vi.doUnmock("@/app/(app)/recipes/screens.json");
		vi.doUnmock("@/lib/database/db");
		vi.doUnmock("@/lib/database/utils");
	});

	it("returns zeros and skips syncing when the database is unavailable", async () => {
		const { syncReactRecipes, db, warnSpy } = await loadModule({
			dbReady: false,
		});

		const result = await syncReactRecipes();

		expect(result).toEqual({ synced: 0, backfilled: 0 });
		expect(db.insertInto).not.toHaveBeenCalled();
		expect(warnSpy).toHaveBeenCalledWith(
			"[syncReactRecipes] Database not available",
		);
	});

	it("upserts every screen config and reports the backfilled slot count", async () => {
		const {
			syncReactRecipes,
			screens,
			insertedValues,
			conflictCalls,
			executeMock,
			sqlExecuteMock,
			logSpy,
		} = await loadModule({ backfilled: 5 });

		const result = await syncReactRecipes();

		expect(executeMock).toHaveBeenCalledTimes(Object.keys(screens).length);
		expect(insertedValues).toHaveLength(Object.keys(screens).length);
		expect(insertedValues[0]).toMatchObject({
			slug: "alpha",
			name: "Alpha",
			description: "First screen",
			author: "Ada",
			author_github: "ada",
			category: "Status",
			version: "1.0.0",
			user_id: null,
			metadata: JSON.stringify(screens.alpha),
		});
		expect(insertedValues[1]).toMatchObject({
			slug: "beta",
			name: "Beta",
			description: null,
			author: null,
			author_github: null,
			category: null,
			version: null,
			metadata: JSON.stringify(screens.beta),
		});
		expect(conflictCalls[0]).toMatchObject({
			name: "Alpha",
			description: "First screen",
			author: "Ada",
			author_github: "ada",
			category: "Status",
			version: "1.0.0",
			metadata: JSON.stringify(screens.alpha),
			updated_at: expect.any(String),
		});
		expect(sqlExecuteMock).toHaveBeenCalledTimes(1);
		expect(result).toEqual({ synced: 2, backfilled: 5 });
		expect(logSpy).toHaveBeenCalledWith(
			"[syncReactRecipes] Synced 2 recipes, backfilled 5 mixup slots",
		);
	});
});
