import { afterEach, describe, expect, it, vi } from "vitest";

describe("recipes logger", () => {
	afterEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
	});

	it("logs info, success and warnings outside production", async () => {
		vi.stubEnv("NODE_ENV", "test");
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
		const warnSpy = vi
			.spyOn(console, "warn")
			.mockImplementation(() => undefined);
		const errorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const { logger } = await import("./logger");

		logger.info("hello");
		logger.success("done");
		logger.warn("heads up", new Error("warn"));
		logger.error("broken", new Error("boom"));

		expect(logSpy).toHaveBeenNthCalledWith(1, "hello");
		expect(logSpy).toHaveBeenNthCalledWith(2, "✅ done");
		expect(warnSpy).toHaveBeenCalledWith("heads up", expect.any(Error));
		expect(errorSpy).toHaveBeenCalledWith("broken", expect.any(Error));
	});

	it("suppresses non-error output in production unless DEBUG is true", async () => {
		vi.stubEnv("NODE_ENV", "production");
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
		const warnSpy = vi
			.spyOn(console, "warn")
			.mockImplementation(() => undefined);
		const errorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const { logger } = await import("./logger");

		logger.info("hello");
		logger.success("done");
		logger.warn("heads up");
		logger.error("broken");

		expect(logSpy).not.toHaveBeenCalled();
		expect(warnSpy).not.toHaveBeenCalled();
		expect(errorSpy).toHaveBeenCalledWith("broken");
	});

	it("allows production logging when DEBUG is enabled", async () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("DEBUG", "true");
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
		const warnSpy = vi
			.spyOn(console, "warn")
			.mockImplementation(() => undefined);
		const { logger } = await import("./logger");

		logger.info("hello");
		logger.success("done");
		logger.warn("heads up");

		expect(logSpy).toHaveBeenNthCalledWith(1, "hello");
		expect(logSpy).toHaveBeenNthCalledWith(2, "✅ done");
		expect(warnSpy).toHaveBeenCalledWith("heads up");
	});
});
