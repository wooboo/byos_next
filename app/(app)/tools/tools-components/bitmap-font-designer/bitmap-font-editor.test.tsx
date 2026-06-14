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

vi.mock("@/components/ui/label", () => ({
	Label: ({
		children,
	}: {
		children: React.ReactNode;
		htmlFor?: string;
		className?: string;
	}) => <div>{children}</div>,
}));

vi.mock("@/components/ui/slider", () => ({
	Slider: (props: {
		id?: string;
		value?: number[];
		onValueChange?: (value: number[]) => void;
	}) => <slider {...props} />,
}));

function resolveComponentType(
	type: React.ElementType | React.JSXElementConstructor<unknown>,
): ((props: Record<string, unknown>) => React.ReactNode) | null {
	if (typeof type === "function") {
		return type as (props: Record<string, unknown>) => React.ReactNode;
	}

	if (
		typeof type === "object" &&
		type !== null &&
		"type" in type &&
		typeof type.type === "function"
	) {
		return type.type as (props: Record<string, unknown>) => React.ReactNode;
	}

	return null;
}

function expandNode(node: ElementNode): ElementNode {
	if (Array.isArray(node)) {
		return node.map(expandNode);
	}

	if (!React.isValidElement(node)) {
		return node;
	}

	const renderer = resolveComponentType(node.type);
	if (renderer) {
		return expandNode(renderer(node.props as Record<string, unknown>));
	}

	const children = node.props?.children;
	if (!children) {
		return node;
	}

	return {
		...node,
		props: {
			...node.props,
			children: React.Children.map(children, (child) => expandNode(child)),
		},
	};
}

function findFirst(
	node: ElementNode,
	predicate: (element: React.ReactElement) => boolean,
): React.ReactElement | null {
	if (Array.isArray(node)) {
		for (const child of node) {
			const match = findFirst(child, predicate);
			if (match) return match;
		}
		return null;
	}

	if (!React.isValidElement(node)) {
		return null;
	}

	if (predicate(node)) {
		return node;
	}

	return findFirst(node.props?.children, predicate);
}

async function loadComponent(
	stateEntries: StateEntry[],
	refEntries: RefEntry[],
) {
	vi.resetModules();
	let stateIndex = 0;
	let refIndex = 0;
	const cleanups: Array<() => void> = [];

	vi.doMock("react", async (importOriginal) => {
		const actual = await importOriginal<typeof import("react")>();
		return {
			...actual,
			useCallback: <T extends (...args: never[]) => unknown>(fn: T) => fn,
			useEffect: (effect: React.EffectCallback) => {
				const cleanup = effect();
				if (typeof cleanup === "function") {
					cleanups.push(cleanup);
				}
			},
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
		};
	});

	const Component = (await import("./bitmap-font-editor.tsx")).default;
	return { Component, cleanups };
}

afterEach(() => {
	vi.clearAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe("BitmapFontEditor", () => {
	it("renders toolbar controls, selected character, and metric sliders", async () => {
		const BitmapFontEditor = await import("./bitmap-font-editor.tsx").then(
			(module) => module.default,
		);
		const html = renderToStaticMarkup(
			<BitmapFontEditor
				selectedGridSize="2x10"
				selectedCharCode={65}
				currentCharacterBitmap="1001"
			/>,
		);

		assert.match(html, /aria-label="Undo"/);
		assert.match(html, /aria-label="Rotate Clockwise"/);
		assert.match(html, /aria-label="Shift Right"/);
		assert.match(html, /A 65/);
		assert.match(html, /X-Height/);
		assert.match(html, /Baseline/);
		assert.match(html, /id="x-height"[^>]*value="6"/);
		assert.match(html, /id="baseline"[^>]*value="8"/);
	});

	it("executes drawing, history, transform, clipboard, and cleanup branches", async () => {
		vi.useFakeTimers();

		const setXHeight = vi.fn();
		const setBaseline = vi.fn();
		const setCanUndo = vi.fn();
		const setCanRedo = vi.fn();
		const setShowCopySuccess = vi.fn();
		const setCurrentCharacterBitmap = vi.fn();
		const onDataChange = vi.fn();
		const addedListeners: Array<(event?: unknown) => void> = [];
		const removedListeners: Array<(event?: unknown) => void> = [];

		const mainContext = {
			clearRect: vi.fn(),
			fillRect: vi.fn(),
			strokeRect: vi.fn(),
			beginPath: vi.fn(),
			moveTo: vi.fn(),
			lineTo: vi.fn(),
			stroke: vi.fn(),
			fillStyle: "",
			strokeStyle: "",
			lineWidth: 0,
		};
		const previewContext = {
			clearRect: vi.fn(),
			fillRect: vi.fn(),
			fillStyle: "",
		};
		const mainCanvas = {
			width: 0,
			height: 0,
			getContext: vi.fn(() => mainContext),
			getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0 })),
		};
		const previewCanvas = {
			width: 0,
			height: 0,
			getContext: vi.fn(() => previewContext),
		};

		vi.stubGlobal("window", {
			addEventListener: vi.fn(
				(_type: string, listener: (event?: unknown) => void) => {
					addedListeners.push(listener);
				},
			),
			removeEventListener: vi.fn(
				(_type: string, listener: (event?: unknown) => void) => {
					removedListeners.push(listener);
				},
			),
		});

		const { Component, cleanups } = await loadComponent(
			[
				{ value: 1, setter: setXHeight },
				{ value: 1, setter: setBaseline },
				{ value: false, setter: setCanUndo },
				{ value: false, setter: setCanRedo },
				{ value: false, setter: setShowCopySuccess },
			],
			[
				{ current: previewCanvas },
				{ current: mainCanvas },
				{
					current: [
						[0, 0],
						[0, 0],
					],
				},
				{ current: false },
				{ current: null },
				{ current: null },
				{ current: 0 },
				{ current: null },
				{ current: false },
				{ current: 65 },
				{ current: new Map() },
				{ current: [] },
				{ current: -1 },
				{ current: null },
			],
		);

		const tree = expandNode(
			<Component
				selectedGridSize="2x2"
				selectedCharCode={65}
				currentCharacterBitmap=""
				setCurrentCharacterBitmap={setCurrentCharacterBitmap}
				onDataChange={onDataChange}
			/>,
		);
		const editorCanvas = findFirst(
			tree,
			(element) =>
				element.type === "canvas" &&
				typeof element.props.onMouseDown === "function",
		);
		const undoButton = findFirst(
			tree,
			(element) =>
				element.type === "button" && element.props["aria-label"] === "Undo",
		);
		const redoButton = findFirst(
			tree,
			(element) =>
				element.type === "button" && element.props["aria-label"] === "Redo",
		);
		const clearButton = findFirst(
			tree,
			(element) =>
				element.type === "button" && element.props["aria-label"] === "Clear",
		);
		const flipHorizontalButton = findFirst(
			tree,
			(element) =>
				element.type === "button" &&
				element.props["aria-label"] === "Flip Horizontal",
		);
		const flipVerticalButton = findFirst(
			tree,
			(element) =>
				element.type === "button" &&
				element.props["aria-label"] === "Flip Vertical",
		);
		const rotateClockwiseButton = findFirst(
			tree,
			(element) =>
				element.type === "button" &&
				element.props["aria-label"] === "Rotate Clockwise",
		);
		const rotateCounterClockwiseButton = findFirst(
			tree,
			(element) =>
				element.type === "button" &&
				element.props["aria-label"] === "Rotate Counter-clockwise",
		);
		const shiftUpButton = findFirst(
			tree,
			(element) =>
				element.type === "button" && element.props["aria-label"] === "Shift Up",
		);
		const shiftDownButton = findFirst(
			tree,
			(element) =>
				element.type === "button" &&
				element.props["aria-label"] === "Shift Down",
		);
		const shiftLeftButton = findFirst(
			tree,
			(element) =>
				element.type === "button" &&
				element.props["aria-label"] === "Shift Left",
		);
		const shiftRightButton = findFirst(
			tree,
			(element) =>
				element.type === "button" &&
				element.props["aria-label"] === "Shift Right",
		);
		const copyButton = findFirst(
			tree,
			(element) =>
				element.type === "button" && element.props["aria-label"] === "Copy",
		);
		const pasteButton = findFirst(
			tree,
			(element) =>
				element.type === "button" && element.props["aria-label"] === "Paste",
		);
		const xHeightSlider = findFirst(
			tree,
			(element) => element.type === "slider" && element.props.id === "x-height",
		);
		const baselineSlider = findFirst(
			tree,
			(element) => element.type === "slider" && element.props.id === "baseline",
		);

		assert.ok(editorCanvas);
		assert.ok(undoButton);
		assert.ok(redoButton);
		assert.ok(clearButton);
		assert.ok(flipHorizontalButton);
		assert.ok(flipVerticalButton);
		assert.ok(rotateClockwiseButton);
		assert.ok(rotateCounterClockwiseButton);
		assert.ok(shiftUpButton);
		assert.ok(shiftDownButton);
		assert.ok(shiftLeftButton);
		assert.ok(shiftRightButton);
		assert.ok(copyButton);
		assert.ok(pasteButton);
		assert.ok(xHeightSlider);
		assert.ok(baselineSlider);

		undoButton.props.onClick();
		redoButton.props.onClick();
		pasteButton.props.onClick();
		editorCanvas.props.onMouseMove({ clientX: 0, clientY: 0 });
		editorCanvas.props.onMouseDown({ clientX: 200, clientY: 200 });
		editorCanvas.props.onMouseDown({ clientX: 5, clientY: 5 });
		editorCanvas.props.onMouseMove({ clientX: 45, clientY: 45 });
		addedListeners[0]?.();
		vi.advanceTimersByTime(300);

		copyButton.props.onClick();
		vi.advanceTimersByTime(1500);
		pasteButton.props.onClick();
		flipHorizontalButton.props.onClick();
		flipVerticalButton.props.onClick();
		rotateClockwiseButton.props.onClick();
		rotateCounterClockwiseButton.props.onClick();
		shiftUpButton.props.onClick();
		shiftDownButton.props.onClick();
		shiftLeftButton.props.onClick();
		shiftRightButton.props.onClick();
		clearButton.props.onClick();
		undoButton.props.onClick();
		redoButton.props.onClick();
		editorCanvas.props.onMouseLeave();
		xHeightSlider.props.onValueChange([99]);
		baselineSlider.props.onValueChange([0]);

		for (const cleanup of cleanups) {
			cleanup();
		}

		assert.equal(addedListeners.length, 1);
		assert.equal(removedListeners.length, 1);
		assert.ok(mainContext.clearRect.mock.calls.length > 0);
		assert.ok(previewContext.fillRect.mock.calls.length > 0);
		assert.deepEqual(setShowCopySuccess.mock.calls.slice(0, 2), [
			[true],
			[false],
		]);
		assert.ok(setCanUndo.mock.calls.length > 0);
		assert.ok(setCanRedo.mock.calls.length > 0);
		assert.deepEqual(setXHeight.mock.calls[0], [1]);
		assert.deepEqual(setBaseline.mock.calls[0], [1]);
		assert.equal(setCurrentCharacterBitmap.mock.calls.length > 0, true);
		assert.equal(onDataChange.mock.calls.length > 0, true);
		assert.equal(typeof onDataChange.mock.calls[0]?.[0], "string");
		assert.equal(onDataChange.mock.calls[0]?.[1], 65);
	});
});
