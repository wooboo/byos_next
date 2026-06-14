import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

vi.mock("next/cache", () => ({
	unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

const originalFetch = global.fetch;

function createJsonResponse(body: unknown, init?: ResponseInit) {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { "Content-Type": "application/json" },
		...init,
	});
}

describe("wikipedia/getData", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
		global.wikipediaReservoir = undefined;
	});

	afterEach(() => {
		global.fetch = originalFetch;
		vi.unstubAllEnvs();
		global.wikipediaReservoir = undefined;
	});

	it("maps a suitable random article from the MediaWiki api", async () => {
		vi.stubEnv("NODE_ENV", "test");
		const extract =
			"Electronic paper displays reflect ambient light and remain readable in bright rooms. ".repeat(
				5,
			);
		global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
			createJsonResponse({
				query: {
					pages: {
						"10": {
							pageid: 10,
							title: "Electronic paper",
							extract,
							fullurl: "https://en.wikipedia.org/wiki/Electronic_paper",
							displaytitle: "Electronic paper",
							categories: [{ title: "Category:Display technology" }],
						},
					},
				},
			}),
		);

		const { default: getData } = await import("./getData");
		const data = await getData();

		assert.equal(data.title, "Electronic paper");
		assert.equal(data.extract, extract);
		assert.equal(
			data.content_urls?.desktop.page,
			"https://en.wikipedia.org/wiki/Electronic_paper",
		);
		assert.deepEqual(data.categories, ["Display technology"]);
	});

	it("returns the built-in fallback article when fetching fails", async () => {
		vi.stubEnv("NODE_ENV", "test");
		global.fetch = vi
			.fn<typeof fetch>()
			.mockRejectedValue(new TypeError("fetch failed"));

		const { default: getData } = await import("./getData");
		const data = await getData();

		assert.equal(data.title, "Electronic Paper Display");
		assert.match(data.extract, /Electronic paper/);
		assert.equal(
			data.content_urls?.desktop.page,
			"https://en.wikipedia.org/wiki/Electronic_paper",
		);
	});

	it("sanitizes rtl markers and fills content_urls from fullurl on selected articles", async () => {
		vi.stubEnv("NODE_ENV", "test");
		global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
			createJsonResponse({
				query: {
					pages: {
						"10": {
							pageid: 10,
							title: "Arabic\u200F display",
							extract:
								"Arabic\u200F display technology keeps content visible in bright light and is widely used on low-power devices. ".repeat(
									3,
								),
							fullurl: "https://en.wikipedia.org/wiki/Arabic_display",
							pagelanguage: "en",
							pagelanguagedir: "ltr",
						},
					},
				},
			}),
		);

		const { default: getData } = await import("./getData");
		const data = await getData();

		assert.equal(data.title, "Arabic display");
		assert.ok(!data.extract.includes("\u200F"));
		assert.equal(
			data.content_urls?.desktop.page,
			"https://en.wikipedia.org/wiki/Arabic_display",
		);
	});

	it("uses the reservoir article immediately when cached refresh times out", async () => {
		vi.stubEnv("NODE_ENV", "test");
		vi.useFakeTimers();
		global.wikipediaReservoir = {
			articles: [
				{
					title: "Reservoir Article",
					extract:
						"Reservoir content is already cached locally and can be served while a refresh is still pending. ".repeat(
							3,
						),
					content_urls: {
						desktop: {
							page: "https://en.wikipedia.org/wiki/Reservoir_Article",
						},
					},
				},
			],
			lastUpdated: Date.now(),
			lastApiSuccess: true,
			consecutiveFailures: 0,
		};
		global.fetch = vi
			.fn<typeof fetch>()
			.mockImplementation(() => new Promise<Response>(() => undefined));

		const { default: getData } = await import("./getData");
		const dataPromise = getData();
		await vi.advanceTimersByTimeAsync(4000);
		const data = await dataPromise;

		assert.equal(data.title, "Reservoir Article");
		assert.equal(
			data.content_urls?.desktop.page,
			"https://en.wikipedia.org/wiki/Reservoir_Article",
		);
	});

	it("falls back to a direct summary article when both random batches are unsuitable", async () => {
		vi.stubEnv("NODE_ENV", "test");
		const unsuitableBatch = createJsonResponse({
			query: {
				pages: {
					"10": {
						pageid: 10,
						title: "Some person",
						extract:
							"Some person is a researcher by training and writer by profession. ".repeat(
								4,
							),
						fullurl: "https://en.wikipedia.org/wiki/Some_person",
					},
				},
			},
		});
		global.fetch = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(unsuitableBatch)
			.mockResolvedValueOnce(unsuitableBatch)
			.mockResolvedValueOnce(
				createJsonResponse({
					title: "Fallback Topic",
					extract:
						"Fallback Topic may refer to multiple different concepts in several domains.",
					type: "disambiguation",
				}),
			)
			.mockResolvedValueOnce(
				createJsonResponse({
					title: "Electronic Paper",
					extract:
						"Electronic paper uses microcapsules and reflected light to mimic the appearance of ink on paper. ".repeat(
							3,
						),
					content_urls: {
						desktop: {
							page: "https://en.wikipedia.org/wiki/Electronic_paper",
						},
					},
					description: "Display technology",
					type: "standard",
					pageid: 42,
				}),
			);

		const { default: getData } = await import("./getData");
		const data = await getData();

		assert.equal(data.title, "Electronic Paper");
		assert.equal(data.type, "standard");
		assert.equal(
			data.content_urls?.desktop.page,
			"https://en.wikipedia.org/wiki/Electronic_paper",
		);
	});

	it("uses the forced reservoir cache in production when enabled", async () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("FORCE_WIKIPEDIA_RESERVOIR", "true");
		vi.useFakeTimers();
		global.wikipediaReservoir = {
			articles: [
				{
					title: "Forced Reservoir Article",
					extract:
						"Forced reservoir content is available even when production would normally disable the in-memory cache. ".repeat(
							3,
						),
					content_urls: {
						desktop: {
							page: "https://en.wikipedia.org/wiki/Forced_Reservoir_Article",
						},
					},
				},
			],
			lastUpdated: Date.now(),
			lastApiSuccess: true,
			consecutiveFailures: 3,
		};
		global.fetch = vi
			.fn<typeof fetch>()
			.mockImplementation(() => new Promise<Response>(() => undefined));

		const { default: getData } = await import("./getData");
		const dataPromise = getData();
		await vi.advanceTimersByTimeAsync(4000);
		const data = await dataPromise;

		assert.equal(data.title, "Forced Reservoir Article");
		assert.equal(
			data.content_urls?.desktop.page,
			"https://en.wikipedia.org/wiki/Forced_Reservoir_Article",
		);
	});

	it("adds the bearer token header when wikipedia auth is configured", async () => {
		vi.stubEnv("NODE_ENV", "test");
		vi.stubEnv("WIKIPEDIA_ACCESS_TOKEN", "secret-token");
		global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
			createJsonResponse({
				query: {
					pages: {
						"10": {
							pageid: 10,
							title: "Token article",
							extract:
								"Token article content stays descriptive, technical, and long enough to satisfy the suitability filters reliably. ".repeat(
									3,
								),
							fullurl: "https://en.wikipedia.org/wiki/Token_article",
						},
					},
				},
			}),
		);

		const { default: getData } = await import("./getData");
		const data = await getData();
		const headers = vi.mocked(global.fetch).mock.calls[0]?.[1]
			?.headers as Headers;

		assert.equal(headers.get("Authorization"), "Bearer secret-token");
		assert.equal(data.title, "Token article");
		assert.equal(
			data.content_urls?.desktop.page,
			"https://en.wikipedia.org/wiki/Token_article",
		);
	});

	it("returns the hardcoded fallback when both summary fallbacks are disambiguation pages", async () => {
		vi.stubEnv("NODE_ENV", "test");
		const unsuitableBatch = createJsonResponse({
			query: {
				pages: {
					"10": {
						pageid: 10,
						title: "Some person",
						extract:
							"Some person is a researcher by training and writer by profession. ".repeat(
								4,
							),
						fullurl: "https://en.wikipedia.org/wiki/Some_person",
					},
				},
			},
		});
		global.fetch = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(unsuitableBatch)
			.mockResolvedValueOnce(unsuitableBatch)
			.mockResolvedValueOnce(
				createJsonResponse({
					title: "Fallback Topic",
					extract:
						"Fallback Topic may refer to multiple different concepts in several domains.",
					type: "disambiguation",
				}),
			)
			.mockResolvedValueOnce(
				createJsonResponse({
					title: "Electronic Paper",
					extract: "Electronic Paper may refer to several unrelated topics.",
					type: "disambiguation",
				}),
			);

		const { default: getData } = await import("./getData");
		const data = await getData();

		assert.equal(data.title, "Electronic Paper Display");
		assert.match(data.extract, /Electronic paper/);
		assert.equal(
			data.content_urls?.desktop.page,
			"https://en.wikipedia.org/wiki/Electronic_paper",
		);
	});

	it("falls back to a direct uncached fetch after the cache attempt times out", async () => {
		vi.stubEnv("NODE_ENV", "test");
		vi.useFakeTimers();
		global.fetch = vi
			.fn<typeof fetch>()
			.mockImplementationOnce(() => new Promise<Response>(() => undefined))
			.mockResolvedValueOnce(
				createJsonResponse({
					query: {
						pages: {
							"12": {
								pageid: 12,
								title: "Direct fallback article",
								extract:
									"Direct fallback article content is descriptive, technical, and long enough to satisfy the suitability heuristics. ".repeat(
										3,
									),
								fullurl:
									"https://en.wikipedia.org/wiki/Direct_fallback_article",
							},
						},
					},
				}),
			);

		const { default: getData } = await import("./getData");
		const dataPromise = getData();
		await vi.advanceTimersByTimeAsync(4000);
		const data = await dataPromise;

		assert.equal(data.title, "Direct fallback article");
		assert.equal(
			data.content_urls?.desktop.page,
			"https://en.wikipedia.org/wiki/Direct_fallback_article",
		);
	});
});
