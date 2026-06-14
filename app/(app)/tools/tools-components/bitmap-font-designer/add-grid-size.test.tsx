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
type CanvasHandlers = {
	onMouseMove: (event: { clientX: number; clientY: number }) => void;
	onClick: () => void;
	onKeyDown: (event: { key: string }) => void;
	onMouseLeave: () => void;
};

const toastState = vi.hoisted(() => ({
	success: vi.fn(),
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

vi.mock("@/components/ui/dropdown-menu", () => ({
	DropdownMenu: ({
		children,
	}: {
		children: React.ReactNode;
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
	}) => <div>{children}</div>,
	DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DropdownMenuContent: ({
		children,
		className,
	}: {
		children: React.ReactNode;
		className?: string;
		onCloseAutoFocus?: (event: { preventDefault: () => void }) => void;
	}) => <div className={className}>{children}</div>,
	DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DropdownMenuSeparator: () => <hr />,
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

function getCanvasHandlers(element: TestElement): CanvasHandlers {
	return element.props as unknown as CanvasHandlers;
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
			useCallback: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
			useEffect: (effect: React.EffectCallback) => {
				const cleanup = effect();
				if (typeof cleanup === "function") {
					cleanup();
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

	return (await import("./add-grid-size")).default;
}

afterEach(() => {
	vi.clearAllMocks();
	vi.unstubAllGlobals();
});

describe("AddGridSize", () => {
	it("renders the trigger and grid selection canvas", async () => {
		const { default: AddGridSize } = await import("./add-grid-size");

		const html = renderToStaticMarkup(
			<AddGridSize availableGridSizes={["8x8"]} onAddSize={vi.fn()} />,
		);

		assert.match(html, /Add Grid Size/);
		assert.match(html, /Select Grid Size/);
		assert.match(html, /aria-label="Grid size selector"/);
		assert.match(html, /width="136"/);
		assert.match(html, /height="136"/);
	});

	it("adds the hovered size from click and keyboard interactions", async () => {
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			callback(0);
			return 1;
		});

		const setHoveredSize = vi.fn();
		const setOpen = vi.fn();
		const onAddSize = vi.fn();
		const ctx = {
			clearRect: vi.fn(),
			fillRect: vi.fn(),
		};
		const canvas = {
			getContext: vi.fn(() => ctx),
			getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0 })),
		};

		const AddGridSize = await loadComponent(
			[
				{ value: "9x7", setter: setHoveredSize },
				{ value: true, setter: setOpen },
			],
			[{ current: canvas }],
		);

		const tree = expandNode(
			<AddGridSize availableGridSizes={["8x8"]} onAddSize={onAddSize} />,
		);
		const selectorCanvas = findFirst(
			tree,
			(element) => element.type === "canvas",
		);

		assert.ok(selectorCanvas);
		const handlers = getCanvasHandlers(selectorCanvas);
		handlers.onMouseMove({ clientX: 17, clientY: 9 });
		handlers.onClick();
		handlers.onKeyDown({ key: "Enter" });
		handlers.onKeyDown({ key: " " });

		assert.equal(setHoveredSize.mock.calls[0]?.[0], "3x2");
		assert.deepEqual(onAddSize.mock.calls, [["9x7"], ["9x7"], ["9x7"]]);
		assert.deepEqual(toastState.success.mock.calls, [
			["Added grid size: 9x7"],
			["Added grid size: 9x7"],
			["Added grid size: 9x7"],
		]);
		assert.deepEqual(setOpen.mock.calls, [[false], [false], [false]]);
		assert.equal(ctx.clearRect.mock.calls.length, 1);
		assert.ok(ctx.fillRect.mock.calls.length > 0);
	});

	it("skips add when the hovered size is unavailable and clears hover on leave", async () => {
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			callback(0);
			return 1;
		});
		const setHoveredSize = vi.fn();
		const onAddSize = vi.fn();
		const canvas = {
			getContext: vi.fn(() => null),
			getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0 })),
		};

		const AddGridSize = await loadComponent(
			[
				{ value: "8x8", setter: setHoveredSize },
				{ value: true, setter: vi.fn() },
			],
			[{ current: canvas }],
		);

		const tree = expandNode(
			<AddGridSize availableGridSizes={["8x8"]} onAddSize={onAddSize} />,
		);
		const selectorCanvas = findFirst(
			tree,
			(element) => element.type === "canvas",
		);

		assert.ok(selectorCanvas);
		const handlers = getCanvasHandlers(selectorCanvas);
		handlers.onClick();
		handlers.onKeyDown({ key: "Escape" });
		handlers.onMouseLeave();

		assert.equal(onAddSize.mock.calls.length, 0);
		assert.equal(toastState.success.mock.calls.length, 0);
		assert.deepEqual(setHoveredSize.mock.calls, [[null]]);
	});

	it("ignores pointer work when the canvas ref is missing", async () => {
		const setHoveredSize = vi.fn();
		const onAddSize = vi.fn();

		const AddGridSize = await loadComponent(
			[
				{ value: null, setter: setHoveredSize },
				{ value: false, setter: vi.fn() },
			],
			[{ current: null }],
		);

		const tree = expandNode(
			<AddGridSize availableGridSizes={["8x8"]} onAddSize={onAddSize} />,
		);
		const selectorCanvas = findFirst(
			tree,
			(element) => element.type === "canvas",
		);

		assert.ok(selectorCanvas);
		const handlers = getCanvasHandlers(selectorCanvas);
		handlers.onMouseMove({ clientX: 5, clientY: 5 });
		handlers.onClick();

		assert.equal(setHoveredSize.mock.calls.length, 0);
		assert.equal(onAddSize.mock.calls.length, 0);
	});
});
