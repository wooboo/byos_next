import { afterEach, describe, expect, it, vi } from "vitest";

type BrowserDouble = {
	connected: boolean;
	close: ReturnType<typeof vi.fn>;
	disconnect: ReturnType<typeof vi.fn>;
	on: ReturnType<typeof vi.fn>;
	emit: (event: string) => void;
};

function createBrowserDouble(): BrowserDouble {
	const listeners = new Map<string, () => void>();
	return {
		connected: true,
		close: vi.fn(),
		disconnect: vi.fn(),
		on: vi.fn((event: string, handler: () => void) => {
			listeners.set(event, handler);
		}),
		emit: (event: string) => {
			listeners.get(event)?.();
		},
	};
}

async function loadModule(options?: {
	browserUrl?: string;
	wsEndpoint?: string;
	explicitPath?: string;
	executablePathThrows?: boolean;
}) {
	vi.resetModules();
	const processHandlers = new Map<string, (...args: unknown[]) => unknown>();
	vi.spyOn(process, "once").mockImplementation((event, listener) => {
		processHandlers.set(
			String(event),
			listener as (...args: unknown[]) => unknown,
		);
		return process;
	});

	if (options?.browserUrl) {
		process.env.BROWSER_URL = options.browserUrl;
	} else {
		delete process.env.BROWSER_URL;
	}
	if (options?.wsEndpoint) {
		process.env.BROWSER_WS_ENDPOINT = options.wsEndpoint;
	} else {
		delete process.env.BROWSER_WS_ENDPOINT;
	}
	if (options?.explicitPath) {
		process.env.CHROME_EXECUTABLE_PATH = options.explicitPath;
	} else {
		delete process.env.CHROME_EXECUTABLE_PATH;
	}

	const browser = createBrowserDouble();
	const connectMock = vi.fn().mockResolvedValue(browser);
	const launchMock = vi.fn().mockResolvedValue(browser);
	const executablePathMock = options?.executablePathThrows
		? vi.fn(() => {
				throw new Error("missing chrome");
			})
		: vi.fn(() => "/mock/chrome");
	const chromiumExecutablePathMock = vi
		.fn()
		.mockResolvedValue("/fallback/chromium");

	vi.doMock("puppeteer-core", () => ({
		default: {
			connect: connectMock,
			launch: launchMock,
			executablePath: executablePathMock,
		},
	}));
	vi.doMock("@sparticuz/chromium-min", () => ({
		default: {
			executablePath: chromiumExecutablePathMock,
		},
	}));

	const mod = await import("./chrome-pool");
	return {
		...mod,
		browser,
		connectMock,
		launchMock,
		executablePathMock,
		chromiumExecutablePathMock,
		processHandlers,
	};
}

describe("getBrowser", () => {
	afterEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
		vi.doUnmock("puppeteer-core");
		vi.doUnmock("@sparticuz/chromium-min");
		delete process.env.BROWSER_URL;
		delete process.env.BROWSER_WS_ENDPOINT;
		delete process.env.CHROME_EXECUTABLE_PATH;
	});

	it("connects to a remote browser URL once and reuses the in-flight promise", async () => {
		const { getBrowser, browser, connectMock, launchMock } = await loadModule({
			browserUrl: "http://chrome.example:9222",
		});

		const [first, second] = await Promise.all([
			getBrowser("sandboxed"),
			getBrowser("sandboxed"),
		]);

		expect(first).toBe(browser);
		expect(second).toBe(browser);
		expect(connectMock).toHaveBeenCalledTimes(1);
		expect(connectMock).toHaveBeenCalledWith({
			browserURL: "http://chrome.example:9222",
		});
		expect(launchMock).not.toHaveBeenCalled();
	});

	it("launches trusted browsers with the permissive trusted flags", async () => {
		const { getBrowser, browser, launchMock, executablePathMock } =
			await loadModule({
				explicitPath: "/custom/chrome",
			});

		const result = await getBrowser("trusted");

		expect(result).toBe(browser);
		expect(executablePathMock).not.toHaveBeenCalled();
		expect(launchMock).toHaveBeenCalledWith({
			headless: true,
			executablePath: "/custom/chrome",
			args: expect.arrayContaining([
				"--disable-web-security",
				"--disable-features=IsolateOrigins,site-per-process",
			]),
		});
	});

	it("falls back to sparticuz chromium when puppeteer cannot resolve chrome", async () => {
		const {
			getBrowser,
			launchMock,
			executablePathMock,
			chromiumExecutablePathMock,
		} = await loadModule({
			executablePathThrows: true,
		});

		await getBrowser("sandboxed");

		expect(executablePathMock).toHaveBeenCalledWith("chrome");
		expect(chromiumExecutablePathMock).toHaveBeenCalledTimes(1);
		expect(chromiumExecutablePathMock.mock.calls[0]?.[0]).toMatch(
			/^https:\/\/github\.com\/Sparticuz\/chromium\/releases\/download\//,
		);
		expect(launchMock).toHaveBeenCalledWith({
			headless: true,
			executablePath: "/fallback/chromium",
			args: expect.not.arrayContaining(["--disable-web-security"]),
		});
	});

	it("reopens a pooled browser after it disconnects", async () => {
		const firstBrowser = createBrowserDouble();
		const secondBrowser = createBrowserDouble();

		vi.resetModules();
		const connectMock = vi
			.fn()
			.mockResolvedValueOnce(firstBrowser)
			.mockResolvedValueOnce(secondBrowser);
		vi.doMock("puppeteer-core", () => ({
			default: {
				connect: connectMock,
				launch: vi.fn(),
				executablePath: vi.fn(),
			},
		}));
		vi.doMock("@sparticuz/chromium-min", () => ({
			default: {
				executablePath: vi.fn(),
			},
		}));
		process.env.BROWSER_WS_ENDPOINT = "ws://chrome.example/devtools";

		const { getBrowser } = await import("./chrome-pool");

		const first = await getBrowser("sandboxed");
		firstBrowser.connected = false;
		firstBrowser.emit("disconnected");
		const second = await getBrowser("sandboxed");

		expect(first).toBe(firstBrowser);
		expect(second).toBe(secondBrowser);
		expect(connectMock).toHaveBeenCalledTimes(2);
		expect(connectMock).toHaveBeenNthCalledWith(1, {
			browserWSEndpoint: "ws://chrome.example/devtools",
		});
		expect(connectMock).toHaveBeenNthCalledWith(2, {
			browserWSEndpoint: "ws://chrome.example/devtools",
		});
	});

	it("closes local browsers from the SIGTERM shutdown hook", async () => {
		const { getBrowser, browser, processHandlers } = await loadModule({
			explicitPath: "/custom/chrome",
		});
		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation((() => undefined) as never);

		await getBrowser("sandboxed");
		await processHandlers.get("SIGTERM")?.();

		expect(browser.close).toHaveBeenCalledTimes(1);
		expect(browser.disconnect).not.toHaveBeenCalled();
		expect(exitSpy).toHaveBeenCalledWith(0);
	});

	it("disconnects remote browsers from the SIGTERM shutdown hook", async () => {
		const { getBrowser, browser, processHandlers } = await loadModule({
			browserUrl: "http://chrome.example:9222",
		});
		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation((() => undefined) as never);

		await getBrowser("trusted");
		await processHandlers.get("SIGTERM")?.();

		expect(browser.disconnect).toHaveBeenCalledTimes(1);
		expect(browser.close).not.toHaveBeenCalled();
		expect(exitSpy).toHaveBeenCalledWith(0);
	});
});
