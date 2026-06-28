jest.mock("node:fs/promises", () => {
	const actual = jest.requireActual("node:fs/promises");
	return {
		...actual,
		mkdir: jest.fn(async () => undefined),
		writeFile: jest.fn(async () => undefined),
	};
});

describe("TRMNL registry overlays", () => {
	const originalFetch = global.fetch;

	afterEach(() => {
		global.fetch = originalFetch;
		jest.resetModules();
	});

	it("preserves local model overlays when live upstream data is available", async () => {
		global.fetch = jest.fn(async () =>
			Response.json({
				data: [
					{
						name: "upstream_model",
						label: "Upstream Model",
						width: 800,
						height: 480,
						colors: 2,
						bit_depth: 1,
						scale_factor: 1,
						rotation: 0,
						mime_type: "image/png",
						offset_x: 0,
						offset_y: 0,
						palette_ids: ["bw"],
					},
				],
			}),
		) as jest.Mock;

		const { listModels } = require("./registry") as typeof import("./registry");
		const models = await listModels();

		expect(models.some((model) => model.name === "upstream_model")).toBe(true);
		expect(models.some((model) => model.name === "m5stack_papercolor")).toBe(
			true,
		);
	});

	it("preserves local palette overlays when live upstream data is available", async () => {
		global.fetch = jest.fn(async () =>
			Response.json({
				data: [
					{
						id: "bw",
						name: "Black and white",
						grays: 2,
					},
				],
			}),
		) as jest.Mock;

		const { listPalettes } =
			require("./registry") as typeof import("./registry");
		const palettes = await listPalettes();

		expect(palettes.some((palette) => palette.id === "bw")).toBe(true);
		expect(
			palettes.some((palette) => palette.id === "m5papercolor-ed2208-m5gfx-v1"),
		).toBe(true);
	});
});
