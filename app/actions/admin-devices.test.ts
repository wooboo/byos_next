import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	db: {
		deleteFrom: vi.fn(),
		selectFrom: vi.fn(),
		updateTable: vi.fn(),
	},
	runAdminAction: vi.fn(),
	withAdminDb: vi.fn(),
}));

async function loadAdminDevices() {
	vi.resetModules();
	vi.doMock("@/lib/database/db", () => ({
		db: state.db,
	}));
	vi.doMock("./admin-utils", () => ({
		runAdminAction: state.runAdminAction,
		withAdminDb: state.withAdminDb,
	}));

	return import("./admin-devices");
}

describe("admin-devices", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.resetModules();
		state.db.deleteFrom.mockReset();
		state.db.selectFrom.mockReset();
		state.db.updateTable.mockReset();
		state.runAdminAction.mockReset();
		state.withAdminDb.mockReset();
	});

	it("returns all devices for admins", async () => {
		const execute = vi.fn().mockResolvedValue([{ id: 1, name: "Kitchen" }]);
		const query = {
			leftJoin: vi.fn().mockReturnThis(),
			select: vi.fn().mockReturnThis(),
			orderBy: vi.fn().mockReturnThis(),
			execute,
		};

		state.db.selectFrom.mockReturnValue(query);
		state.withAdminDb.mockImplementation(async (_fallback, action) => action());
		const { fetchAllDevicesAdmin } = await loadAdminDevices();

		await expect(fetchAllDevicesAdmin()).resolves.toEqual([
			{ id: 1, name: "Kitchen" },
		]);
		expect(state.db.selectFrom).toHaveBeenCalledWith("devices");
	});

	it("returns all users for admins", async () => {
		const execute = vi
			.fn()
			.mockResolvedValue([
				{ id: "user-1", name: "Ada", email: "ada@example.com" },
			]);
		const query = {
			select: vi.fn().mockReturnThis(),
			orderBy: vi.fn().mockReturnThis(),
			execute,
		};

		state.db.selectFrom.mockReturnValue(query);
		state.withAdminDb.mockImplementation(async (_fallback, action) => action());
		const { fetchAllUsersForAdmin } = await loadAdminDevices();

		await expect(fetchAllUsersForAdmin()).resolves.toEqual([
			{ id: "user-1", name: "Ada", email: "ada@example.com" },
		]);
		expect(state.db.selectFrom).toHaveBeenCalledWith("user");
	});

	it("assigns a device to a user", async () => {
		const set = vi.fn().mockReturnThis();
		const where = vi.fn().mockReturnThis();
		const execute = vi.fn().mockResolvedValue(undefined);

		state.db.updateTable.mockReturnValue({
			set,
			where,
			execute,
		});
		state.runAdminAction.mockImplementation(async (action) => action());
		const { assignDeviceToUser } = await loadAdminDevices();

		await expect(assignDeviceToUser(7, "user-7")).resolves.toEqual({
			success: true,
		});
		expect(state.db.updateTable).toHaveBeenCalledWith("devices");
		expect(set).toHaveBeenCalledWith(
			expect.objectContaining({ user_id: "user-7" }),
		);
		expect(where).toHaveBeenCalledWith("id", "=", "7");
	});

	it("unassigns a device from a user", async () => {
		const set = vi.fn().mockReturnThis();
		const where = vi.fn().mockReturnThis();
		const execute = vi.fn().mockResolvedValue(undefined);

		state.db.updateTable.mockReturnValue({
			set,
			where,
			execute,
		});
		state.runAdminAction.mockImplementation(async (action) => action());
		const { unassignDevice } = await loadAdminDevices();

		await expect(unassignDevice(9)).resolves.toEqual({ success: true });
		expect(set).toHaveBeenCalledWith(
			expect.objectContaining({ user_id: null }),
		);
		expect(where).toHaveBeenCalledWith("id", "=", "9");
	});

	it("deletes a device through the admin wrapper", async () => {
		const where = vi.fn().mockReturnThis();
		const execute = vi.fn().mockResolvedValue(undefined);

		state.db.deleteFrom.mockReturnValue({
			where,
			execute,
		});
		state.runAdminAction.mockImplementation(async (action) => action());
		const { deleteDeviceAdmin } = await loadAdminDevices();

		await expect(deleteDeviceAdmin(11)).resolves.toEqual({ success: true });
		expect(state.db.deleteFrom).toHaveBeenCalledWith("devices");
		expect(where).toHaveBeenCalledWith("id", "=", "11");
	});
});
