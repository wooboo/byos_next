import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	registryResponse: vi.fn(),
}));

vi.mock("@/lib/trmnl/registry", () => ({
	registryResponse: state.registryResponse,
}));

describe("app/api/categories GET", () => {
	beforeEach(() => {
		vi.resetModules();
		state.registryResponse.mockReset();
	});

	it("delegates to the categories registry response", async () => {
		state.registryResponse.mockResolvedValue(
			Response.json({ data: [] }, { status: 200 }),
		);
		const { GET } = await import("./route");

		const response = await GET();

		expect(state.registryResponse).toHaveBeenCalledWith("categories");
		expect(response.status).toBe(200);
	});
});
