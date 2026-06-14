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

describe("weather/getData", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		global.fetch = originalFetch;
	});

	it("geocodes the location and maps the weather response", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				createJsonResponse({
					results: [
						{
							name: "Warsaw",
							country: "Poland",
							latitude: 52.23,
							longitude: 21.01,
						},
					],
				}),
			)
			.mockResolvedValueOnce(
				createJsonResponse({
					results: [
						{
							name: "Warsaw",
							country: "Poland",
							latitude: 52.23,
							longitude: 21.01,
						},
					],
				}),
			)
			.mockResolvedValueOnce(
				createJsonResponse({
					current: {
						time: "2026-01-02T10:15:00Z",
						temperature_2m: 21.2,
						apparent_temperature: 19.9,
						relative_humidity_2m: 60.4,
						wind_speed_10m: 12.2,
						surface_pressure: 1011.6,
						weather_code: 3,
					},
					daily: {
						time: ["2026-01-02"],
						temperature_2m_max: [24.4],
						temperature_2m_min: [16.2],
						sunset: ["2026-01-02T15:30:00Z"],
						sunrise: ["2026-01-02T07:45:00Z"],
					},
				}),
			);
		global.fetch = fetchMock;

		const { default: getData } = await import("./getData");
		const data = await getData({ location: "Warsaw" });

		expect(fetchMock).toHaveBeenCalledTimes(3);
		assert.match(fetchMock.mock.calls[0][0].toString(), /search\?name=Warsaw/);
		assert.match(fetchMock.mock.calls[2][0].toString(), /latitude=52\.23/);
		assert.equal(data.location, "Warsaw, Poland");
		assert.equal(data.temperature, "21");
		assert.equal(data.feelsLike, "20");
		assert.equal(data.humidity, "60");
		assert.equal(data.windSpeed, "12");
		assert.equal(data.pressure, "1012");
		assert.equal(data.description, "Overcast");
		assert.equal(data.highTemp, "24");
		assert.equal(data.lowTemp, "16");
		assert.equal(data.latitude, 52.23);
		assert.equal(data.longitude, 21.01);
	});

	it("falls back to placeholder values when weather fetch fails", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				createJsonResponse({
					results: [
						{
							name: "Warsaw",
							country: "Poland",
							latitude: 52.23,
							longitude: 21.01,
						},
					],
				}),
			)
			.mockResolvedValueOnce(
				createJsonResponse({
					results: [
						{
							name: "Warsaw",
							country: "Poland",
							latitude: 52.23,
							longitude: 21.01,
						},
					],
				}),
			)
			.mockResolvedValueOnce(new Response("boom", { status: 500 }))
			.mockResolvedValueOnce(
				createJsonResponse({
					results: [
						{
							name: "Warsaw",
							country: "Poland",
							latitude: 52.23,
							longitude: 21.01,
						},
					],
				}),
			)
			.mockResolvedValueOnce(new Response("boom", { status: 500 }));
		global.fetch = fetchMock;

		const { default: getData } = await import("./getData");
		const data = await getData({ location: "Warsaw" });

		assert.equal(data.temperature, "N/A");
		assert.equal(data.description, "N/A");
		assert.equal(data.location, "N/A");
		assert.equal(data.latitude, 52.23);
		assert.equal(data.longitude, 21.01);
	});

	it("maps unknown weather codes after the internal geocoding step", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				createJsonResponse({
					results: [
						{
							name: "San Francisco",
							country: "United States",
							latitude: 37.77,
							longitude: -122.42,
						},
					],
				}),
			)
			.mockResolvedValueOnce(
				createJsonResponse({
					current: {
						time: "2026-01-02T10:15:00Z",
						temperature_2m: 7.8,
						apparent_temperature: 3.2,
						relative_humidity_2m: 81.1,
						wind_speed_10m: 22.9,
						surface_pressure: 1001.2,
						weather_code: 999,
					},
					daily: {
						time: ["2026-01-02"],
						temperature_2m_max: [9.4],
						temperature_2m_min: [2.1],
						sunset: ["2026-01-02T16:30:00Z"],
						sunrise: ["2026-01-02T07:15:00Z"],
					},
				}),
			);
		global.fetch = fetchMock;

		const { default: getData } = await import("./getData");
		const data = await getData({ latitude: 40.71, longitude: -74.01 });

		expect(fetchMock).toHaveBeenCalledTimes(2);
		assert.match(
			fetchMock.mock.calls[0][0].toString(),
			/search\?name=San%20Francisco/,
		);
		assert.match(fetchMock.mock.calls[1][0].toString(), /latitude=37\.77/);
		assert.equal(data.description, "Unknown");
		assert.equal(data.location, "San Francisco");
		assert.equal(data.latitude, 37.77);
		assert.equal(data.longitude, -122.42);
	});

	it("returns placeholders when the weather payload has no current block", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				createJsonResponse({
					results: [
						{
							name: "San Francisco",
							country: "United States",
							latitude: 37.77,
							longitude: -122.42,
						},
					],
				}),
			)
			.mockResolvedValueOnce(
				createJsonResponse({
					daily: {
						time: ["2026-01-02"],
						temperature_2m_max: [9.4],
						temperature_2m_min: [2.1],
						sunset: ["2026-01-02T16:30:00Z"],
						sunrise: ["2026-01-02T07:15:00Z"],
					},
				}),
			)
			.mockResolvedValueOnce(
				createJsonResponse({
					results: [
						{
							name: "San Francisco",
							country: "United States",
							latitude: 37.77,
							longitude: -122.42,
						},
					],
				}),
			)
			.mockResolvedValueOnce(
				createJsonResponse({
					daily: {
						time: ["2026-01-02"],
						temperature_2m_max: [9.4],
						temperature_2m_min: [2.1],
						sunset: ["2026-01-02T16:30:00Z"],
						sunrise: ["2026-01-02T07:15:00Z"],
					},
				}),
			);
		global.fetch = fetchMock;

		const { default: getData } = await import("./getData");
		const data = await getData({ latitude: 1.23, longitude: 4.56 });

		expect(fetchMock).toHaveBeenCalledTimes(4);
		assert.equal(data.temperature, "N/A");
		assert.equal(data.description, "N/A");
		assert.equal(data.location, "N/A");
		assert.equal(data.latitude, 1.23);
		assert.equal(data.longitude, 4.56);
	});

	it("recovers after an initial geocoding api error and uses the later coordinates", async () => {
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(new Response("boom", { status: 500 }))
			.mockResolvedValueOnce(
				createJsonResponse({
					results: [
						{
							name: "Paris",
							country: "France",
							latitude: 48.86,
							longitude: 2.35,
						},
					],
				}),
			)
			.mockResolvedValueOnce(
				createJsonResponse({
					current: {
						time: "2026-01-02T10:15:00Z",
						temperature_2m: 12.4,
						apparent_temperature: 10.1,
						relative_humidity_2m: 72.2,
						wind_speed_10m: 9.2,
						surface_pressure: 1016.1,
						weather_code: 1,
					},
					daily: {
						time: ["2026-01-02"],
						temperature_2m_max: [14.4],
						temperature_2m_min: [8.2],
						sunset: ["2026-01-02T16:30:00Z"],
						sunrise: ["2026-01-02T07:15:00Z"],
					},
				}),
			);
		global.fetch = fetchMock;

		const { default: getData } = await import("./getData");
		const data = await getData({ location: "Paris" });

		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(consoleError).toHaveBeenCalledWith(
			"Error geocoding location:",
			expect.any(Error),
		);
		assert.equal(data.location, "Paris");
		assert.equal(data.latitude, 48.86);
		assert.equal(data.longitude, 2.35);
		assert.equal(data.description, "Mainly clear");
	});
});
