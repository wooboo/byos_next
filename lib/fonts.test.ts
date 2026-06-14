import { afterEach, describe, expect, it, vi } from "vitest";

async function loadModule(options?: {
	fontBuffers?: Record<string, Buffer>;
	readThrows?: Error;
}) {
	vi.resetModules();

	const fontSansFactory = vi.fn(({ variable }: { variable: string }) => ({
		className: "sans",
		style: {},
		variable,
	}));
	const fontMonoFactory = vi.fn(({ variable }: { variable: string }) => ({
		className: "mono",
		style: {},
		variable,
	}));
	const localFontFactory = vi.fn(({ variable }: { variable: string }) => ({
		className: variable,
		style: {},
		variable,
	}));
	const readFileSyncMock = options?.readThrows
		? vi.fn(() => {
				throw options.readThrows;
			})
		: vi.fn((fontPath: string) => {
				const key = fontPath.split("/").pop()?.replace(".ttf", "");
				return options?.fontBuffers?.[key ?? ""] ?? Buffer.from("font-data");
			});
	const errorSpy = vi
		.spyOn(console, "error")
		.mockImplementation(() => undefined);

	vi.doMock("next/font/google", () => ({
		Geist: fontSansFactory,
		Geist_Mono: fontMonoFactory,
	}));
	vi.doMock("next/font/local", () => ({
		default: localFontFactory,
	}));
	vi.doMock("fs", () => ({
		default: { readFileSync: readFileSyncMock },
		readFileSync: readFileSyncMock,
	}));

	const mod = await import("./fonts");
	return {
		...mod,
		fontSansFactory,
		fontMonoFactory,
		localFontFactory,
		readFileSyncMock,
		errorSpy,
	};
}

describe("fonts", () => {
	afterEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
	});

	it("collects configured font variables", async () => {
		const { getAllFontVariables } = await loadModule();

		expect(getAllFontVariables()).toBe(
			"--font-sans --font-mono --font-blockkie --font-geneva9 --font-inter",
		);
	});

	it("loads font buffers and converts them to takumi font definitions", async () => {
		const { loadFont, getTakumiFonts, readFileSyncMock } = await loadModule({
			fontBuffers: {
				BlockKie: Buffer.from([1, 2]),
				"geneva-9": Buffer.from([3, 4]),
				"Inter_18pt-Regular": Buffer.from([5, 6]),
			},
		});

		const loadedFonts = loadFont();
		const takumiFonts = getTakumiFonts();

		expect(readFileSyncMock).toHaveBeenCalledWith(
			expect.stringContaining("BlockKie.ttf"),
		);
		expect(readFileSyncMock).toHaveBeenCalledWith(
			expect.stringContaining("geneva-9.ttf"),
		);
		expect(readFileSyncMock).toHaveBeenCalledWith(
			expect.stringContaining("Inter_18pt-Regular.ttf"),
		);
		expect(loadedFonts).toMatchObject({
			blockKie: Buffer.from([1, 2]),
			geneva9: Buffer.from([3, 4]),
			inter: Buffer.from([5, 6]),
		});
		expect(takumiFonts).toHaveLength(3);
		expect(takumiFonts[0]).toMatchObject({
			name: "blockKie",
			weight: 400,
			style: "normal",
		});
		expect(takumiFonts[0]?.data).toBeInstanceOf(ArrayBuffer);
	});

	it("returns null and no takumi fonts when reading fonts fails", async () => {
		const { loadFont, getTakumiFonts, errorSpy } = await loadModule({
			readThrows: new Error("missing"),
		});

		expect(loadFont()).toBeNull();
		expect(getTakumiFonts()).toEqual([]);
		expect(errorSpy).toHaveBeenCalledWith(
			"Error loading fonts:",
			expect.any(Error),
		);
	});

	it("extracts font family from class names unless inline style already sets it", async () => {
		const { extractFontFamily } = await loadModule();

		expect(extractFontFamily()).toBe("blockkie");
		expect(extractFontFamily("text-sm font-geneva9 tracking-normal")).toBe(
			"geneva9",
		);
		expect(
			extractFontFamily("text-sm", { fontFamily: "Inter" }),
		).toBeUndefined();
	});
});
