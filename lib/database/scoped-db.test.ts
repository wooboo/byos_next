import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	connectionExecute: vi.fn(),
	currentUserId: vi.fn(),
	sqlEvents: [] as Array<{
		type: "tag" | "ref";
		value: string;
		target: unknown;
	}>,
}));

async function loadScopedDb() {
	vi.resetModules();
	state.sqlEvents.length = 0;
	vi.doMock("kysely", () => {
		const sql = Object.assign(
			(strings: TemplateStringsArray, ...values: unknown[]) => ({
				execute: vi.fn().mockImplementation(async (target: unknown) => {
					state.sqlEvents.push({
						type: "tag",
						value: strings.reduce(
							(acc, part, index) => acc + part + (values[index] ?? ""),
							"",
						),
						target,
					});
				}),
			}),
			{
				ref: (value: string) => {
					state.sqlEvents.push({ type: "ref", value, target: null });
					return value;
				},
			},
		);
		return { sql };
	});
	vi.doMock("@/lib/auth/get-user", () => ({
		getCurrentUserId: state.currentUserId,
	}));
	vi.doMock("./db", () => ({
		db: {
			connection: () => ({
				execute: state.connectionExecute,
			}),
		},
	}));
	return import("./scoped-db");
}

describe("scoped db", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.resetModules();
		state.connectionExecute.mockReset();
		state.currentUserId.mockReset();
		state.sqlEvents.length = 0;
	});

	it("scopes a callback to the current user and resets connection state afterwards", async () => {
		state.currentUserId.mockResolvedValue("user-7");
		const callback = vi.fn().mockResolvedValue("done");
		state.connectionExecute.mockImplementation(async (runner) => {
			const conn = { connectionId: "conn-1" };
			return runner(conn);
		});
		const { withUserScope } = await loadScopedDb();

		await expect(withUserScope(callback as never)).resolves.toBe("done");
		expect(callback).toHaveBeenCalledWith({ connectionId: "conn-1" });
		expect(state.sqlEvents).toEqual(
			expect.arrayContaining([
				{ type: "ref", value: "byos_app", target: null },
				expect.objectContaining({
					type: "tag",
					value: "SET ROLE byos_app",
					target: { connectionId: "conn-1" },
				}),
				expect.objectContaining({
					type: "tag",
					value: "SELECT set_config('app.current_user_id', user-7, false)",
					target: { connectionId: "conn-1" },
				}),
				expect.objectContaining({
					type: "tag",
					value: "SELECT set_config('app.current_user_id', '', false)",
					target: { connectionId: "conn-1" },
				}),
				expect.objectContaining({
					type: "tag",
					value: "RESET ROLE",
					target: { connectionId: "conn-1" },
				}),
			]),
		);
	});

	it("runs transactions with transaction-local user scope", async () => {
		state.currentUserId.mockResolvedValue("user-9");
		state.connectionExecute.mockImplementation(async (runner) => {
			const trx = { kind: "trx" };
			const conn = {
				transaction: () => ({
					execute: (cb: (value: unknown) => Promise<unknown>) => cb(trx),
				}),
			};
			return runner(conn);
		});
		const callback = vi.fn().mockResolvedValue("committed");
		const { withUserScopeTransaction } = await loadScopedDb();

		await expect(withUserScopeTransaction(callback as never)).resolves.toBe(
			"committed",
		);
		expect(callback).toHaveBeenCalledWith({ kind: "trx" });
		expect(state.sqlEvents).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "tag",
					value: "SELECT set_config('app.current_user_id', user-9, true)",
					target: { kind: "trx" },
				}),
				expect.objectContaining({
					type: "tag",
					value: "RESET ROLE",
				}),
			]),
		);
	});

	it("supports explicit user scope without reading the session user", async () => {
		state.connectionExecute.mockImplementation(async (runner) => {
			const conn = { connectionId: "conn-explicit" };
			return runner(conn);
		});
		const callback = vi.fn().mockResolvedValue("explicit");
		const { withExplicitUserScope } = await loadScopedDb();

		await expect(
			withExplicitUserScope("device-user", callback as never),
		).resolves.toBe("explicit");
		expect(state.currentUserId).not.toHaveBeenCalled();
		expect(state.sqlEvents).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "tag",
					value: "SELECT set_config('app.current_user_id', device-user, false)",
					target: { connectionId: "conn-explicit" },
				}),
			]),
		);
	});
});
