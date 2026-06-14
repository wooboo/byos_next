import { afterEach, describe, expect, it, vi } from "vitest";

async function loadModule() {
	vi.resetModules();

	const page = {
		setViewport: vi.fn(),
		setContent: vi.fn(),
		waitForNetworkIdle: vi.fn(),
		screenshot: vi.fn().mockResolvedValue(Buffer.from("html-shot")),
		close: vi.fn(),
	};
	const browser = {
		newPage: vi.fn().mockResolvedValue(page),
	};
	const getBrowserMock = vi.fn().mockResolvedValue(browser);

	vi.doMock("@/lib/recipes/chrome-pool", () => ({
		getBrowser: getBrowserMock,
	}));

	const mod = await import("./html-screenshot");
	return { ...mod, page, getBrowserMock };
}

describe("renderHtmlToImage", () => {
	afterEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
		vi.doUnmock("@/lib/recipes/chrome-pool");
	});

	it("renders HTML in the sandboxed browser profile and clips the requested frame", async () => {
		const { renderHtmlToImage, page, getBrowserMock } = await loadModule();

		const result = await renderHtmlToImage("<main>Hello</main>", 640, 384);

		expect(getBrowserMock).toHaveBeenCalledWith("sandboxed");
		expect(page.setViewport).toHaveBeenCalledWith({ width: 640, height: 384 });
		expect(page.setContent).toHaveBeenCalledWith("<main>Hello</main>", {
			waitUntil: "domcontentloaded",
			timeout: 15000,
		});
		expect(page.waitForNetworkIdle).toHaveBeenCalledWith({ timeout: 15000 });
		expect(page.screenshot).toHaveBeenCalledWith({
			type: "png",
			clip: { x: 0, y: 0, width: 640, height: 384 },
		});
		expect(page.close).toHaveBeenCalledTimes(1);
		expect(result).toEqual(Buffer.from("html-shot"));
	});
});
