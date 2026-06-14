/**
 * @vitest-environment jsdom
 */

import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, it, vi } from "vitest";

type StateEntry = {
	value: unknown;
	setter?: ReturnType<typeof vi.fn>;
};

type CapturedButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;
type CapturedInputProps = React.InputHTMLAttributes<HTMLInputElement>;
type CapturedSelectProps = {
	value?: string;
	onValueChange?: (value: string) => void;
};
type CapturedSliderProps = {
	id?: string;
	value?: number[];
	onValueChange?: (value: number[]) => void;
};

const dithererState = vi.hoisted(() => ({
	applyDitheringMock: vi.fn(
		(
			_method: unknown,
			grayscaleData: Uint8Array,
			_options: {
				width: number;
				height: number;
				threshold: number;
				bayerPatternSize: 2 | 4 | 8;
			},
		) => new Uint8Array(grayscaleData.map((value) => (value > 120 ? 255 : 0))),
	),
	nativeButtonProps: [] as CapturedButtonProps[],
	buttonProps: [] as CapturedButtonProps[],
	inputProps: [] as CapturedInputProps[],
	selectProps: [] as CapturedSelectProps[],
	sliderProps: [] as CapturedSliderProps[],
}));

vi.mock("@/components/ui/button", () => ({
	Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
		dithererState.buttonProps.push(props);
		return <button type={props.type ?? "button"}>{props.children}</button>;
	},
}));

vi.mock("@/components/ui/select", () => ({
	Select: ({
		children,
		value,
		onValueChange,
	}: {
		children: React.ReactNode;
		value?: string;
		onValueChange?: (value: string) => void;
	}) => {
		dithererState.selectProps.push({ value, onValueChange });
		return <div>{children}</div>;
	},
	SelectTrigger: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	SelectValue: ({ placeholder }: { placeholder?: string }) => (
		<div>{placeholder}</div>
	),
	SelectContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	SelectItem: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock("@/components/ui/slider", () => ({
	Slider: (props: CapturedSliderProps) => {
		dithererState.sliderProps.push(props);
		return <div>{props.id}</div>;
	},
}));

vi.mock("@/utils/image-processing", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/utils/image-processing")>();
	return {
		...actual,
		applyDithering: dithererState.applyDitheringMock,
	};
});

async function loadComponent({
	states,
	refs,
	runEffects = true,
}: {
	states: StateEntry[];
	refs: Array<{ current: unknown }>;
	runEffects?: boolean;
}) {
	vi.resetModules();
	dithererState.buttonProps.length = 0;
	dithererState.nativeButtonProps.length = 0;
	dithererState.inputProps.length = 0;
	dithererState.selectProps.length = 0;
	dithererState.sliderProps.length = 0;
	let stateIndex = 0;
	let refIndex = 0;

	vi.doMock("react", async (importOriginal) => {
		const actual = await importOriginal<typeof import("react")>();
		return {
			...actual,
			createElement: (
				type: string | React.ComponentType<unknown>,
				props: Record<string, unknown> | null,
				...children: React.ReactNode[]
			) => {
				if (type === "input") {
					dithererState.inputProps.push((props ?? {}) as CapturedInputProps);
				}
				if (type === "button") {
					dithererState.nativeButtonProps.push(
						(props ?? {}) as CapturedButtonProps,
					);
				}
				return actual.createElement(type as never, props, ...children);
			},
			useEffect: (effect: () => void) => {
				if (runEffects) {
					effect();
				}
			},
			useRef: () => refs[refIndex++] ?? { current: null },
			useState: (initial: unknown) => {
				const resolvedInitial =
					typeof initial === "function"
						? (initial as () => unknown)()
						: initial;
				const entry = states[stateIndex++];
				if (!entry) {
					return [resolvedInitial, vi.fn()] as const;
				}
				return [entry.value, entry.setter ?? vi.fn()] as const;
			},
		};
	});
	vi.doMock("react/jsx-runtime", async (importOriginal) => {
		const actual = await importOriginal<typeof import("react/jsx-runtime")>();
		const capture = (type: unknown, props: Record<string, unknown> | null) => {
			if (type === "input") {
				dithererState.inputProps.push((props ?? {}) as CapturedInputProps);
			}
			if (type === "button") {
				dithererState.nativeButtonProps.push(
					(props ?? {}) as CapturedButtonProps,
				);
			}
		};
		return {
			...actual,
			jsx: (
				type: unknown,
				props: Record<string, unknown> | null,
				key?: React.Key,
			) => {
				capture(type, props);
				return actual.jsx(type as never, props, key);
			},
			jsxs: (
				type: unknown,
				props: Record<string, unknown> | null,
				key?: React.Key,
			) => {
				capture(type, props);
				return actual.jsxs(type as never, props, key);
			},
		};
	});
	vi.doMock("react/jsx-dev-runtime", async (importOriginal) => {
		const actual =
			await importOriginal<typeof import("react/jsx-dev-runtime")>();
		const actualDev = actual as typeof actual & {
			jsxDEV: (
				type: unknown,
				props: Record<string, unknown> | null,
				key: React.Key | undefined,
				isStaticChildren: boolean,
				source: unknown,
				self: unknown,
			) => React.ReactElement;
		};
		const capture = (type: unknown, props: Record<string, unknown> | null) => {
			if (type === "input") {
				dithererState.inputProps.push((props ?? {}) as CapturedInputProps);
			}
			if (type === "button") {
				dithererState.nativeButtonProps.push(
					(props ?? {}) as CapturedButtonProps,
				);
			}
		};
		return {
			...actual,
			jsxDEV: (
				type: unknown,
				props: Record<string, unknown> | null,
				key: React.Key | undefined,
				isStaticChildren: boolean,
				source: unknown,
				self: unknown,
			) => {
				capture(type, props);
				return actualDev.jsxDEV(
					type as never,
					props,
					key,
					isStaticChildren,
					source,
					self,
				);
			},
		};
	});

	return (await import("./image-ditherer")).default;
}

afterEach(() => {
	vi.clearAllMocks();
	vi.restoreAllMocks();
});

describe("ImageDitherer", () => {
	it("renders the empty upload state before an image is selected", async () => {
		const ImageDitherer = await loadComponent({
			states: [
				{ value: null },
				{ value: "floydSteinberg" },
				{ value: [0] },
				{ value: [0] },
				{ value: [128] },
				{ value: [4] },
				{ value: false },
				{ value: 1 },
				{ value: true },
				{ value: "" },
			],
			refs: [{ current: null }, { current: null }, { current: null }],
			runEffects: false,
		});
		const html = renderToStaticMarkup(<ImageDitherer />);

		assert.match(html, /No image yet/);
		assert.match(html, /Drop an image or browse to dither it 1-bit\./);
		assert.match(html, /Upload an image/);
		assert.match(html, /type="file"/);
	});

	it("opens the file picker from upload actions and handles upload success and failures", async () => {
		const setOriginalImage = vi.fn();
		const fileInput = { value: "stale", click: vi.fn() };
		let fileReaderMode: "load" | "error" = "load";
		let imageMode: "load" | "error" = "load";

		class MockFileReader {
			onload: ((event: { target: { result: string } }) => void) | null = null;
			onerror: ((error: Error) => void) | null = null;

			readAsDataURL(_file: File) {
				if (fileReaderMode === "error") {
					this.onerror?.(new Error("reader-failed"));
					return;
				}

				this.onload?.({ target: { result: "data:image/png;base64,Zm9v" } });
			}
		}

		class MockImage {
			crossOrigin = "";
			onload: (() => void) | null = null;
			onerror: ((error: Error) => void) | null = null;

			set src(_value: string) {
				if (imageMode === "error") {
					this.onerror?.(new Error("image-failed"));
					return;
				}
				this.onload?.();
			}
		}

		vi.stubGlobal("FileReader", MockFileReader);
		vi.stubGlobal("Image", MockImage);
		const errorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);

		const ImageDitherer = await loadComponent({
			states: [
				{ value: null, setter: setOriginalImage },
				{ value: "floydSteinberg" },
				{ value: [0] },
				{ value: [0] },
				{ value: [128] },
				{ value: [4] },
				{ value: false },
				{ value: 1 },
				{ value: true },
				{ value: "" },
			],
			refs: [{ current: null }, { current: fileInput }, { current: null }],
			runEffects: false,
		});

		renderToStaticMarkup(<ImageDitherer />);

		const fileInputProps = dithererState.inputProps[0];
		assert.equal(typeof fileInputProps.onChange, "function");

		fileInputProps.onChange?.({
			target: { files: [], value: "x" },
		} as unknown as React.ChangeEvent<HTMLInputElement>);
		assert.equal(setOriginalImage.mock.calls.length, 0);

		fileReaderMode = "error";
		fileInputProps.onChange?.({
			target: {
				files: [new File(["x"], "reader.png", { type: "image/png" })],
				value: "x",
			},
		} as unknown as React.ChangeEvent<HTMLInputElement>);

		fileReaderMode = "load";
		imageMode = "error";
		fileInputProps.onChange?.({
			target: {
				files: [new File(["y"], "image.png", { type: "image/png" })],
				value: "x",
			},
		} as unknown as React.ChangeEvent<HTMLInputElement>);

		imageMode = "load";
		fileInputProps.onChange?.({
			target: {
				files: [new File(["z"], "ok.png", { type: "image/png" })],
				value: "x",
			},
		} as unknown as React.ChangeEvent<HTMLInputElement>);

		assert.equal(errorSpy.mock.calls.length, 2);
		assert.match(String(errorSpy.mock.calls[0]?.[0]), /FileReader error/);
		assert.match(String(errorSpy.mock.calls[1]?.[0]), /Image loading error/);
		assert.equal(setOriginalImage.mock.calls.length, 1);
	});

	it("applies dithering through the canvas pipeline and forwards control changes", async () => {
		const setMethod = vi.fn();
		const setBrightness = vi.fn();
		const setContrast = vi.fn();
		const setThreshold = vi.fn();
		const setPatternSize = vi.fn();
		const setInverted = vi.fn();
		const setZoom = vi.fn();
		const setShowControls = vi.fn();
		const originalImage = { width: 2, height: 1 };
		const finalImageData = {
			data: new Uint8ClampedArray([76, 76, 76, 255, 150, 150, 150, 255]),
		};
		const tempContext = {
			clearRect: vi.fn(),
			drawImage: vi.fn(),
			getImageData: vi
				.fn()
				.mockReturnValueOnce({
					data: new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]),
				})
				.mockReturnValueOnce(finalImageData),
			putImageData: vi.fn(),
		};
		const canvasContext = {
			getImageData: vi.fn(),
			putImageData: vi.fn(),
		};
		const canvas = {
			width: 0,
			height: 0,
			getContext: vi.fn(() => canvasContext),
		};
		const tempCanvas = {
			width: 0,
			height: 0,
			getContext: vi.fn(() => tempContext),
		};
		const fileInput = { value: "", click: vi.fn() };
		const createElementSpy = vi.fn((tagName: string) => {
			if (tagName === "canvas") {
				return tempCanvas;
			}
			return { tagName };
		});
		vi.stubGlobal("document", {
			createElement: createElementSpy,
		});

		const ImageDitherer = await loadComponent({
			states: [
				{ value: originalImage },
				{ value: "floydSteinberg", setter: setMethod },
				{ value: [0], setter: setBrightness },
				{ value: [0], setter: setContrast },
				{ value: [128], setter: setThreshold },
				{ value: [4], setter: setPatternSize },
				{ value: false, setter: setInverted },
				{ value: 1, setter: setZoom },
				{ value: true, setter: setShowControls },
				{ value: "" },
			],
			refs: [{ current: canvas }, { current: fileInput }, { current: null }],
		});

		const html = renderToStaticMarkup(<ImageDitherer />);

		assert.match(html, /Copy as Base64/);
		assert.equal(dithererState.applyDitheringMock.mock.calls.length, 1);
		assert.deepEqual(dithererState.applyDitheringMock.mock.calls[0]?.[2], {
			width: 2,
			height: 1,
			threshold: 128,
			bayerPatternSize: 4,
		});
		assert.equal(canvas.width, 2);
		assert.equal(canvas.height, 1);
		assert.equal(canvasContext.putImageData.mock.calls.length, 1);

		dithererState.selectProps[0]?.onValueChange?.("threshold");
		dithererState.sliderProps
			.find((slider) => slider.id === "brightness-slider")
			?.onValueChange?.([25]);
		dithererState.sliderProps
			.find((slider) => slider.id === "contrast-slider")
			?.onValueChange?.([10]);
		dithererState.inputProps
			.find((input) => input.id === "invert")
			?.onChange?.({
				target: { checked: true },
			} as React.ChangeEvent<HTMLInputElement>);
		dithererState.buttonProps[0]?.onClick?.({} as never);
		dithererState.buttonProps[1]?.onClick?.({} as never);
		dithererState.buttonProps[2]?.onClick?.({} as never);
		dithererState.nativeButtonProps
			.find((props) => String(props.className ?? "").includes("cursor-pointer"))
			?.onClick?.({} as never);

		assert.deepEqual(setMethod.mock.calls, [["threshold"]]);
		assert.deepEqual(setBrightness.mock.calls, [[[25]]]);
		assert.deepEqual(setContrast.mock.calls, [[[10]]]);
		assert.deepEqual(setInverted.mock.calls, [[true]]);
		assert.equal(setShowControls.mock.calls.length, 1);
		assert.equal(fileInput.click.mock.calls.length, 1);
		assert.equal(setZoom.mock.calls[0]?.[0](0.25), 0.25);
		assert.equal(setZoom.mock.calls[1]?.[0](5), 5);
		assert.equal(createElementSpy.mock.calls.length >= 1, true);
	});

	it("copies and downloads the rendered canvas output", async () => {
		const setCopyStatus = vi.fn();
		const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
		const imageData = {
			data: new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]),
		};
		const canvas = {
			width: 2,
			height: 1,
			toDataURL: vi.fn(() => "data:image/png;base64,QUJD"),
			getContext: vi.fn(() => ({
				getImageData: vi.fn(() => imageData),
			})),
		};
		const anchor = { href: "", download: "", click: vi.fn() };
		const ImageDitherer = await loadComponent({
			states: [
				{ value: { width: 2, height: 1 } },
				{ value: "floydSteinberg" },
				{ value: [0] },
				{ value: [0] },
				{ value: [128] },
				{ value: [4] },
				{ value: false },
				{ value: 1 },
				{ value: true },
				{ value: "", setter: setCopyStatus },
			],
			refs: [
				{ current: canvas },
				{ current: { value: "", click: vi.fn() } },
				{ current: null },
			],
			runEffects: false,
		});
		vi.stubGlobal("navigator", { clipboard });
		const createElementSpy = vi.fn((tagName: string) => {
			if (tagName === "a") {
				return anchor;
			}
			return {
				width: 0,
				height: 0,
				getContext: vi.fn(() => ({
					clearRect: vi.fn(),
					drawImage: vi.fn(),
					getImageData: vi.fn(() => imageData),
					putImageData: vi.fn(),
				})),
			};
		});
		vi.stubGlobal("document", {
			createElement: createElementSpy,
		});
		const createObjectURL = vi.fn(() => "blob:preview");
		Object.defineProperty(URL, "createObjectURL", {
			configurable: true,
			value: createObjectURL,
		});

		renderToStaticMarkup(<ImageDitherer />);

		await dithererState.buttonProps[3]?.onClick?.({} as never);
		assert.deepEqual(clipboard.writeText.mock.calls, [
			["data:image/png;base64,QUJD"],
		]);
		assert.deepEqual(setCopyStatus.mock.calls[0], ["Copied!"]);

		clipboard.writeText.mockRejectedValueOnce(new Error("denied"));
		const errorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		await dithererState.buttonProps[3]?.onClick?.({} as never);
		assert.deepEqual(setCopyStatus.mock.calls.at(-1), ["Failed to copy"]);
		assert.equal(errorSpy.mock.calls.length, 1);

		dithererState.buttonProps[4]?.onClick?.({} as never);
		assert.equal(createObjectURL.mock.calls.length, 1);
		assert.equal(anchor.download, "dithered-image.bmp");
		assert.equal(anchor.click.mock.calls.length, 1);
		assert.equal(createElementSpy.mock.calls.length >= 1, true);
	});
});
