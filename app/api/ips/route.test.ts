import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	registryResponse: vi.fn(),
}));

vi.mock("@/lib/trmnl/registry", () => ({
	registryResponse: state.registryResponse,
}));

describe("app/api/ips GET", () => {
	beforeEach(() => {
		vi.resetModules();
		state.registryResponse.mockReset();
	});

	it("delegates to the ips registry response", async () => {
		state.registryResponse.mockResolvedValue(
			Response.json({ data: [] }, { status: 200 }),
		);
		const { GET } = await import("./route");

		const response = await GET();

		expect(state.registryResponse).toHaveBeenCalledWith("ips");
		expect(response.status).toBe(200);
	});
});
