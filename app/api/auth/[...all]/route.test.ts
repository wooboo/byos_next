import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	toNextJsHandler: vi.fn(),
	getHandler: vi.fn(),
	postHandler: vi.fn(),
}));

vi.mock("better-auth/next-js", () => ({
	toNextJsHandler: state.toNextJsHandler,
}));

const loadRoute = async (authValue: unknown) => {
	vi.resetModules();
	state.toNextJsHandler.mockReset();
	state.getHandler.mockReset();
	state.postHandler.mockReset();
	state.toNextJsHandler.mockReturnValue({
		GET: state.getHandler,
		POST: state.postHandler,
	});
	vi.doMock("@/lib/auth/auth", () => ({
		auth: authValue,
	}));

	return import("./route");
};

describe("app/api/auth/[...all] route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("uses Better Auth handlers when auth is enabled", async () => {
		const auth = { api: "auth-instance" };
		const { GET, POST } = await loadRoute(auth);
		const request = new Request("https://example.test/api/auth/session");

		await GET(request);
		await POST(request);

		expect(state.toNextJsHandler).toHaveBeenCalledWith(auth);
		expect(state.getHandler).toHaveBeenCalledWith(request);
		expect(state.postHandler).toHaveBeenCalledWith(request);
	});

	it("returns not found responses when auth is disabled", async () => {
		const { GET, POST } = await loadRoute(null);
		const request = new Request("https://example.test/api/auth/session");

		const getResponse = await GET(request);
		const postResponse = await POST(request);

		await expect(getResponse.json()).resolves.toEqual({
			error: "Auth disabled",
		});
		await expect(postResponse.json()).resolves.toEqual({
			error: "Auth disabled",
		});
		expect(getResponse.status).toBe(404);
		expect(postResponse.status).toBe(404);
		expect(state.toNextJsHandler).not.toHaveBeenCalled();
	});
});
