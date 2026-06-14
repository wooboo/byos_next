import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	registryResponse: vi.fn(),
}));

vi.mock("@/lib/trmnl/registry", () => ({
	registryResponse: state.registryResponse,
}));

const loadModelsRoute = () => import("./route");
const loadPalettesRoute = () => import("../palettes/route");
const loadCategoriesRoute = () => import("../categories/route");
const loadIpsRoute = () => import("../ips/route");

describe("registry-backed API routes", () => {
	beforeEach(() => {
		vi.resetModules();
		state.registryResponse.mockReset();
		state.registryResponse.mockResolvedValue(
			new Response(null, { status: 200 }),
		);
	});

	it("delegates /api/models to the models registry", async () => {
		const { GET } = await loadModelsRoute();

		await GET();

		expect(state.registryResponse).toHaveBeenCalledWith("models");
	});

	it("delegates /api/palettes to the palettes registry", async () => {
		const { GET } = await loadPalettesRoute();

		await GET();

		expect(state.registryResponse).toHaveBeenCalledWith("palettes");
	});

	it("delegates /api/categories to the categories registry", async () => {
		const { GET } = await loadCategoriesRoute();

		await GET();

		expect(state.registryResponse).toHaveBeenCalledWith("categories");
	});

	it("delegates /api/ips to the ips registry", async () => {
		const { GET } = await loadIpsRoute();

		await GET();

		expect(state.registryResponse).toHaveBeenCalledWith("ips");
	});
});
