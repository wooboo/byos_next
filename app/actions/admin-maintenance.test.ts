import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	db: {
		deleteFrom: vi.fn(),
	},
	runAdminAction: vi.fn(),
}));

async function loadAdminMaintenance() {
	vi.resetModules();
	vi.doMock("@/lib/database/db", () => ({
		db: state.db,
	}));
	vi.doMock("./admin-utils", () => ({
		runAdminAction: state.runAdminAction,
	}));

	return import("./admin-maintenance");
}

describe("admin-maintenance", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.resetModules();
		state.db.deleteFrom.mockReset();
		state.runAdminAction.mockReset();
	});

	it("deletes all system logs through the admin wrapper", async () => {
		const where = vi.fn().mockReturnThis();
		const executeTakeFirst = vi
			.fn()
			.mockResolvedValue({ numDeletedRows: BigInt(3) });

		state.db.deleteFrom.mockReturnValue({
			where,
			executeTakeFirst,
		});
		state.runAdminAction.mockImplementation(async (action, options) => {
			expect(options).toEqual({
				logMessage: "Error deleting system logs:",
				unknownError: "Unknown error",
			});
			return action();
		});
		const { deleteAllSystemLogs } = await loadAdminMaintenance();

		await expect(deleteAllSystemLogs()).resolves.toEqual({
			success: true,
			count: 3,
		});
		expect(state.db.deleteFrom).toHaveBeenCalledWith("system_logs");
		expect(where).toHaveBeenCalledWith("id", "is not", null);
	});

	it("deletes all device logs through the admin wrapper", async () => {
		const where = vi.fn().mockReturnThis();
		const executeTakeFirst = vi
			.fn()
			.mockResolvedValue({ numDeletedRows: BigInt(8) });

		state.db.deleteFrom.mockReturnValue({
			where,
			executeTakeFirst,
		});
		state.runAdminAction.mockImplementation(async (action, options) => {
			expect(options).toEqual({
				logMessage: "Error deleting device logs:",
				unknownError: "Unknown error",
			});
			return action();
		});
		const { deleteAllDeviceLogs } = await loadAdminMaintenance();

		await expect(deleteAllDeviceLogs()).resolves.toEqual({
			success: true,
			count: 8,
		});
		expect(state.db.deleteFrom).toHaveBeenCalledWith("logs");
		expect(where).toHaveBeenCalledWith("id", ">", "0");
	});
});
