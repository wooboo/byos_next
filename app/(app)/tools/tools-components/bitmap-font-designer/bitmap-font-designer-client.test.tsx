// @ts-nocheck
import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, it, vi } from "vitest";

type StateEntry = {
	value: unknown;
	setter?: ReturnType<typeof vi.fn>;
};

type RefEntry = {
	current: unknown;
};

type ElementNode = React.ReactNode;
type TestElement = React.ReactElement<
	Record<string, unknown>,
	React.ElementType
>;
type ButtonHandlers = {
	onClick: (event?: {
		currentTarget?: { dataset?: Record<string, string> };
	}) => void;
};
type InputHandlers = {
	onChange: (event: { target: { files: Array<{ name: string }> } }) => void;
};

type AddGridSizeProps = {
	availableGridSizes: string[];
	onAddSize: (size: string) => void;
};

type EditorProps = {
	selectedGridSize: string;
	selectedCharCode: number;
	currentCharacterBitmap: string;
	setCurrentCharacterBitmap?: (bitmap: string | null) => void;
	onDataChange?: (newData: string, charCode: number) => void;
};

const toastState = vi.hoisted(() => ({
	success: vi.fn(),
	error: vi.fn(),
}));

const componentState = vi.hoisted(() => ({
	addGridSizeProps: null as AddGridSizeProps | null,
	editorProps: null as EditorProps | null,
}));

vi.mock("sonner", () => ({
	toast: toastState,
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({
		children,
		...props
	}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button type="button" {...props}>
			{children}
		</button>
	),
}));

vi.mock("@/components/ui/input", () => ({
	Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
		<input {...props} />
	),
}));

vi.mock("@/components/ui/tooltip", () => ({
	TooltipProvider: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	Tooltip: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	TooltipContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock("./add-grid-size", () => ({
	default: (props: AddGridSizeProps) => {
		componentState.addGridSizeProps = props;
		return <div>add-grid-size:{props.availableGridSizes.join(",")}</div>;
	},
}));

vi.mock("./bitmap-font-editor", () => ({
	default: (props: EditorProps) => {
		componentState.editorProps = props;
		return (
			<div>
				editor:{props.selectedGridSize}:{props.selectedCharCode}:
				{props.currentCharacterBitmap.length}
			</div>
		);
	},
}));

function resolveComponentType(type: unknown) {
	if (typeof type === "function") {
		return type as (props: Record<string, unknown>) => React.ReactNode;
	}

	const candidate = type as { type?: unknown } | null;
	if (
		typeof candidate === "object" &&
		candidate !== null &&
		typeof candidate.type === "function"
	) {
		return candidate.type as (
			props: Record<string, unknown>,
		) => React.ReactNode;
	}

	return null;
}

function isTestElement(node: ElementNode): node is TestElement {
	return React.isValidElement<Record<string, unknown>>(node);
}

function expandNode(node: ElementNode): ElementNode {
	if (Array.isArray(node)) {
		return node.map(expandNode);
	}

	if (!isTestElement(node)) {
		return node;
	}

	const renderer = resolveComponentType(node.type);
	if (renderer) {
		return expandNode(renderer(node.props as Record<string, unknown>));
	}

	const children = node.props.children as React.ReactNode | undefined;
	if (!children) {
		return node;
	}

	return React.cloneElement(
		node,
		undefined,
		React.Children.map(children, (child) => expandNode(child)),
	);
}

function findFirst(
	node: ElementNode,
	predicate: (element: TestElement) => boolean,
): TestElement | null {
	if (Array.isArray(node)) {
		for (const child of node) {
			const match = findFirst(child, predicate);
			if (match) return match;
		}
		return null;
	}

	if (!isTestElement(node)) {
		return null;
	}

	if (predicate(node)) {
		return node;
	}

	return findFirst(node.props.children as React.ReactNode, predicate);
}

function buttonHandlers(element: TestElement): ButtonHandlers {
	return element.props as unknown as ButtonHandlers;
}

function inputHandlers(element: TestElement): InputHandlers {
	return element.props as unknown as InputHandlers;
}

async function loadComponent(
	stateEntries: StateEntry[],
	refEntries: RefEntry[],
) {
	vi.resetModules();
	let stateIndex = 0;
	let refIndex = 0;

	vi.doMock("react", async (importOriginal) => {
		const actual = await importOriginal<typeof import("react")>();
		return {
			...actual,
			memo: <T,>(component: T) => component,
			useCallback: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
			useEffect: (effect: React.EffectCallback) => {
				effect();
			},
			useMemo: <T,>(factory: () => T) => factory(),
			useRef: (initial: unknown) => {
				const entry = refEntries[refIndex++];
				return entry ?? { current: initial };
			},
			useState: (initial: unknown) => {
				const resolvedInitial =
					typeof initial === "function"
						? (initial as () => unknown)()
						: initial;
				const entry = stateEntries[stateIndex++];
				if (!entry) {
					return [resolvedInitial, vi.fn()] as const;
				}
				return [entry.value, entry.setter ?? vi.fn()] as const;
			},
			useTransition: () =>
				[false, (callback: () => void) => callback()] as const,
		};
	});

	return (await import("./bitmap-font-designer-client.tsx")).default;
}

afterEach(() => {
	vi.clearAllMocks();
	vi.unstubAllGlobals();
	componentState.addGridSizeProps = null;
	componentState.editorProps = null;
});

describe("BitmapFontDesignerClient", () => {
	it("renders size controls, preview controls, and editor shell", async () => {
		const BitmapFontDesignerClient = await import(
			"./bitmap-font-designer-client.tsx"
		).then((module) => module.default);
		const html = renderToStaticMarkup(<BitmapFontDesignerClient />);

		assert.match(html, /Load Font/);
		assert.match(html, /Save Font/);
		assert.match(html, /add-grid-size:7x8/);
		assert.match(html, /Preview sentence/);
		assert.match(
			html,
			/Hello World! The quick brown fox jumps over the lazy dog\./,
		);
		assert.match(html, /Font size: 7x8/);
		assert.match(html, /editor:7x8:65:/);
		assert.match(html, /Character A/);
	});

	it("handles adding sizes, switching sizes, selecting characters, and editor updates", async () => {
		const setAvailableGridSizes = vi.fn();
		const setSelectedGridSize = vi.fn();
		const setSelectedCharCode = vi.fn();
		const setPreviewText = vi.fn();
		const setPreviewScale = vi.fn();
		const setPreviewGap = vi.fn();
		const setCharacterBitmaps = vi.fn();
		const setCurrentCharacterBitmap = vi.fn();
		const initialMap = new Map<number, string>([[65, "1010"]]);
		const largerMap = new Map<number, string>([
			[65, "11110000"],
			[66, "1100"],
		]);
		const fontDataRef = {
			current: {
				"7x8": initialMap,
				"8x8": largerMap,
			},
		};
		const selectedElement = {
			scrollIntoView: vi.fn(),
		};

		const BitmapFontDesignerClient = await loadComponent(
			[
				{ value: ["7x8", "8x8"], setter: setAvailableGridSizes },
				{ value: "7x8", setter: setSelectedGridSize },
				{ value: 65, setter: setSelectedCharCode },
				{
					value: "Hello World! The quick brown fox jumps over the lazy dog.",
					setter: setPreviewText,
				},
				{ value: 2, setter: setPreviewScale },
				{ value: 0, setter: setPreviewGap },
				{ value: initialMap, setter: setCharacterBitmaps },
				{ value: "1010", setter: setCurrentCharacterBitmap },
				{
					value: "Hello World! The quick brown fox jumps over the lazy dog.",
					setter: vi.fn(),
				},
				{
					value: "Hello World! The quick brown fox jumps over the lazy dog.",
					setter: vi.fn(),
				},
			],
			[
				fontDataRef,
				{ current: { click: vi.fn(), value: "stale" } },
				{
					current: {
						querySelector: vi.fn(() => selectedElement),
					},
				},
			],
		);

		const tree = expandNode(<BitmapFontDesignerClient />);
		const sizeButton = findFirst(
			tree,
			(element) =>
				element.type === "button" &&
				(element.props["data-size"] as string | undefined) === "8x8",
		);
		const characterButton = findFirst(
			tree,
			(element) =>
				element.type === "button" &&
				(element.props["data-char-code"] as number | undefined) === 66,
		);

		assert.ok(componentState.addGridSizeProps);
		assert.ok(componentState.editorProps);
		assert.ok(sizeButton);
		assert.ok(characterButton);

		componentState.addGridSizeProps.onAddSize("9x9");
		buttonHandlers(sizeButton).onClick({
			currentTarget: { dataset: { size: "8x8" } },
		});
		buttonHandlers(sizeButton).onClick({ currentTarget: { dataset: {} } });
		buttonHandlers(characterButton).onClick({
			currentTarget: { dataset: { charCode: "66" } },
		});
		componentState.editorProps.onDataChange?.("0011", 65);

		assert.equal(selectedElement.scrollIntoView.mock.calls.length, 1);
		assert.deepEqual(setSelectedGridSize.mock.calls[0], ["9x9"]);
		assert.deepEqual(setCharacterBitmaps.mock.calls[0], [new Map()]);
		assert.deepEqual(setCurrentCharacterBitmap.mock.calls[0], [null]);

		const updater = setAvailableGridSizes.mock.calls[0]?.[0] as
			| ((sizes: string[]) => string[])
			| undefined;
		assert.deepEqual(updater?.(["7x8", "8x8"]), ["7x8", "8x8", "9x9"]);

		const switchedMap = setCharacterBitmaps.mock.calls[1]?.[0] as
			| Map<number, string>
			| undefined;
		assert.deepEqual(setSelectedGridSize.mock.calls[1], ["8x8"]);
		assert.equal(switchedMap instanceof Map, true);
		assert.deepEqual(setCurrentCharacterBitmap.mock.calls[1], [
			switchedMap?.get(65) ?? null,
		]);
		assert.deepEqual(setSelectedCharCode.mock.calls[0], [66]);
		assert.deepEqual(setCurrentCharacterBitmap.mock.calls[2], [
			switchedMap?.get(66) ?? null,
		]);
		assert.equal(initialMap.get(65), "0011");
		assert.equal(fontDataRef.current["7x8"]?.get(65), "0011");
		assert.deepEqual(setCurrentCharacterBitmap.mock.calls[3], ["0011"]);
	});

	it("loads uploaded font data, surfaces helper errors, and rejects invalid json", async () => {
		const setAvailableGridSizes = vi.fn();
		const setSelectedGridSize = vi.fn();
		const setCharacterBitmaps = vi.fn();
		const setCurrentCharacterBitmap = vi.fn();
		const fileInputRef = { current: { click: vi.fn(), value: "chosen-file" } };

		const BitmapFontDesignerClient = await loadComponent(
			[
				{ value: ["7x8"], setter: setAvailableGridSizes },
				{ value: "7x8", setter: setSelectedGridSize },
				{ value: 65, setter: vi.fn() },
				{
					value: "Hello World! The quick brown fox jumps over the lazy dog.",
					setter: vi.fn(),
				},
				{ value: 2, setter: vi.fn() },
				{ value: 0, setter: vi.fn() },
				{ value: new Map<number, string>(), setter: setCharacterBitmaps },
				{ value: null, setter: setCurrentCharacterBitmap },
				{
					value: "Hello World! The quick brown fox jumps over the lazy dog.",
					setter: vi.fn(),
				},
				{
					value: "Hello World! The quick brown fox jumps over the lazy dog.",
					setter: vi.fn(),
				},
			],
			[
				{ current: { "7x8": new Map<number, string>() } },
				fileInputRef,
				{ current: { querySelector: vi.fn(() => null) } },
			],
		);

		const tree = expandNode(<BitmapFontDesignerClient />);
		const loadInput = findFirst(
			tree,
			(element) =>
				element.type === "input" &&
				(element.props["aria-label"] as string | undefined) ===
					"Load font file",
		);

		assert.ok(loadInput);

		const successPayload = JSON.stringify({
			fonts: [
				{
					width: 8,
					height: 8,
					characters: [{ charCode: 66, char: "B", data: "wA==" }],
				},
			],
		});

		class SuccessFileReader {
			onload: ((event: { target: { result: string } }) => void) | null = null;

			readAsText() {
				this.onload?.({ target: { result: successPayload } });
			}
		}

		vi.stubGlobal("FileReader", SuccessFileReader);
		inputHandlers(loadInput).onChange({
			target: { files: [{ name: "font.json" }] },
		});

		assert.deepEqual(setAvailableGridSizes.mock.calls[0], [["8x8"]]);
		assert.deepEqual(setSelectedGridSize.mock.calls[0], ["8x8"]);
		assert.equal(setCharacterBitmaps.mock.calls[0]?.[0] instanceof Map, true);
		assert.deepEqual(setCurrentCharacterBitmap.mock.calls[0], [null]);
		assert.deepEqual(toastState.success.mock.calls[0], [
			"Font data loaded successfully!",
		]);
		assert.equal(fileInputRef.current?.value, "");

		const invalidStructurePayload = JSON.stringify({
			fonts: [{ width: "bad", height: 8, characters: [] }],
		});

		class InvalidStructureFileReader {
			onload: ((event: { target: { result: string } }) => void) | null = null;

			readAsText() {
				this.onload?.({ target: { result: invalidStructurePayload } });
			}
		}

		vi.stubGlobal("FileReader", InvalidStructureFileReader);
		inputHandlers(loadInput).onChange({
			target: { files: [{ name: "broken.json" }] },
		});
		assert.match(
			toastState.error.mock.calls[0]?.[0] as string,
			/Failed to load font data: Invalid font data structure/,
		);

		const alertSpy = vi.fn();
		vi.stubGlobal("alert", alertSpy);

		class InvalidJsonFileReader {
			onload: ((event: { target: { result: string } }) => void) | null = null;

			readAsText() {
				this.onload?.({ target: { result: "{not-json}" } });
			}
		}

		vi.stubGlobal("FileReader", InvalidJsonFileReader);
		inputHandlers(loadInput).onChange({
			target: { files: [{ name: "bad.json" }] },
		});
		inputHandlers(loadInput).onChange({ target: { files: [] } });

		assert.deepEqual(alertSpy.mock.calls[0], [
			"Invalid font file format. Please upload a valid JSON file.",
		]);
	});

	it("saves the exported font data to a download link", async () => {
		vi.useFakeTimers();

		const appendChild = vi.fn();
		const removeChild = vi.fn();
		const click = vi.fn();
		const createObjectURL = vi.fn(() => "blob:bitmap-font");
		const revokeObjectURL = vi.fn();

		vi.stubGlobal("Blob", class MockBlob {});
		const patchedUrl = Object.assign(URL, {
			createObjectURL,
			revokeObjectURL,
		});
		vi.stubGlobal("URL", patchedUrl);
		vi.stubGlobal("document", {
			body: {
				appendChild,
				removeChild,
			},
			createElement: vi.fn(() => ({
				click,
			})),
		});

		const BitmapFontDesignerClient = await loadComponent(
			[
				{ value: ["7x8"], setter: vi.fn() },
				{ value: "7x8", setter: vi.fn() },
				{ value: 65, setter: vi.fn() },
				{
					value: "Hello World! The quick brown fox jumps over the lazy dog.",
					setter: vi.fn(),
				},
				{ value: 2, setter: vi.fn() },
				{ value: 0, setter: vi.fn() },
				{ value: new Map<number, string>([[65, "10101010"]]), setter: vi.fn() },
				{ value: "10101010", setter: vi.fn() },
				{
					value: "Hello World! The quick brown fox jumps over the lazy dog.",
					setter: vi.fn(),
				},
				{
					value: "Hello World! The quick brown fox jumps over the lazy dog.",
					setter: vi.fn(),
				},
			],
			[
				{
					current: {
						"7x8": new Map<number, string>([[65, "10101010"]]),
					},
				},
				{ current: { click: vi.fn(), value: "" } },
				{ current: { querySelector: vi.fn(() => null) } },
			],
		);

		const tree = expandNode(<BitmapFontDesignerClient />);
		const saveButton = findFirst(
			tree,
			(element) =>
				element.type === "button" &&
				(element.props.title as string | undefined) === "Save font data",
		);

		assert.ok(saveButton);
		buttonHandlers(saveButton).onClick();
		vi.runAllTimers();

		assert.equal(createObjectURL.mock.calls.length, 1);
		assert.equal(appendChild.mock.calls.length, 1);
		assert.equal(click.mock.calls.length, 1);
		assert.equal(removeChild.mock.calls.length, 1);
		assert.deepEqual(revokeObjectURL.mock.calls[0], ["blob:bitmap-font"]);
	});
});
