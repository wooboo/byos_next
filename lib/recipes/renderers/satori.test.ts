import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

async function loadModule() {
	vi.resetModules();

	const state = {
		fonts: [{ name: "Takumi Sans", data: Buffer.from("font") }],
		arrayBuffer: Buffer.from("png-bytes"),
	};

	const imageResponseMock = vi.fn().mockImplementation(() => ({
		arrayBuffer: vi.fn().mockResolvedValue(state.arrayBuffer),
	}));
	const getTakumiFontsMock = vi.fn(() => state.fonts);

	vi.doMock("next/og", () => ({
		ImageResponse: class {
			constructor(...args: Parameters<typeof imageResponseMock>) {
				imageResponseMock(...args);
			}

			arrayBuffer() {
				return Promise.resolve(state.arrayBuffer);
			}
		},
	}));
	vi.doMock("@/lib/fonts", () => ({
		getTakumiFonts: getTakumiFontsMock,
	}));

	const mod = await import("./satori");
	return { ...mod, imageResponseMock, getTakumiFontsMock, state };
}

describe("renderWithSatori", () => {
	afterEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
		vi.doUnmock("next/og");
		vi.doUnmock("@/lib/fonts");
	});

	it("builds an ImageResponse with takumi fonts and returns a PNG buffer", async () => {
		const { renderWithSatori, imageResponseMock, getTakumiFontsMock, state } =
			await loadModule();
		const element = React.createElement("div", null, "hello");

		const result = await renderWithSatori(element, 640, 384);

		expect(getTakumiFontsMock).toHaveBeenCalledTimes(1);
		expect(imageResponseMock).toHaveBeenCalledWith(element, {
			width: 640,
			height: 384,
			fonts: state.fonts,
			shapeRendering: 1,
			textRendering: 0,
			imageRendering: 1,
			debug: false,
		});
		expect(result).toEqual(Buffer.from("png-bytes"));
	});
});
