import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

async function loadModule(
	options: { fetchRejects?: boolean; nodeEnv?: string; debug?: string } = {},
) {
	vi.resetModules();

	const originalNodeEnv = process.env.NODE_ENV;
	const originalDebug = process.env.DEBUG;
	vi.stubEnv("NODE_ENV", options.nodeEnv ?? "test");
	if (options.debug === undefined) {
		delete process.env.DEBUG;
	} else {
		vi.stubEnv("DEBUG", options.debug);
	}

	const state = {
		fonts: [{ name: "Takumi Sans", data: Buffer.from("font") }],
		node: { type: "mock-node" },
		urls: ["https://assets.example/image.png"],
		fetchedResources: [{ url: "https://assets.example/image.png", data: "ok" }],
		renderOutput: Uint8Array.from([1, 2, 3]),
	};

	const renderMock = vi.fn().mockResolvedValue(state.renderOutput);
	const extractResourceUrlsMock = vi.fn(() => state.urls);
	const fetchResourcesMock = options.fetchRejects
		? vi.fn().mockRejectedValue(new Error("fetch failed"))
		: vi.fn().mockResolvedValue(state.fetchedResources);
	const fromJsxMock = vi.fn().mockResolvedValue({ node: state.node });
	const rendererConstructorMock = vi.fn().mockImplementation(() => ({
		render: renderMock,
	}));
	const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

	vi.doMock("@takumi-rs/core", () => ({
		extractResourceUrls: extractResourceUrlsMock,
		Renderer: class {
			constructor(...args: Parameters<typeof rendererConstructorMock>) {
				rendererConstructorMock(...args);
			}

			render = renderMock;
		},
	}));
	vi.doMock("@takumi-rs/helpers", () => ({
		fetchResources: fetchResourcesMock,
	}));
	vi.doMock("@takumi-rs/helpers/jsx", () => ({
		fromJsx: fromJsxMock,
	}));
	vi.doMock("@/lib/fonts", () => ({
		getTakumiFonts: vi.fn(() => state.fonts),
	}));

	const mod = await import("./takumi");

	const restoreEnv = () => {
		vi.unstubAllEnvs();
		if (originalNodeEnv === undefined) {
			vi.stubEnv("NODE_ENV", "");
		} else {
			vi.stubEnv("NODE_ENV", originalNodeEnv);
		}
		if (originalDebug === undefined) {
			vi.stubEnv("DEBUG", "");
		} else {
			vi.stubEnv("DEBUG", originalDebug);
		}
	};

	return {
		...mod,
		renderMock,
		extractResourceUrlsMock,
		fetchResourcesMock,
		fromJsxMock,
		rendererConstructorMock,
		warnSpy,
		state,
		restoreEnv,
	};
}

describe("renderWithTakumi", () => {
	afterEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
		vi.doUnmock("@takumi-rs/core");
		vi.doUnmock("@takumi-rs/helpers");
		vi.doUnmock("@takumi-rs/helpers/jsx");
		vi.doUnmock("@/lib/fonts");
	});

	it("renders JSX with fetched external resources", async () => {
		const {
			renderWithTakumi,
			extractResourceUrlsMock,
			fetchResourcesMock,
			fromJsxMock,
			rendererConstructorMock,
			renderMock,
			state,
			restoreEnv,
		} = await loadModule();

		try {
			const element = React.createElement("div", null, "hello");
			const result = await renderWithTakumi(element, 800, 480);

			expect(rendererConstructorMock).toHaveBeenCalledWith({
				fonts: state.fonts,
			});
			expect(fromJsxMock).toHaveBeenCalledWith(element);
			expect(extractResourceUrlsMock).toHaveBeenCalledWith(state.node);
			expect(fetchResourcesMock).toHaveBeenCalledWith(state.urls);
			expect(renderMock).toHaveBeenCalledWith(state.node, {
				width: 800,
				height: 480,
				format: "png",
				fetchedResources: state.fetchedResources,
			});
			expect(result).toEqual(Buffer.from(state.renderOutput));
		} finally {
			restoreEnv();
		}
	});

	it("renders without resources when external fetch fails in non-production mode", async () => {
		const { renderWithTakumi, renderMock, warnSpy, state, restoreEnv } =
			await loadModule({ fetchRejects: true, nodeEnv: "test" });

		try {
			const result = await renderWithTakumi(
				React.createElement("div", null, "hello"),
				400,
				240,
			);

			expect(warnSpy).toHaveBeenCalledTimes(1);
			expect(renderMock).toHaveBeenCalledWith(state.node, {
				width: 400,
				height: 240,
				format: "png",
				fetchedResources: [],
			});
			expect(result).toEqual(Buffer.from(state.renderOutput));
		} finally {
			restoreEnv();
		}
	});
});
