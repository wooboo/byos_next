import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	getDbStatus: vi.fn(),
	withUserScope: vi.fn(),
}));

function makeQuery(result: unknown) {
	return {
		selectAll() {
			return this;
		},
		select() {
			return this;
		},
		distinct() {
			return this;
		},
		orderBy() {
			return this;
		},
		limit() {
			return this;
		},
		execute: vi.fn().mockResolvedValue(result),
		executeTakeFirst: vi.fn().mockResolvedValue(result),
	};
}

function makeScopedDb() {
	const resultsByTable = new Map<string, unknown>([
		["devices", [{ id: "device-1" }]],
		["playlists", [{ id: "playlist-1" }]],
		["playlist_items", [{ id: "item-1" }]],
		["mixups", [{ id: "mixup-1" }]],
		["system_logs:logs", [{ id: "log-1" }]],
		[
			"system_logs:sources",
			[
				{ source: "api" },
				{ source: "api" },
				{ source: "worker" },
				{ source: null },
			],
		],
		["system_logs:count", { count: "12" }],
	]);
	let systemLogsCalls = 0;

	return {
		selectFrom(table: string) {
			if (table !== "system_logs") {
				return makeQuery(resultsByTable.get(table));
			}

			systemLogsCalls += 1;
			const key =
				systemLogsCalls === 1
					? "system_logs:logs"
					: systemLogsCalls === 2
						? "system_logs:sources"
						: "system_logs:count";
			return makeQuery(resultsByTable.get(key));
		},
	};
}

async function loadGetInitData() {
	vi.resetModules();
	vi.doMock("react", () => ({
		cache: <T>(fn: T) => fn,
	}));
	vi.doMock("@/lib/database/scoped-db", () => ({
		withUserScope: state.withUserScope,
	}));
	vi.doMock("@/lib/database/utils", () => ({
		getDbStatus: state.getDbStatus,
	}));
	vi.doMock("server-only", () => ({}));
	return import("./getInitData");
}

describe("getInitData", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.resetModules();
		state.getDbStatus.mockReset();
		state.withUserScope.mockReset();
	});

	it("returns empty collections when the database is not ready", async () => {
		state.getDbStatus.mockResolvedValue({
			ready: false,
			error: "unavailable",
		});
		const { getDevices, getInitData } = await loadGetInitData();

		await expect(getInitData()).resolves.toEqual({
			devices: [],
			playlists: [],
			playlistItems: [],
			mixups: [],
			systemLogs: [],
			uniqueSources: [],
			totalLogs: 0,
			dbStatus: { ready: false, error: "unavailable" },
		});
		await expect(getDevices()).resolves.toEqual([]);
		expect(state.withUserScope).not.toHaveBeenCalled();
	});

	it("returns fetched data with unique log sources and total count", async () => {
		state.getDbStatus.mockResolvedValue({ ready: true });
		state.withUserScope.mockImplementation(async (callback) =>
			callback(makeScopedDb()),
		);
		const { getInitData } = await loadGetInitData();

		await expect(getInitData()).resolves.toEqual({
			devices: [{ id: "device-1" }],
			playlists: [{ id: "playlist-1" }],
			playlistItems: [{ id: "item-1" }],
			mixups: [{ id: "mixup-1" }],
			systemLogs: [{ id: "log-1" }],
			uniqueSources: ["api", "worker"],
			totalLogs: 12,
			dbStatus: { ready: true },
		});
	});

	it("falls back to empty data when scoped queries fail", async () => {
		state.getDbStatus.mockResolvedValue({ ready: true });
		state.withUserScope.mockRejectedValue(new Error("query failed"));
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		const { getInitData } = await loadGetInitData();

		await expect(getInitData()).resolves.toEqual({
			devices: [],
			playlists: [],
			playlistItems: [],
			mixups: [],
			systemLogs: [],
			uniqueSources: [],
			totalLogs: 0,
			dbStatus: { ready: true },
		});
	});
});
