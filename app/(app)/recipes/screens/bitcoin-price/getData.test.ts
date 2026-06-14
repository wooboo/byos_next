import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

describe("bitcoin-price/getData", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		global.fetch = originalFetch;
	});

	it("maps CoinGecko responses into public crypto data", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				createJsonResponse({
					market_data: {
						current_price: { usd: 102345.67 },
						price_change_percentage_24h: 3.456,
						market_cap: { usd: 2_100_000_000_000 },
						total_volume: { usd: 56_700_000_000 },
						high_24h: { usd: 103000.25 },
						low_24h: { usd: 100000.1 },
					},
					last_updated: "2026-01-02T10:30:00.000Z",
					name: "Bitcoin",
					image: { small: "https://example.com/btc.png" },
				}),
			)
			.mockResolvedValueOnce(
				createJsonResponse({
					prices: [
						[1735812000000, 100000],
						[1735815600000, 101000],
					],
				}),
			);
		global.fetch = fetchMock;

		const { default: getData } = await import("./getData");
		const data = await getData({ cryptoSymbol: "bitcoin" });

		expect(fetchMock).toHaveBeenCalledTimes(2);
		assert.match(fetchMock.mock.calls[0][0].toString(), /coins\/bitcoin\?/);
		assert.match(fetchMock.mock.calls[1][0].toString(), /market_chart/);
		assert.equal(data.price, "102,345.67");
		assert.equal(data.change24h, "3.46");
		assert.equal(data.marketCap, "2.10T");
		assert.equal(data.volume24h, "56.70B");
		assert.equal(data.high24h, "103,000.25");
		assert.equal(data.low24h, "100,000.1");
		assert.equal(data.cryptoName, "Bitcoin");
		assert.equal(data.cryptoImage, "https://example.com/btc.png");
		assert.deepEqual(data.historicalPrices, [
			{ timestamp: 1735812000000, price: 100000 },
			{ timestamp: 1735815600000, price: 101000 },
		]);
	});

	it("falls back to default values when current market data is invalid", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				createJsonResponse({
					name: "Ethereum",
					last_updated: "2026-01-02T10:30:00.000Z",
				}),
			)
			.mockResolvedValueOnce(createJsonResponse({ prices: [] }));
		global.fetch = fetchMock;

		const { default: getData } = await import("./getData");
		const data = await getData({ cryptoSymbol: "ethereum" });

		assert.equal(data.price, "N/A");
		assert.equal(data.change24h, "0.00");
		assert.equal(data.marketCap, "N/A");
		assert.equal(data.volume24h, "N/A");
		assert.equal(data.lastUpdated, "N/A");
		assert.equal(data.cryptoName, "ethereum");
		assert.deepEqual(data.historicalPrices, []);
	});

	it("uses bitcoin as the default symbol when params are omitted", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				createJsonResponse({
					market_data: {
						current_price: { usd: 1 },
						price_change_percentage_24h: 0,
						market_cap: { usd: 1 },
						total_volume: { usd: 1 },
						high_24h: { usd: 1 },
						low_24h: { usd: 1 },
					},
					last_updated: "2026-01-02T10:30:00.000Z",
					name: "Bitcoin",
				}),
			)
			.mockResolvedValueOnce(createJsonResponse({ prices: [] }));
		global.fetch = fetchMock;

		const { default: getData } = await import("./getData");
		await getData();

		assert.match(fetchMock.mock.calls[0][0].toString(), /coins\/bitcoin\?/);
		assert.match(fetchMock.mock.calls[1][0].toString(), /coins\/bitcoin\//);
	});
});
