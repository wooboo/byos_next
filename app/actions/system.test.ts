import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	auth: null as unknown,
	checkDbConnection: vi.fn(),
	db: {
		selectFrom: vi.fn(),
	},
	getCurrentUser: vi.fn(),
}));

async function loadSystem() {
	vi.resetModules();
	vi.doMock("@/lib/auth/auth", () => ({
		auth: state.auth,
	}));
	vi.doMock("@/lib/auth/get-user", () => ({
		getCurrentUser: state.getCurrentUser,
	}));
	vi.doMock("@/lib/database/db", () => ({
		db: state.db,
	}));
	vi.doMock("@/lib/database/utils", () => ({
		checkDbConnection: state.checkDbConnection,
	}));

	return import("./system");
}

function makeExpressionBuilder() {
	const calls = {
		and: [] as unknown[][],
		or: [] as unknown[][],
		predicates: [] as Array<[string, string, string]>,
	};
	const eb = Object.assign(
		(field: string, op: string, value: string) => {
			calls.predicates.push([field, op, value]);
			return { field, op, value };
		},
		{
			and: vi.fn((conditions: unknown[]) => {
				calls.and.push(conditions);
				return { kind: "and", conditions };
			}),
			or: vi.fn((conditions: unknown[]) => {
				calls.or.push(conditions);
				return { kind: "or", conditions };
			}),
		},
	);

	return { calls, eb };
}

function makeQuery(executeResult: unknown, countResult?: { count: number }) {
	const expressionBuilder = makeExpressionBuilder();
	const query = {
		selectAll: vi.fn().mockReturnThis(),
		select: vi.fn().mockReturnThis(),
		distinct: vi.fn().mockReturnThis(),
		where: vi.fn((...args: unknown[]) => {
			if (typeof args[0] === "function") {
				args[0](expressionBuilder.eb);
			}
			return query;
		}),
		orderBy: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
		offset: vi.fn().mockReturnThis(),
		execute: vi.fn().mockResolvedValue(executeResult),
		executeTakeFirst: vi.fn().mockResolvedValue(countResult),
	};

	return { expressionBuilder, query };
}

describe("system actions", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.resetModules();
		state.auth = null;
		state.checkDbConnection.mockReset();
		state.db.selectFrom.mockReset();
		state.getCurrentUser.mockReset();
	});

	it("returns empty system logs when the database is unavailable", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: false });
		const { fetchSystemLogs } = await loadSystem();

		await expect(fetchSystemLogs({ page: 1, perPage: 10 })).resolves.toEqual({
			logs: [],
			total: 0,
			uniqueSources: [],
		});
	});

	it("returns empty system logs for non-admin users when auth is enabled", async () => {
		state.auth = {};
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUser.mockResolvedValue({ id: "user-1", role: "user" });
		const { fetchSystemLogs } = await loadSystem();

		await expect(fetchSystemLogs({ page: 1, perPage: 10 })).resolves.toEqual({
			logs: [],
			total: 0,
			uniqueSources: [],
		});
	});

	it("fetches system logs with total and unique sources", async () => {
		const pagedQuery = makeQuery([{ id: "log-1", source: "sync" }]);
		const countQuery = makeQuery([], { count: 4 });
		const uniqueSourcesQuery = makeQuery([
			{ source: "api" },
			{ source: "sync" },
			{ source: null },
		]);

		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.db.selectFrom
			.mockReturnValueOnce(pagedQuery.query)
			.mockReturnValueOnce(countQuery.query)
			.mockReturnValueOnce(uniqueSourcesQuery.query);
		const { fetchSystemLogs } = await loadSystem();

		await expect(
			fetchSystemLogs({
				page: 1,
				perPage: 25,
				search: "sync",
				level: "warn",
				source: "api",
			}),
		).resolves.toEqual({
			logs: [{ id: "log-1", source: "sync" }],
			total: 4,
			uniqueSources: ["api", "sync"],
		});
		expect(pagedQuery.query.where).toHaveBeenCalledWith("level", "=", "warn");
		expect(pagedQuery.query.where).toHaveBeenCalledWith("source", "=", "api");
		expect(pagedQuery.expressionBuilder.calls.or).toEqual([
			[
				{ field: "message", op: "ilike", value: "%sync%" },
				{ field: "metadata", op: "ilike", value: "%sync%" },
			],
		]);
	});

	it("fetches device system logs with metadata filters", async () => {
		const pagedQuery = makeQuery([{ id: "device-log-1" }]);
		const countQuery = makeQuery([], { count: 1 });
		const uniqueSourcesQuery = makeQuery([{ source: "device-sync" }]);

		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.db.selectFrom
			.mockReturnValueOnce(pagedQuery.query)
			.mockReturnValueOnce(countQuery.query)
			.mockReturnValueOnce(uniqueSourcesQuery.query);
		const { fetchDeviceSystemLogs } = await loadSystem();

		await expect(
			fetchDeviceSystemLogs({
				page: 1,
				perPage: 5,
				search: "wifi",
				level: "error",
				source: "device-sync",
				deviceId: 42,
				friendlyId: "device-42",
				macAddress: "AA:BB",
				apiKey: "secret",
			}),
		).resolves.toEqual({
			logs: [{ id: "device-log-1" }],
			total: 1,
			uniqueSources: ["device-sync"],
		});
		expect(pagedQuery.query.where).toHaveBeenCalledWith("level", "=", "error");
		expect(pagedQuery.query.where).toHaveBeenCalledWith(
			"source",
			"=",
			"device-sync",
		);
		expect(
			pagedQuery.expressionBuilder.calls.predicates.map(([, , value]) => value),
		).toEqual([
			"%wifi%",
			"%wifi%",
			'%"device_id":42%',
			'%"id":42%',
			'%"friendly_id":"device-42"%',
			'%"mac_address":"AA:BB"%',
			'%"api_key":"secret"%',
		]);
	});

	it("builds an empty device metadata filter when no device fields are provided", async () => {
		state.auth = {};
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUser.mockResolvedValue({ id: "admin-1", role: "admin" });
		const pagedQuery = makeQuery([]);
		const countQuery = makeQuery([], { count: 0 });
		const uniqueSourcesQuery = makeQuery([]);

		state.db.selectFrom
			.mockReturnValueOnce(pagedQuery.query)
			.mockReturnValueOnce(countQuery.query)
			.mockReturnValueOnce(uniqueSourcesQuery.query);
		const { fetchDeviceSystemLogs } = await loadSystem();

		await expect(
			fetchDeviceSystemLogs({
				page: 2,
				perPage: 10,
				level: "info",
				source: "api",
			}),
		).resolves.toEqual({
			logs: [],
			total: 0,
			uniqueSources: [],
		});
		expect(pagedQuery.expressionBuilder.calls.and).toEqual([[]]);
	});
});
