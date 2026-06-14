import { afterEach, describe, expect, it, vi } from "vitest";

async function loadModule() {
	vi.resetModules();

	const page = {
		emulateMediaFeatures: vi.fn(),
		setViewport: vi.fn(),
		goto: vi.fn(),
		screenshot: vi.fn().mockResolvedValue(Buffer.from("browser-shot")),
		close: vi.fn(),
	};
	const browser = {
		newPage: vi.fn().mockResolvedValue(page),
		setCookie: vi.fn(),
	};
	const getBrowserMock = vi.fn().mockResolvedValue(browser);

	vi.doMock("@/lib/recipes/chrome-pool", () => ({
		getBrowser: getBrowserMock,
	}));

	const mod = await import("./browser");
	return { ...mod, browser, page, getBrowserMock };
}

describe("renderWithBrowser", () => {
	afterEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
		vi.doUnmock("@/lib/recipes/chrome-pool");
		delete process.env.PORT;
		delete process.env.NEXT_PUBLIC_BASE_URL;
	});

	it("captures a trusted preview screenshot with light mode and forwarded cookies", async () => {
		process.env.NEXT_PUBLIC_BASE_URL = "https://preview.example";
		const { renderWithBrowser, browser, page, getBrowserMock } =
			await loadModule();

		const result = await renderWithBrowser(
			"calendar",
			800,
			480,
			2,
			"foo=bar; session = abc=123 ; invalid",
		);

		expect(getBrowserMock).toHaveBeenCalledWith("trusted");
		expect(browser.setCookie).toHaveBeenCalledWith(
			{ name: "foo", value: "bar", domain: "preview.example", path: "/" },
			{
				name: "session",
				value: "abc=123",
				domain: "preview.example",
				path: "/",
			},
		);
		expect(page.emulateMediaFeatures).toHaveBeenCalledWith([
			{ name: "prefers-color-scheme", value: "light" },
		]);
		expect(page.setViewport).toHaveBeenCalledWith({
			width: 1600,
			height: 960,
			deviceScaleFactor: 1,
		});
		expect(page.goto).toHaveBeenCalledWith(
			"https://preview.example/recipes/calendar/preview?width=800&height=480",
			{ waitUntil: "networkidle0" },
		);
		expect(page.close).toHaveBeenCalledTimes(1);
		expect(result).toEqual(Buffer.from("browser-shot"));
	});

	it("falls back to the default local preview URL when NEXT_PUBLIC_BASE_URL is absent", async () => {
		process.env.PORT = "4321";
		const { renderWithBrowser, page } = await loadModule();

		await renderWithBrowser("clock", 400, 300);

		expect(page.goto).toHaveBeenCalledWith(
			"http://127.0.0.1:4321/recipes/clock/preview?width=400&height=300",
			{ waitUntil: "networkidle0" },
		);
	});
});
