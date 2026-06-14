import assert from "node:assert/strict";
import type * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	useStateValues: undefined as unknown[] | undefined,
	useStateIndex: 0,
	useStateSetters: [] as Array<ReturnType<typeof vi.fn>>,
	runEffects: false,
	buttonProps: [] as Array<React.ButtonHTMLAttributes<HTMLButtonElement>>,
	inputProps: [] as Array<{
		value?: string;
		placeholder?: string;
		onChange?: (event: { target: { value: string } }) => void;
	}>,
	filmstripProps: [] as Array<{
		frames: unknown;
		activeIndex: number;
		onSelect: (index: number) => void;
		onReorder: (from: number, to: number) => void;
		onAdd: () => void;
	}>,
	frameSettingsProps: [] as Array<{
		frame: unknown;
		index: number;
		screenOptions: unknown;
		onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>;
		onDelete: (id: string) => void;
	}>,
}));

vi.mock("react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react")>();

	return {
		...actual,
		useEffect: (effect: () => undefined | (() => void)) => {
			if (state.runEffects) effect();
		},
		useState: <T,>(initial: T) => {
			const values = state.useStateValues;
			const next =
				values && state.useStateIndex < values.length
					? (values[state.useStateIndex] as T)
					: initial;
			const setter = vi.fn();
			state.useStateSetters.push(setter);
			state.useStateIndex += 1;
			return [next, setter] as [T, React.Dispatch<React.SetStateAction<T>>];
		},
	};
});

vi.mock("@/app/actions/playlist", () => ({
	fetchPlaylistWithItems: vi.fn(),
}));

vi.mock("@/components/common/screen-from-recipe", () => ({
	createScreenIdFromRecipe: vi.fn(),
	promptScreenName: vi.fn(),
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({
		children,
		disabled,
		...props
	}: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
		state.buttonProps.push(props);
		return (
			<button
				type="button"
				disabled={disabled}
				aria-label={props["aria-label"]}
			>
				{children}
			</button>
		);
	},
}));

vi.mock("@/components/ui/input", () => ({
	Input: ({
		value,
		placeholder,
		onChange,
	}: {
		value?: string;
		placeholder?: string;
		onChange?: (event: { target: { value: string } }) => void;
	}) => {
		state.inputProps.push({ value, placeholder, onChange });
		return <input value={value} placeholder={placeholder} readOnly />;
	},
}));

vi.mock("./playlist-live-preview", () => ({
	PlaylistLivePreview: ({
		frames,
		activeIndex,
	}: {
		frames: Array<{ id: string; label: string; duration: number }>;
		activeIndex: number;
	}) => (
		<div
			data-active-index={String(activeIndex)}
			data-frames={JSON.stringify(frames)}
		>
			live-preview
		</div>
	),
}));

vi.mock("./playlist-frame-settings", () => ({
	PlaylistFrameSettings: ({
		frame,
		index,
		screenOptions,
		onUpdate,
		onDelete,
	}: {
		frame: unknown;
		index: number;
		screenOptions: unknown;
		onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>;
		onDelete: (id: string) => void;
	}) => {
		state.frameSettingsProps.push({
			frame,
			index,
			screenOptions,
			onUpdate,
			onDelete,
		});
		return (
			<div
				data-frame-index={String(index)}
				data-frame={JSON.stringify(frame)}
				data-screen-options={JSON.stringify(screenOptions)}
			>
				frame-settings
			</div>
		);
	},
}));

vi.mock("./playlist-filmstrip", () => ({
	PlaylistFilmstrip: ({
		frames,
		activeIndex,
		onSelect,
		onReorder,
		onAdd,
	}: {
		frames: unknown;
		activeIndex: number;
		onSelect: (index: number) => void;
		onReorder: (from: number, to: number) => void;
		onAdd: () => void;
	}) => {
		state.filmstripProps.push({
			frames,
			activeIndex,
			onSelect,
			onReorder,
			onAdd,
		});
		return (
			<div
				data-filmstrip-active-index={String(activeIndex)}
				data-filmstrip-frames={JSON.stringify(frames)}
			>
				filmstrip
			</div>
		);
	},
}));

type PlaylistBuilderModule = typeof import("./playlist-builder");
let moduleCache: PlaylistBuilderModule | null = null;

async function getPlaylistBuilder() {
	if (!moduleCache) {
		moduleCache = await import("./playlist-builder");
	}
	return moduleCache.PlaylistBuilder;
}

describe("PlaylistBuilder", () => {
	beforeEach(() => {
		state.useStateValues = undefined;
		state.useStateIndex = 0;
		state.useStateSetters = [];
		state.runEffects = false;
		state.buttonProps = [];
		state.inputProps = [];
		state.filmstripProps = [];
		state.frameSettingsProps = [];
		moduleCache = null;
	});

	it("renders editing state, duration summary, and child builder boundaries", async () => {
		const PlaylistBuilder = await getPlaylistBuilder();
		const html = renderToStaticMarkup(
			<PlaylistBuilder
				playlist={{
					id: "playlist-1",
					name: "Lobby loop",
					items: [
						{
							id: "frame-1",
							screen_id: "screen-1",
							screen_type: "screen",
							duration: 45,
							order_index: 0,
						},
						{
							id: "frame-2",
							screen_id: "mixup-1",
							screen_type: "mixup",
							duration: 15,
							order_index: 1,
						},
					],
				}}
				recipes={[
					{
						id: "recipe-1",
						slug: "weather",
						type: "react",
						name: "Weather",
						description: null,
						repo: null,
						screenshot_url: null,
						logo_url: null,
						author: null,
						author_github: null,
						author_email: null,
						zip_url: null,
						zip_entry_path: null,
						category: null,
						version: null,
						user_id: null,
						created_at: null,
						updated_at: null,
					},
				]}
				mixups={[
					{
						id: "mixup-1",
						name: "Quarter board",
						layout_id: "quarters",
						created_at: null,
						updated_at: null,
					},
				]}
				screens={[
					{ id: "screen-1", name: "Lobby weather", recipe_name: "Weather" },
				]}
				onSave={() => undefined}
				onCancel={() => undefined}
			/>,
		);

		assert.match(html, /Editing playlist/);
		assert.match(html, /value="Lobby loop"/);
		assert.match(html, /1m loop/);
		assert.match(html, /2 frames/);
		assert.match(html, /data-active-index="0"/);
		assert.match(html, /Lobby weather/);
		assert.match(html, /Quarter board/);
		assert.match(html, /data-frame-index="0"/);
		assert.match(html, /data-filmstrip-active-index="0"/);
		assert.match(html, />Update</);
	});

	it("renders an empty-state builder when there are no frames", async () => {
		const PlaylistBuilder = await getPlaylistBuilder();
		const html = renderToStaticMarkup(
			<PlaylistBuilder
				recipes={[]}
				mixups={[]}
				screens={[]}
				onSave={() => undefined}
				onCancel={() => undefined}
			/>,
		);

		assert.match(html, /New playlist/);
		assert.match(html, /No frame selected/);
		assert.match(html, /Add a frame below to start building your loop\./);
		assert.match(html, /data-filmstrip-frames="\[\]"/);
		assert.match(html, />Create</);
		assert.match(html, /disabled=""/);
	});

	it("keeps missing preview labels stable and uses singular frame copy", async () => {
		const PlaylistBuilder = await getPlaylistBuilder();
		const html = renderToStaticMarkup(
			<PlaylistBuilder
				playlist={{
					id: "playlist-2",
					name: "Fallback loop",
					items: [
						{
							id: "frame-9",
							screen_id: "screen-missing",
							screen_type: "screen",
							duration: 20,
							order_index: 0,
						},
					],
				}}
				recipes={[]}
				mixups={[]}
				screens={[]}
				onSave={() => undefined}
				onCancel={() => undefined}
			/>,
		);

		assert.match(html, /20s loop/);
		assert.match(html, /1 frame/);
		assert.match(html, /screen-missing/);
		assert.match(
			html,
			/data-frames="\[{&quot;id&quot;:&quot;frame-9&quot;,&quot;screen_id&quot;:&quot;screen-missing&quot;,&quot;screen_type&quot;:&quot;screen&quot;,&quot;duration&quot;:20,&quot;label&quot;:&quot;screen-missing&quot;}\]"/,
		);
	});

	it("renders the loading preview branch while keeping the current frame settings contract", async () => {
		state.useStateValues = [
			"Hydrated playlist",
			[
				{
					id: "frame-1",
					screen_id: "recipe-1",
					screen_type: "recipe",
					duration: 30,
					order_index: 0,
				},
			],
			0,
			true,
		];
		const PlaylistBuilder = await getPlaylistBuilder();
		const html = renderToStaticMarkup(
			<PlaylistBuilder
				playlist={{ id: "playlist-3", name: "Needs hydration", items: [] }}
				recipes={[
					{
						id: "recipe-1",
						slug: "calendar",
						type: "react",
						name: "Calendar",
						description: null,
						repo: null,
						screenshot_url: null,
						logo_url: null,
						author: null,
						author_github: null,
						author_email: null,
						zip_url: null,
						zip_entry_path: null,
						category: null,
						version: null,
						user_id: null,
						created_at: null,
						updated_at: null,
					},
				]}
				mixups={[]}
				screens={[]}
				onSave={() => undefined}
				onCancel={() => undefined}
			/>,
		);

		assert.match(html, /Loading playlist/);
		assert.doesNotMatch(html, /live-preview/);
		assert.match(html, /frame-settings/);
		assert.match(html, /data-frame-index="0"/);
		assert.match(html, /&quot;label&quot;:&quot;Recipes&quot;/);
	});

	it("disables cancel and save actions while saving", async () => {
		const PlaylistBuilder = await getPlaylistBuilder();
		const html = renderToStaticMarkup(
			<PlaylistBuilder
				playlist={{
					id: "playlist-4",
					name: "Saving loop",
					items: [
						{
							id: "frame-1",
							screen_id: "screen-1",
							screen_type: "screen",
							duration: 30,
							order_index: 0,
						},
					],
				}}
				recipes={[]}
				mixups={[]}
				screens={[{ id: "screen-1", name: "Screen 1", recipe_name: "Weather" }]}
				onSave={() => undefined}
				onCancel={() => undefined}
				isSaving
			/>,
		);

		assert.match(html, /disabled=""/);
		assert.match(html, />Cancel</);
		assert.match(html, />Update</);
	});

	it("saves trimmed data, appends frames, reorders, deletes, and promotes recipe patches", async () => {
		const onSave = vi.fn();
		const { createScreenIdFromRecipe, promptScreenName } = await import(
			"@/components/common/screen-from-recipe"
		);
		vi.mocked(promptScreenName).mockReturnValue("Promoted weather");
		vi.mocked(createScreenIdFromRecipe).mockResolvedValue("screen-promoted");

		state.useStateValues = [
			"  Saved loop  ",
			[
				{
					id: "frame-1",
					screen_id: "screen-1",
					screen_type: "screen",
					duration: 30,
					order_index: 7,
				},
				{
					id: "frame-2",
					screen_id: "recipe-1",
					screen_type: "recipe",
					duration: 15,
					order_index: 9,
				},
			],
			0,
			false,
		];

		const PlaylistBuilder = await getPlaylistBuilder();
		renderToStaticMarkup(
			<PlaylistBuilder
				playlist={{ id: "playlist-5", name: "Original" }}
				recipes={[
					{
						id: "recipe-1",
						slug: "weather",
						type: "react",
						name: "Weather",
						description: null,
						repo: null,
						screenshot_url: null,
						logo_url: null,
						author: null,
						author_github: null,
						author_email: null,
						zip_url: null,
						zip_entry_path: null,
						category: null,
						version: null,
						user_id: null,
						created_at: null,
						updated_at: null,
					},
				]}
				mixups={[]}
				screens={[{ id: "screen-1", name: "Screen 1", recipe_name: "Weather" }]}
				onSave={onSave}
				onCancel={() => undefined}
			/>,
		);

		const saveButton = state.buttonProps.at(-1);
		assert.ok(saveButton?.onClick);
		const saveClick =
			saveButton.onClick as React.MouseEventHandler<HTMLButtonElement>;
		saveClick({} as React.MouseEvent<HTMLButtonElement>);

		assert.deepEqual(onSave.mock.calls[0]?.[0], {
			id: "playlist-5",
			name: "Saved loop",
			items: [
				{
					id: "frame-1",
					screen_id: "screen-1",
					screen_type: "screen",
					duration: 30,
					order_index: 0,
				},
				{
					id: "frame-2",
					screen_id: "recipe-1",
					screen_type: "recipe",
					duration: 15,
					order_index: 1,
				},
			],
		});

		state.filmstripProps[0]?.onAdd();
		assert.equal(state.useStateSetters[1]?.mock.calls[0]?.[0].length, 3);
		assert.equal(state.useStateSetters[2]?.mock.calls[0]?.[0], 2);

		state.filmstripProps[0]?.onReorder(0, 1);
		const reorderUpdater = state.useStateSetters[1]?.mock.calls[1]?.[0] as (
			items: Array<Record<string, unknown>>,
		) => Array<Record<string, unknown>>;
		assert.deepEqual(
			reorderUpdater([
				{
					id: "frame-1",
					screen_id: "screen-1",
					screen_type: "screen",
					duration: 30,
					order_index: 0,
				},
				{
					id: "frame-2",
					screen_id: "recipe-1",
					screen_type: "recipe",
					duration: 15,
					order_index: 1,
				},
			]),
			[
				{
					id: "frame-2",
					screen_id: "recipe-1",
					screen_type: "recipe",
					duration: 15,
					order_index: 0,
				},
				{
					id: "frame-1",
					screen_id: "screen-1",
					screen_type: "screen",
					duration: 30,
					order_index: 1,
				},
			],
		);
		assert.equal(state.useStateSetters[2]?.mock.calls[1]?.[0], 1);

		await state.frameSettingsProps[0]?.onUpdate("frame-2", {
			screen_type: "recipe",
			screen_id: "recipe-1",
		});
		assert.equal(vi.mocked(promptScreenName).mock.calls[0]?.[0], "Weather");
		assert.deepEqual(vi.mocked(createScreenIdFromRecipe).mock.calls[0], [
			"recipe-1",
			"Promoted weather",
		]);
		const updateUpdater = state.useStateSetters[1]?.mock.calls[2]?.[0] as (
			items: Array<Record<string, unknown>>,
		) => Array<Record<string, unknown>>;
		assert.deepEqual(
			updateUpdater([
				{
					id: "frame-1",
					screen_id: "screen-1",
					screen_type: "screen",
					duration: 30,
					order_index: 0,
				},
				{
					id: "frame-2",
					screen_id: "recipe-1",
					screen_type: "recipe",
					duration: 15,
					order_index: 1,
				},
			])[1],
			{
				id: "frame-2",
				screen_id: "screen-promoted",
				screen_type: "screen",
				duration: 15,
				order_index: 1,
			},
		);

		state.frameSettingsProps[0]?.onDelete("frame-1");
		const deleteUpdater = state.useStateSetters[1]?.mock.calls[3]?.[0] as (
			items: Array<Record<string, unknown>>,
		) => Array<Record<string, unknown>>;
		assert.deepEqual(
			deleteUpdater([
				{
					id: "frame-1",
					screen_id: "screen-1",
					screen_type: "screen",
					duration: 30,
					order_index: 0,
				},
				{
					id: "frame-2",
					screen_id: "screen-promoted",
					screen_type: "screen",
					duration: 15,
					order_index: 1,
				},
			]),
			[
				{
					id: "frame-2",
					screen_id: "screen-promoted",
					screen_type: "screen",
					duration: 15,
					order_index: 0,
				},
			],
		);
	});

	it("hydrates missing playlist items, clamps the active index, and forwards name edits", async () => {
		const { fetchPlaylistWithItems } = await import("@/app/actions/playlist");
		vi.mocked(fetchPlaylistWithItems).mockResolvedValue({
			playlist: {
				id: "playlist-6",
				name: "Hydrated",
				created_at: null,
				updated_at: null,
			},
			items: [
				{
					id: "frame-10",
					playlist_id: "playlist-6",
					screen_type: "recipe",
					screen_id: "recipe-9",
					duration: 25,
					order_index: 0,
					created_at: null,
					start_time: null,
					end_time: null,
					days_of_week: null,
				},
			],
		});

		state.useStateValues = ["Needs hydration", [], 4, false];
		state.runEffects = true;

		const PlaylistBuilder = await getPlaylistBuilder();
		renderToStaticMarkup(
			<PlaylistBuilder
				playlist={{ id: "playlist-6", name: "Needs hydration", items: [] }}
				recipes={[]}
				mixups={[]}
				screens={[]}
				onSave={() => undefined}
				onCancel={() => undefined}
			/>,
		);
		await Promise.resolve();

		assert.deepEqual(vi.mocked(fetchPlaylistWithItems).mock.calls[0], [
			"playlist-6",
		]);
		assert.deepEqual(
			state.useStateSetters[3]?.mock.calls.map((call) => call[0]),
			[true, false],
		);
		assert.equal(state.useStateSetters[0]?.mock.calls[0]?.[0], "Hydrated");
		assert.deepEqual(state.useStateSetters[1]?.mock.calls[0]?.[0], [
			{
				id: "frame-10",
				screen_type: "recipe",
				screen_id: "recipe-9",
				duration: 25,
				order_index: 0,
				start_time: undefined,
				end_time: undefined,
				days_of_week: undefined,
			},
		]);
		assert.equal(state.useStateSetters[2]?.mock.calls[0]?.[0], 0);

		const nameChange = state.inputProps[0]?.onChange;
		assert.ok(nameChange);
		nameChange({ target: { value: "Renamed loop" } });
		assert.equal(state.useStateSetters[0]?.mock.calls[1]?.[0], "Renamed loop");
	});

	it("returns early when recipe promotion is cancelled or cannot create a screen", async () => {
		const { createScreenIdFromRecipe, promptScreenName } = await import(
			"@/components/common/screen-from-recipe"
		);
		const PlaylistBuilder = await getPlaylistBuilder();

		state.useStateValues = [
			"Promo guard",
			[
				{
					id: "frame-1",
					screen_id: "recipe-1",
					screen_type: "recipe",
					duration: 30,
					order_index: 0,
				},
			],
			0,
			false,
		];
		renderToStaticMarkup(
			<PlaylistBuilder
				playlist={{ id: "playlist-7", name: "Promo guard" }}
				recipes={[
					{
						id: "recipe-1",
						slug: "weather",
						type: "react",
						name: "Weather",
						description: null,
						repo: null,
						screenshot_url: null,
						logo_url: null,
						author: null,
						author_github: null,
						author_email: null,
						zip_url: null,
						zip_entry_path: null,
						category: null,
						version: null,
						user_id: null,
						created_at: null,
						updated_at: null,
					},
				]}
				mixups={[]}
				screens={[]}
				onSave={() => undefined}
				onCancel={() => undefined}
			/>,
		);

		vi.mocked(promptScreenName).mockReturnValue(null);
		await state.frameSettingsProps[0]?.onUpdate("frame-1", {
			screen_type: "recipe",
			screen_id: "recipe-1",
		});
		assert.equal(state.useStateSetters[1]?.mock.calls.length, 0);

		vi.mocked(promptScreenName).mockReturnValue("Blocked");
		vi.mocked(createScreenIdFromRecipe).mockResolvedValue(null);
		await state.frameSettingsProps[0]?.onUpdate("frame-1", {
			screen_type: "recipe",
			screen_id: "recipe-1",
		});
		assert.equal(state.useStateSetters[1]?.mock.calls.length, 0);
	});
});
