import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, it, vi } from "vitest";

type StateEntry = {
	value: unknown;
	setter?: ReturnType<typeof vi.fn>;
};

type CapturedButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

const filmstripState = vi.hoisted(() => ({
	buttonProps: [] as CapturedButtonProps[],
}));

vi.mock("@/components/common/device-frame", () => ({
	DeviceFrame: ({ children }: { children: React.ReactNode }) => (
		<div data-device-frame="true">{children}</div>
	),
}));

vi.mock("@/components/playlists/perforation-marks", () => ({
	PerforationMarks: () => <div data-perforation="true" />,
}));

async function loadFilmstrip(states: StateEntry[]) {
	vi.resetModules();
	filmstripState.buttonProps.length = 0;
	let stateIndex = 0;

	vi.doMock("react", async (importOriginal) => {
		const actual = await importOriginal<typeof import("react")>();
		return {
			...actual,
			createElement: (
				type: string | React.ComponentType<unknown>,
				props: Record<string, unknown> | null,
				...children: React.ReactNode[]
			) => {
				if (type === "button") {
					filmstripState.buttonProps.push(
						(props ?? {}) as React.ButtonHTMLAttributes<HTMLButtonElement>,
					);
				}
				return actual.createElement(type as never, props, ...children);
			},
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
			if (type === "button") {
				filmstripState.buttonProps.push(
					(props ?? {}) as React.ButtonHTMLAttributes<HTMLButtonElement>,
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
			if (type === "button") {
				filmstripState.buttonProps.push(
					(props ?? {}) as React.ButtonHTMLAttributes<HTMLButtonElement>,
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

	return await import("./playlist-filmstrip");
}

const calendarFrame = {
	id: "frame-2",
	screen_id: "calendar",
	screen_type: "recipe",
	duration: 45,
	label: "Calendar",
};

afterEach(() => {
	vi.clearAllMocks();
	vi.restoreAllMocks();
});

describe("PlaylistFilmstrip", () => {
	it("derives timeline summaries, frame classes, and preview urls", async () => {
		const {
			getPlaylistFilmstripFrameClassName,
			getPlaylistFilmstripFrameSrc,
			getPlaylistFilmstripSummary,
		} = await import("./playlist-filmstrip");

		assert.deepEqual(
			getPlaylistFilmstripSummary([{ ...calendarFrame, duration: 60 }]),
			{ frameCountLabel: "1 frame", totalLabel: "1m" },
		);
		assert.deepEqual(
			getPlaylistFilmstripSummary([
				{ ...calendarFrame, id: "frame-1", label: "Weather", duration: 15 },
				calendarFrame,
			]),
			{ frameCountLabel: "2 frames", totalLabel: "1m" },
		);
		assert.match(
			getPlaylistFilmstripFrameClassName({
				isActive: true,
				isOver: true,
				isDragging: true,
			}),
			/border-primary.*ring-2.*opacity-40/,
		);
		assert.equal(
			getPlaylistFilmstripFrameSrc(calendarFrame),
			"/api/bitmap/calendar.bmp?width=800&height=480&grayscale=16",
		);
	});

	it("renders the frame count, loop duration, and add-frame action", async () => {
		const { PlaylistFilmstrip } = await import("./playlist-filmstrip");
		const html = renderToStaticMarkup(
			<PlaylistFilmstrip
				frames={[
					{
						id: "frame-1",
						screen_id: "weather",
						screen_type: "recipe",
						duration: 15,
						label: "Weather",
					},
					calendarFrame,
				]}
				activeIndex={1}
				onSelect={() => {}}
				onReorder={() => {}}
				onAdd={() => {}}
			/>,
		);

		assert.match(html, /2 frames · 1m loop/);
		assert.match(html, /aria-label="Frame 1: Weather"/);
		assert.match(html, /aria-label="Frame 2: Calendar"/);
		assert.match(html, /aria-pressed="true"/);
		assert.match(html, /Add frame/);
	});

	it("fires selection, add, and drag-drop callbacks from captured frame handlers", async () => {
		const onSelect = vi.fn();
		const onReorder = vi.fn();
		const onAdd = vi.fn();
		const setDragIndex = vi.fn();
		const setOverIndex = vi.fn();
		const { PlaylistFilmstrip } = await loadFilmstrip([
			{ value: 0, setter: setDragIndex },
			{ value: null, setter: setOverIndex },
		]);

		renderToStaticMarkup(
			<PlaylistFilmstrip
				frames={[
					{
						id: "frame-1",
						screen_id: "weather",
						screen_type: "recipe",
						duration: 15,
						label: "Weather",
					},
					calendarFrame,
				]}
				activeIndex={1}
				onSelect={onSelect}
				onReorder={onReorder}
				onAdd={onAdd}
			/>,
		);

		const frameOne = filmstripState.buttonProps[0];
		const frameTwo = filmstripState.buttonProps[1];
		const addFrame = filmstripState.buttonProps[2];
		assert.ok(frameOne && frameTwo && addFrame);

		frameOne.onClick?.({} as never);
		addFrame.onClick?.({} as never);

		const dragTransfer = {
			dropEffect: "",
			effectAllowed: "",
			setData: vi.fn(),
		};
		frameOne.onDragStart?.({
			dataTransfer: dragTransfer,
		} as unknown as React.DragEvent<HTMLButtonElement>);
		frameTwo.onDragOver?.({
			preventDefault: vi.fn(),
			dataTransfer: dragTransfer,
		} as unknown as React.DragEvent<HTMLButtonElement>);
		frameTwo.onDrop?.({
			preventDefault: vi.fn(),
		} as unknown as React.DragEvent<HTMLButtonElement>);
		frameTwo.onDragEnd?.({} as unknown as React.DragEvent<HTMLButtonElement>);

		assert.deepEqual(onSelect.mock.calls, [[0]]);
		assert.equal(onAdd.mock.calls.length, 1);
		assert.deepEqual(setDragIndex.mock.calls[0], [0]);
		assert.equal(dragTransfer.effectAllowed, "move");
		assert.equal(dragTransfer.dropEffect, "move");
		assert.equal(dragTransfer.setData.mock.calls[0]?.[1], "0");
		assert.deepEqual(setOverIndex.mock.calls[0], [1]);
		assert.deepEqual(onReorder.mock.calls, [[0, 1]]);
		assert.deepEqual(setDragIndex.mock.calls.at(-1), [null]);
		assert.deepEqual(setOverIndex.mock.calls.at(-1), [null]);
	});

	it("skips reorder when a frame is dropped onto itself and clears over-state on leave", async () => {
		const onReorder = vi.fn();
		const setDragIndex = vi.fn();
		const setOverIndex = vi.fn();
		const { PlaylistFilmstrip } = await loadFilmstrip([
			{ value: 1, setter: setDragIndex },
			{ value: 1, setter: setOverIndex },
		]);

		renderToStaticMarkup(
			<PlaylistFilmstrip
				frames={[
					{
						id: "frame-1",
						screen_id: "weather",
						screen_type: "recipe",
						duration: 15,
						label: "Weather",
					},
					calendarFrame,
				]}
				activeIndex={1}
				onSelect={() => {}}
				onReorder={onReorder}
				onAdd={() => {}}
			/>,
		);

		const frameTwo = filmstripState.buttonProps[1];
		assert.ok(frameTwo);

		frameTwo.onDragLeave?.({} as unknown as React.DragEvent<HTMLButtonElement>);
		frameTwo.onDrop?.({
			preventDefault: vi.fn(),
		} as unknown as React.DragEvent<HTMLButtonElement>);

		assert.equal(onReorder.mock.calls.length, 0);
		assert.deepEqual(setOverIndex.mock.calls[0], [null]);
	});
});
