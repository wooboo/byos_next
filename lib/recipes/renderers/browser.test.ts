import { afterEach, describe, expect, it, vi } from "vitest";

async function loadModule() {
	vi.resetModules();

	const page = {
		emulateMediaFeatures: vi.fn(),
		setViewport: vi.fn(),
		setCookie: vi.fn(),
		goto: vi.fn(),
		screenshot: vi.fn().mockResolvedValue(Buffer.from("browser-shot")),
		close: vi.fn(),
	};
	const browser = {
		newPage: vi.fn().mockResolvedValue(page),
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
		delete process.env.BROWSER_RENDER_BASE_URL;
		delete process.env.PORT;
		delete process.env.NEXT_PUBLIC_BASE_URL;
	});

	it("captures a trusted preview screenshot with light mode and forwarded cookies", async () => {
		process.env.NEXT_PUBLIC_BASE_URL = "https://preview.example";
		const { renderWithBrowser, page, getBrowserMock } = await loadModule();

		const result = await renderWithBrowser(
			"calendar",
			800,
			480,
			"foo=bar; session = abc=123 ; invalid",
		);

		expect(getBrowserMock).toHaveBeenCalledWith("trusted");
		expect(page.setCookie).toHaveBeenCalledWith(
			{ name: "foo", value: "bar", url: "https://preview.example" },
			{
				name: "session",
				value: "abc=123",
				url: "https://preview.example",
			},
		);
		expect(page.emulateMediaFeatures).toHaveBeenCalledWith([
			{ name: "prefers-color-scheme", value: "light" },
		]);
		expect(page.setViewport).toHaveBeenCalledWith({
			width: 800,
			height: 480,
			deviceScaleFactor: 1,
		});
		expect(page.goto).toHaveBeenCalledWith(
			"https://preview.example/preview/recipe/calendar?width=800&height=480",
			{ waitUntil: "networkidle0" },
		);
		expect(page.close).toHaveBeenCalledTimes(1);
		expect(result).toEqual(Buffer.from("browser-shot"));
	});

	it("keeps rendering when Chrome rejects forwarded proxy cookies", async () => {
		process.env.NEXT_PUBLIC_BASE_URL = "http://internal:3000";
		const { renderWithBrowser, page } = await loadModule();
		page.setCookie
			.mockRejectedValueOnce(new Error("Protocol error: Invalid cookie fields"))
			.mockResolvedValue(undefined);

		const result = await renderWithBrowser(
			"immich-favorites",
			800,
			480,
			"__Secure-auth=value; valid=ok; invalid name=bad",
		);

		expect(page.setCookie).toHaveBeenCalledTimes(2);
		expect(page.setCookie).toHaveBeenLastCalledWith({
			name: "valid",
			value: "ok",
			url: "http://internal:3000",
		});
		expect(page.goto).toHaveBeenCalledWith(
			"http://internal:3000/preview/recipe/immich-favorites?width=800&height=480",
			{ waitUntil: "networkidle0" },
		);
		expect(result).toEqual(Buffer.from("browser-shot"));
	});

	it("keeps secure localhost session cookies for authenticated local previews", async () => {
		const { renderWithBrowser, page } = await loadModule();

		await renderWithBrowser(
			"immich-favorites",
			800,
			480,
			"__Secure-better-auth.session_token=secure-token; __Host-auth=host-token",
			undefined,
			"http://localhost:3001",
		);

		expect(page.setCookie).toHaveBeenCalledWith(
			{
				name: "__Secure-better-auth.session_token",
				value: "secure-token",
				url: "http://localhost:3001",
				secure: true,
			},
			{
				name: "__Host-auth",
				value: "host-token",
				url: "http://localhost:3001",
				secure: true,
				path: "/",
			},
		);
		expect(page.goto).toHaveBeenCalledWith(
			"http://localhost:3001/preview/recipe/immich-favorites?width=800&height=480",
			{ waitUntil: "networkidle0" },
		);
	});

	it("keeps secure loopback session cookies for authenticated internal previews", async () => {
		const { renderWithBrowser, page } = await loadModule();

		await renderWithBrowser(
			"immich-favorites",
			800,
			480,
			"__Secure-better-auth.session_token=secure-token; __Host-auth=host-token",
			undefined,
			"http://127.0.0.1:3000",
		);

		expect(page.setCookie).toHaveBeenCalledWith(
			{
				name: "__Secure-better-auth.session_token",
				value: "secure-token",
				url: "http://127.0.0.1:3000",
				secure: true,
			},
			{
				name: "__Host-auth",
				value: "host-token",
				url: "http://127.0.0.1:3000",
				secure: true,
				path: "/",
			},
		);
		expect(page.goto).toHaveBeenCalledWith(
			"http://127.0.0.1:3000/preview/recipe/immich-favorites?width=800&height=480",
			{ waitUntil: "networkidle0" },
		);
	});

	it("falls back to the default local preview URL when NEXT_PUBLIC_BASE_URL is absent", async () => {
		process.env.PORT = "4321";
		const { renderWithBrowser, page } = await loadModule();

		await renderWithBrowser("clock", 400, 300);

		expect(page.goto).toHaveBeenCalledWith(
			"http://127.0.0.1:4321/preview/recipe/clock?width=400&height=300",
			{ waitUntil: "networkidle0" },
		);
	});

	it("prefers an internal browser render base URL over public request origins", async () => {
		process.env.BROWSER_RENDER_BASE_URL = "http://127.0.0.1:3000";
		const { renderWithBrowser, page } = await loadModule();

		await renderWithBrowser(
			"clock",
			400,
			300,
			undefined,
			undefined,
			"https://byos.core.zabowka.pl",
		);

		expect(page.goto).toHaveBeenCalledWith(
			"http://127.0.0.1:3000/preview/recipe/clock?width=400&height=300",
			{ waitUntil: "networkidle0" },
		);
	});

	it("captures an explicit preview path when provided", async () => {
		process.env.PORT = "4321";
		const { renderWithBrowser, page } = await loadModule();

		await renderWithBrowser(
			"school-schedule",
			800,
			480,
			undefined,
			"/preview/screen/screen-1",
		);

		expect(page.goto).toHaveBeenCalledWith(
			"http://127.0.0.1:4321/preview/screen/screen-1?width=800&height=480",
			{ waitUntil: "networkidle0" },
		);
	});
});
