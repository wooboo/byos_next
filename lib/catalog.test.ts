import { afterEach, describe, expect, it, vi } from "vitest";

describe("catalog", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		delete process.env.ENABLE_EXTERNAL_CATALOG;
	});

	it("returns an empty result while the external catalog is disabled", async () => {
		const { fetchCatalogResult, fetchTrmnlRecipesPage } = await import(
			"./catalog"
		);

		await expect(fetchCatalogResult()).resolves.toEqual({
			entries: [],
			error: "External catalog is disabled.",
		});
		await expect(fetchTrmnlRecipesPage(3)).resolves.toEqual({
			recipes: [],
			currentPage: 3,
			nextPage: null,
			total: null,
			error: "External catalog is disabled.",
		});
	});

	it("parses the community catalog YAML when enabled", async () => {
		process.env.ENABLE_EXTERNAL_CATALOG = "true";
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				[
					"clock:",
					"  name: Clock",
					"  trmnlp:",
					"    id: 1",
					"    repo: acme/clock",
					"    zip_url: null",
					"    zip_entry_path: null",
					"    version: 1.0.0",
					"  logo_url: null",
					"  screenshot_url: null",
					"  license: MIT",
					"  byos: {}",
					"  author:",
					"    github: acme",
					"  funding: {}",
					"  author_bio:",
					"    description: Simple clock",
				].join("\n"),
			),
		);

		const { fetchCatalogResult } = await import("./catalog");

		await expect(fetchCatalogResult()).resolves.toEqual({
			entries: [
				expect.objectContaining({
					name: "Clock",
					license: "MIT",
					author: { github: "acme" },
				}),
			],
			error: null,
		});
	});

	it("deduplicates official TRMNL recipes by id and reports pagination", async () => {
		process.env.ENABLE_EXTERNAL_CATALOG = "true";
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			Response.json({
				data: [
					{
						id: 7,
						name: "Weather",
						published_at: "2026-01-01T00:00:00Z",
						icon_url: null,
						screenshot_url: null,
						author_bio: null,
						stats: { installs: 12, forks: 3 },
					},
					{
						id: 7,
						name: "Weather duplicate",
						published_at: "2026-01-01T00:00:00Z",
						icon_url: null,
						screenshot_url: null,
						author_bio: null,
						stats: { installs: 99, forks: 1 },
					},
				],
				total: 24,
				per_page: 10,
				current_page: 2,
				next_page_url: "https://trmnl.com/recipes.json?page=3",
			}),
		);

		const { fetchTrmnlRecipesPage } = await import("./catalog");
		const result = await fetchTrmnlRecipesPage(2.8);

		expect(result).toEqual({
			recipes: [
				expect.objectContaining({
					id: 7,
					name: "Weather",
				}),
			],
			currentPage: 2,
			nextPage: 3,
			total: 24,
			error: null,
		});
	});

	it("maps fetch failures to user-facing catalog errors", async () => {
		process.env.ENABLE_EXTERNAL_CATALOG = "true";
		vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetch failed"));

		const { fetchCatalogResult, fetchTrmnlRecipesPage } = await import(
			"./catalog"
		);

		await expect(fetchCatalogResult()).resolves.toEqual({
			entries: [],
			error: "Community catalog is unavailable right now.",
		});
		await expect(fetchTrmnlRecipesPage()).resolves.toEqual({
			recipes: [],
			currentPage: 1,
			nextPage: null,
			total: null,
			error: "TRMNL recipes is unavailable right now.",
		});
	});
});
