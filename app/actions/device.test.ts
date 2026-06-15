import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	checkDbConnection: vi.fn(),
	db: {
		selectFrom: vi.fn(),
	},
	getCurrentUserId: vi.fn(),
	redirect: vi.fn(),
	revalidatePath: vi.fn(),
	withUserScope: vi.fn(),
}));

async function loadDevice() {
	vi.resetModules();
	vi.doMock("@/lib/auth/get-user", () => ({
		getCurrentUserId: state.getCurrentUserId,
	}));
	vi.doMock("@/lib/database/db", () => ({
		db: state.db,
	}));
	vi.doMock("@/lib/database/scoped-db", () => ({
		withUserScope: state.withUserScope,
	}));
	vi.doMock("@/lib/database/utils", () => ({
		checkDbConnection: state.checkDbConnection,
	}));
	vi.doMock("next/cache", () => ({
		revalidatePath: state.revalidatePath,
	}));
	vi.doMock("next/navigation", () => ({
		redirect: state.redirect,
	}));

	return import("./device");
}

describe("device actions", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-02T03:04:05.000Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		vi.resetModules();
		state.checkDbConnection.mockReset();
		state.db.selectFrom.mockReset();
		state.getCurrentUserId.mockReset();
		state.redirect.mockReset();
		state.revalidatePath.mockReset();
		state.withUserScope.mockReset();
	});

	it("returns null when the database is unavailable", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: false });
		const { fetchDeviceByFriendlyId } = await loadDevice();

		await expect(fetchDeviceByFriendlyId("device-1")).resolves.toBeNull();
	});

	it("returns an empty log list when no visible devices match", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.withUserScope.mockResolvedValue([]);
		const { fetchDeviceLogs } = await loadDevice();

		await expect(fetchDeviceLogs("missing-device")).resolves.toEqual([]);
		expect(state.db.selectFrom).not.toHaveBeenCalled();
	});

	it("returns an empty log list when fetchDeviceLogs has no database connection", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: false });
		const { fetchDeviceLogs } = await loadDevice();

		await expect(fetchDeviceLogs("device-1")).resolves.toEqual([]);
	});

	it("fetches recent device logs for visible device ids", async () => {
		const logQuery = {
			selectAll: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			orderBy: vi.fn().mockReturnThis(),
			limit: vi.fn().mockReturnThis(),
			execute: vi
				.fn()
				.mockResolvedValue([
					{ id: 1, friendly_id: "device-1", log_data: "ok" },
				]),
		};

		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.withUserScope.mockResolvedValue([{ friendly_id: "device-1" }]);
		state.db.selectFrom.mockReturnValue(logQuery);
		const { fetchDeviceLogs } = await loadDevice();

		await expect(fetchDeviceLogs("device-1")).resolves.toEqual([
			{ id: 1, friendly_id: "device-1", log_data: "ok" },
		]);
		expect(logQuery.where).toHaveBeenCalledWith("friendly_id", "in", [
			"device-1",
		]);
	});

	it("fetches paginated logs and derives unique types", async () => {
		const logQuery = {
			selectAll: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			orderBy: vi.fn().mockReturnThis(),
			limit: vi.fn().mockReturnThis(),
			offset: vi.fn().mockReturnThis(),
			execute: vi
				.fn()
				.mockResolvedValue([
					{ log_data: "Error: failed to connect" },
					{ log_data: "warn: retrying" },
					{ log_data: "device refreshed" },
				]),
		};
		const countQuery = {
			select: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			executeTakeFirst: vi.fn().mockResolvedValue({ count: 9 }),
		};

		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.withUserScope.mockResolvedValue([{ friendly_id: "device-1" }]);
		state.db.selectFrom
			.mockReturnValueOnce(logQuery)
			.mockReturnValueOnce(countQuery);
		const { fetchDeviceLogsWithFilters } = await loadDevice();

		await expect(
			fetchDeviceLogsWithFilters({
				page: 2,
				perPage: 3,
				search: "connect",
				friendlyId: "device-1",
			}),
		).resolves.toEqual({
			logs: [
				{ log_data: "Error: failed to connect" },
				{ log_data: "warn: retrying" },
				{ log_data: "device refreshed" },
			],
			total: 9,
			uniqueTypes: ["error", "warning", "info"],
		});
	});

	it("returns an empty filtered log payload when the database is unavailable", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: false });
		const { fetchDeviceLogsWithFilters } = await loadDevice();

		await expect(
			fetchDeviceLogsWithFilters({ page: 1, perPage: 10 }),
		).resolves.toEqual({
			logs: [],
			total: 0,
			uniqueTypes: [],
		});
	});

	it("returns an empty filtered log payload when no visible devices match", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.withUserScope.mockResolvedValue([]);
		const { fetchDeviceLogsWithFilters } = await loadDevice();

		await expect(
			fetchDeviceLogsWithFilters({
				page: 1,
				perPage: 10,
				friendlyId: "missing",
			}),
		).resolves.toEqual({
			logs: [],
			total: 0,
			uniqueTypes: [],
		});
	});

	it("rejects short API keys when adding a user device", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue("user-1");
		const { addUserDevice } = await loadDevice();

		await expect(addUserDevice({ apiKey: " short " })).resolves.toEqual({
			success: false,
			error: "API key must be at least 8 characters",
		});
	});

	it("prevents duplicate API keys", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue("user-1");
		state.db.selectFrom.mockReturnValue({
			select: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			executeTakeFirst: vi.fn().mockResolvedValue({ id: 1 }),
		});
		const { addUserDevice } = await loadDevice();

		await expect(addUserDevice({ apiKey: "duplicate-key" })).resolves.toEqual({
			success: false,
			error: "A device with this API key already exists",
		});
	});

	it("creates a device with generated identifiers", async () => {
		const execute = vi.fn().mockResolvedValue(undefined);

		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue("user-7");
		state.db.selectFrom.mockReturnValue({
			select: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			executeTakeFirst: vi.fn().mockResolvedValue(undefined),
		});
		state.withUserScope.mockImplementation(async (callback) =>
			callback({
				insertInto: vi.fn().mockReturnValue({
					values: vi.fn().mockReturnValue({
						execute,
					}),
				}),
			}),
		);
		const { addUserDevice } = await loadDevice();

		const result = await addUserDevice({
			apiKey: "  example-api-key  ",
			name: "  Office display  ",
		});

		expect(result.success).toBe(true);
		expect(result.apiKey).toBe("example-api-key");
		expect(result.friendlyId).toBeTypeOf("string");
		expect(result.friendlyId?.length).toBeGreaterThan(0);
	});

	it("returns an auth error when adding a device without a signed-in user", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue(null);
		const { addUserDevice } = await loadDevice();

		await expect(addUserDevice({ apiKey: "valid-key-1" })).resolves.toEqual({
			success: false,
			error: "You must be signed in to add a device",
		});
	});

	it("returns insert failures from addUserDevice", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.getCurrentUserId.mockResolvedValue("user-9");
		state.db.selectFrom.mockReturnValue({
			select: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			executeTakeFirst: vi.fn().mockResolvedValue(undefined),
		});
		state.withUserScope.mockRejectedValue(new Error("insert failed"));
		const { addUserDevice } = await loadDevice();

		await expect(addUserDevice({ apiKey: "valid-key-2" })).resolves.toEqual({
			success: false,
			error: "insert failed",
		});
	});

	it("returns a database error when addUserDevice has no database connection", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: false });
		const { addUserDevice } = await loadDevice();

		await expect(addUserDevice({ apiKey: "valid-key-3" })).resolves.toEqual({
			success: false,
			error: "Database not available",
		});
	});

	it("updates devices with serialized refresh schedules and stringified ids", async () => {
		const execute = vi.fn().mockResolvedValue(undefined);
		const where = vi.fn().mockReturnValue({ execute });
		const set = vi.fn().mockReturnValue({ where });

		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.withUserScope.mockImplementation(async (callback) =>
			callback({
				updateTable: vi.fn().mockReturnValue({ set }),
			}),
		);
		const { updateDevice } = await loadDevice();

		await expect(
			updateDevice({
				id: 42,
				name: "Kitchen",
				refresh_schedule: {
					default_refresh_rate: 120,
					time_ranges: [
						{
							start_time: "08:00",
							end_time: "12:00",
							refresh_rate: 300,
						},
					],
				},
				screen_id: "screen-1",
			}),
		).resolves.toEqual({ success: true });
		expect(set).toHaveBeenCalledWith({
			name: "Kitchen",
			refresh_schedule:
				'{"default_refresh_rate":120,"time_ranges":[{"start_time":"08:00","end_time":"12:00","refresh_rate":300}]}',
			screen_id: "screen-1",
			updated_at: "2026-01-02T03:04:05.000Z",
		});
		expect(where).toHaveBeenCalledWith("id", "=", "42");
	});

	it("updates devices with a null refresh schedule", async () => {
		const execute = vi.fn().mockResolvedValue(undefined);
		const where = vi.fn().mockReturnValue({ execute });
		const set = vi.fn().mockReturnValue({ where });

		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.withUserScope.mockImplementation(async (callback) =>
			callback({
				updateTable: vi.fn().mockReturnValue({ set }),
			}),
		);
		const { updateDevice } = await loadDevice();

		await expect(
			updateDevice({
				id: 43,
				refresh_schedule: null,
			}),
		).resolves.toEqual({ success: true });
		expect(set).toHaveBeenCalledWith({
			refresh_schedule: null,
			updated_at: "2026-01-02T03:04:05.000Z",
		});
	});

	it("returns a database error when updateDevice has no database connection", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: false });
		const { updateDevice } = await loadDevice();

		await expect(updateDevice({ id: 7 })).resolves.toEqual({
			success: false,
			error: "Database client not initialized",
		});
	});

	it("returns update failures from updateDevice", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.withUserScope.mockRejectedValue(new Error("update failed"));
		const { updateDevice } = await loadDevice();

		await expect(updateDevice({ id: 7 })).resolves.toEqual({
			success: false,
			error: "update failed",
		});
	});

	it("deletes a device visible to the current user and redirects home", async () => {
		const execute = vi.fn().mockResolvedValue(undefined);
		const where = vi.fn().mockReturnValue({ execute });
		const deleteFrom = vi.fn().mockReturnValue({ where });

		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.withUserScope.mockImplementation(async (callback) =>
			callback({ deleteFrom }),
		);
		const { deleteDevice } = await loadDevice();

		await deleteDevice("ABC123");

		expect(deleteFrom).toHaveBeenCalledWith("devices");
		expect(where).toHaveBeenCalledWith("friendly_id", "=", "ABC123");
		expect(state.revalidatePath.mock.calls).toEqual([
			["/"],
			["/device/ABC123"],
		]);
		expect(state.redirect).toHaveBeenCalledWith("/");
	});

	it("throws when deleteDevice has no database connection", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: false });
		const { deleteDevice } = await loadDevice();

		await expect(deleteDevice("ABC123")).rejects.toThrow(
			"Database client not initialized",
		);
		expect(state.withUserScope).not.toHaveBeenCalled();
	});
});
