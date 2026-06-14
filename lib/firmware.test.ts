import { afterEach, describe, expect, it, vi } from "vitest";

async function loadModule() {
	vi.resetModules();
	return import("./firmware");
}

describe("firmware", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("builds firmware CDN urls and compares versions", async () => {
		const { getFirmwareUrl, isUpdateAvailable } = await loadModule();

		expect(getFirmwareUrl("1.7.3")).toBe(
			"https://trmnl-fw.s3.us-east-2.amazonaws.com/FW1.7.3.bin",
		);
		expect(isUpdateAvailable("1.7.2", "1.7.3")).toBe(true);
		expect(isUpdateAvailable("1.7.3", "1.7.3")).toBe(false);
		expect(isUpdateAvailable(null, "1.7.3")).toBe(false);
	});

	it("fetches and caches the latest firmware release", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			Response.json({
				tag_name: "v1.8.0",
				published_at: "2026-05-01T12:00:00Z",
			}),
		);
		vi.spyOn(Date, "now").mockReturnValueOnce(1_000).mockReturnValueOnce(2_000);

		const { getLatestFirmware } = await loadModule();

		const first = await getLatestFirmware();
		const second = await getLatestFirmware();

		expect(first).toEqual({
			version: "1.8.0",
			tag: "v1.8.0",
			downloadUrl: "https://trmnl-fw.s3.us-east-2.amazonaws.com/FW1.8.0.bin",
			publishedAt: "2026-05-01T12:00:00Z",
		});
		expect(second).toEqual(first);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("returns the stale cached release when refresh fails", async () => {
		const errorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const fetchMock = vi.spyOn(globalThis, "fetch");
		fetchMock
			.mockResolvedValueOnce(
				Response.json({
					tag_name: "v1.8.0",
					published_at: "2026-05-01T12:00:00Z",
				}),
			)
			.mockRejectedValueOnce(new Error("network down"));
		vi.spyOn(Date, "now")
			.mockReturnValueOnce(1_000)
			.mockReturnValueOnce(1_000 + 6 * 60 * 60 * 1000 + 1);

		const { getLatestFirmware } = await loadModule();

		const fresh = await getLatestFirmware();
		const stale = await getLatestFirmware();

		expect(stale).toEqual(fresh);
		expect(errorSpy).toHaveBeenCalledWith(
			"Error fetching firmware release:",
			expect.any(Error),
		);
	});
});
