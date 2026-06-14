import { afterEach, describe, expect, it, vi } from "vitest";

async function loadGetUser({
	authValue,
	headersValue = new Headers({ cookie: "session=1" }),
}: {
	authValue: unknown;
	headersValue?: Headers;
}) {
	vi.resetModules();
	vi.doMock("next/headers", () => ({
		headers: vi.fn().mockResolvedValue(headersValue),
	}));
	vi.doMock("./auth", () => ({
		auth: authValue,
	}));
	return import("./get-user");
}

describe("getCurrentUser", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.resetModules();
	});

	it("returns null when auth is disabled", async () => {
		const { BYOS_MONO_USER_ID, getCurrentUser, getCurrentUserId } =
			await loadGetUser({ authValue: null });

		await expect(getCurrentUser()).resolves.toBeNull();
		await expect(getCurrentUserId()).resolves.toBe(BYOS_MONO_USER_ID);
	});

	it("maps the authenticated session user", async () => {
		const getSession = vi.fn().mockResolvedValue({
			user: {
				id: "user-1",
				name: "Ada",
				email: "ada@example.com",
				role: "admin",
			},
		});
		const { getCurrentUser, getCurrentUserId } = await loadGetUser({
			authValue: { api: { getSession } },
		});

		await expect(getCurrentUser()).resolves.toEqual({
			id: "user-1",
			name: "Ada",
			email: "ada@example.com",
			role: "admin",
		});
		await expect(getCurrentUserId()).resolves.toBe("user-1");
		expect(getSession).toHaveBeenCalledWith({
			headers: expect.any(Headers),
		});
	});

	it("returns null when the session has no user", async () => {
		const { getCurrentUser, getCurrentUserId } = await loadGetUser({
			authValue: {
				api: {
					getSession: vi.fn().mockResolvedValue(null),
				},
			},
		});

		await expect(getCurrentUser()).resolves.toBeNull();
		await expect(getCurrentUserId()).resolves.toBeNull();
	});
});
