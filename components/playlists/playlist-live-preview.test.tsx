import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, it, vi } from "vitest";

type StateEntry = {
	value: unknown;
	setter?: ReturnType<typeof vi.fn>;
};

type CapturedButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

const previewState = vi.hoisted(() => ({
	buttonProps: [] as CapturedButtonProps[],
	setFormat: vi.fn(),
	setSizeIndex: vi.fn(),
	setPaletteIndex: vi.fn(),
	setIsPortrait: vi.fn(),
}));

vi.mock("@/components/common/device-frame", () => ({
	DeviceFrame: ({ children }: { children: React.ReactNode }) => (
		<div data-device-frame="true">{children}</div>
	),
}));

vi.mock("@/components/preview/screen-preview-controls", () => ({
	ScreenPreviewControls: () => <div>screen-preview-controls</div>,
	screenPreviewSummary: ({
		width,
		height,
		grayscale,
	}: {
		width: number;
		height: number;
		grayscale: number;
	}) => `${width}x${height}/${grayscale}`,
	useScreenPreviewControls: () => ({
		format: "bmp",
		setFormat: previewState.setFormat,
		sizeIndex: 0,
		setSizeIndex: previewState.setSizeIndex,
		paletteIndex: 0,
		setPaletteIndex: previewState.setPaletteIndex,
		isPortrait: false,
		setIsPortrait: previewState.setIsPortrait,
		width: 800,
		height: 480,
		grayscale: 16,
	}),
}));

vi.mock("@/components/ui/button", () => ({
	Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
		previewState.buttonProps.push(props);
		return (
			<button disabled={props.disabled} type={props.type ?? "button"}>
				{props.children}
			</button>
		);
	},
}));

import {
	getPlaylistCountdownSeconds,
	getPlaylistLivePreviewDuration,
	getPlaylistLivePreviewSrc,
	getPlaylistPreviewProgressWidth,
	getWrappedPlaylistIndex,
	PlaylistLivePreview,
} from "./playlist-live-preview";

const previewFrame = {
	id: "frame-1",
	screen_id: "weather",
	screen_type: "recipe",
	duration: 1,
	label: "Weather",
};

async function loadPreview({
	states,
	refs,
}: {
	states: StateEntry[];
	refs: Array<{ current: unknown }>;
}) {
	vi.resetModules();
	previewState.buttonProps.length = 0;
	let stateIndex = 0;
	let refIndex = 0;

	vi.doMock("react", async (importOriginal) => {
		const actual = await importOriginal<typeof import("react")>();
		return {
			...actual,
			useEffect: (effect: () => void) => effect(),
			useRef: (initial: unknown) => refs[refIndex++] ?? { current: initial },
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

	return (await import("./playlist-live-preview")).PlaylistLivePreview;
}

afterEach(() => {
	vi.clearAllMocks();
	vi.restoreAllMocks();
});

describe("PlaylistLivePreview", () => {
	it("derives duration, wrapped indices, progress width, and preview urls", () => {
		assert.equal(getPlaylistLivePreviewDuration(), 30);
		assert.equal(
			getPlaylistLivePreviewDuration({ ...previewFrame, duration: 0 }),
			1,
		);
		assert.equal(getWrappedPlaylistIndex(-1, 3), 2);
		assert.equal(getWrappedPlaylistIndex(4, 3), 1);
		assert.equal(getWrappedPlaylistIndex(0, 0), null);
		assert.equal(getPlaylistPreviewProgressWidth(0.375), "37.5%");
		assert.equal(getPlaylistPreviewProgressWidth(3), "100%");
		assert.equal(getPlaylistCountdownSeconds(45, 0.51), 23);
		assert.equal(
			getPlaylistLivePreviewSrc(previewFrame, 800, 480, 16),
			"/api/bitmap/weather.bmp?width=800&height=480&grayscale=16",
		);
	});

	it("renders an empty-state preview when there are no frames", () => {
		const html = renderToStaticMarkup(
			<PlaylistLivePreview
				frames={[]}
				activeIndex={0}
				onActiveIndexChange={() => {}}
			/>,
		);

		assert.match(html, /Add a frame to preview the playlist/);
		assert.match(html, /Playlist frame pipeline/);
		assert.match(html, />No frames</);
		assert.match(html, /disabled=""/);
	});

	it("wraps previous and next button callbacks around the playlist", async () => {
		const onActiveIndexChange = vi.fn();
		const setIsPlaying = vi.fn();
		const setProgress = vi.fn();
		const PlaylistLivePreviewMocked = await loadPreview({
			states: [
				{ value: false, setter: setIsPlaying },
				{ value: 0, setter: setProgress },
			],
			refs: [
				{
					current: {
						frames: [
							previewFrame,
							{
								id: "frame-2",
								screen_id: "stocks",
								screen_type: "recipe",
								duration: 2,
								label: "Stocks",
							},
						],
						activeIndex: 0,
						duration: 1,
						onActiveIndexChange,
					},
				},
				{ current: 0 },
			],
		});

		renderToStaticMarkup(
			<PlaylistLivePreviewMocked
				frames={[
					previewFrame,
					{
						id: "frame-2",
						screen_id: "stocks",
						screen_type: "recipe",
						duration: 2,
						label: "Stocks",
					},
				]}
				activeIndex={0}
				onActiveIndexChange={onActiveIndexChange}
			/>,
		);

		previewState.buttonProps[0]?.onClick?.({} as never);
		previewState.buttonProps[2]?.onClick?.({} as never);
		previewState.buttonProps[1]?.onClick?.({} as never);

		assert.deepEqual(onActiveIndexChange.mock.calls, [[1], [1]]);
		assert.equal(setIsPlaying.mock.calls[0]?.[0](false), true);
	});

	it("advances playback from requestAnimationFrame ticks and resets progress on active-frame changes", async () => {
		const onActiveIndexChange = vi.fn();
		const setProgress = vi.fn();
		const raf = vi.fn();
		vi.stubGlobal("requestAnimationFrame", raf);
		vi.stubGlobal("cancelAnimationFrame", vi.fn());

		const PlaylistLivePreviewMocked = await loadPreview({
			states: [{ value: true }, { value: 0.2, setter: setProgress }],
			refs: [
				{
					current: {
						frames: [
							previewFrame,
							{
								id: "frame-2",
								screen_id: "stocks",
								screen_type: "recipe",
								duration: 1,
								label: "Stocks",
							},
						],
						activeIndex: 0,
						duration: 1,
						onActiveIndexChange,
					},
				},
				{ current: 1 },
			],
		});

		renderToStaticMarkup(
			<PlaylistLivePreviewMocked
				frames={[
					previewFrame,
					{
						id: "frame-2",
						screen_id: "stocks",
						screen_type: "recipe",
						duration: 1,
						label: "Stocks",
					},
				]}
				activeIndex={0}
				onActiveIndexChange={onActiveIndexChange}
			/>,
		);

		assert.deepEqual(setProgress.mock.calls[0], [0]);
		assert.equal(raf.mock.calls.length, 1);

		const tick = raf.mock.calls[0]?.[0] as (time: number) => void;
		tick(2000);

		assert.deepEqual(onActiveIndexChange.mock.calls.at(-1), [1]);
		assert.deepEqual(setProgress.mock.calls.at(-1), [0]);
	});
});
