import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	checkDbConnection: vi.fn(),
	getCurrentUser: vi.fn(),
}));

async function loadAdminUtils() {
	vi.resetModules();
	vi.doMock("@/lib/auth/get-user", () => ({
		getCurrentUser: state.getCurrentUser,
	}));
	vi.doMock("@/lib/database/utils", () => ({
		checkDbConnection: state.checkDbConnection,
	}));

	return import("./admin-utils");
}

describe("admin-utils", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.resetModules();
		state.checkDbConnection.mockReset();
		state.getCurrentUser.mockReset();
	});

	it("rejects non-admin users", async () => {
		state.getCurrentUser.mockResolvedValue({ id: "user-1", role: "user" });
		const { requireAdmin } = await loadAdminUtils();

		await expect(requireAdmin()).rejects.toThrow("Unauthorized");
	});

	it("rejects missing users", async () => {
		state.getCurrentUser.mockResolvedValue(null);
		const { requireAdmin } = await loadAdminUtils();

		await expect(requireAdmin()).rejects.toThrow("Unauthorized");
	});

	it("returns the action result when admin and database are ready", async () => {
		state.getCurrentUser.mockResolvedValue({ id: "admin-1", role: "admin" });
		state.checkDbConnection.mockResolvedValue({ ready: true });
		const action = vi.fn().mockResolvedValue({ ok: true });
		const { withAdminDb } = await loadAdminUtils();

		await expect(withAdminDb({ ok: false }, action)).resolves.toEqual({
			ok: true,
		});
		expect(action).toHaveBeenCalledTimes(1);
	});

	it("returns the unavailable result when the database is down", async () => {
		state.getCurrentUser.mockResolvedValue({ id: "admin-1", role: "admin" });
		state.checkDbConnection.mockResolvedValue({ ready: false });
		const action = vi.fn();
		const { withAdminDb } = await loadAdminUtils();

		await expect(withAdminDb({ ok: false }, action)).resolves.toEqual({
			ok: false,
		});
		expect(action).not.toHaveBeenCalled();
	});

	it("maps thrown action errors in runAdminAction", async () => {
		state.getCurrentUser.mockResolvedValue({ id: "admin-1", role: "admin" });
		state.checkDbConnection.mockResolvedValue({ ready: true });
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const { runAdminAction } = await loadAdminUtils();

		await expect(
			runAdminAction(
				async () => {
					throw new Error("delete failed");
				},
				{ logMessage: "Admin action failed:" },
			),
		).resolves.toEqual({
			success: false,
			error: "delete failed",
		});
		expect(error).toHaveBeenCalledWith(
			"Admin action failed:",
			expect.any(Error),
		);
	});

	it("maps non-error failures with the provided unknown error fallback", async () => {
		state.getCurrentUser.mockResolvedValue({ id: "admin-1", role: "admin" });
		state.checkDbConnection.mockResolvedValue({ ready: true });
		const { runAdminAction } = await loadAdminUtils();

		await expect(
			runAdminAction(
				async () => {
					throw null;
				},
				{ unknownError: "unknown failure" },
			),
		).resolves.toEqual({
			success: false,
			error: "unknown failure",
		});
	});
});
