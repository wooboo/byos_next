import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, it, vi } from "vitest";
import type { Mixup, Playlist, PlaylistItem, Recipe } from "@/lib/types";

type StateEntry = {
	value: unknown;
	setter?: ReturnType<typeof vi.fn>;
};

type CapturedListProps = {
	onDeletePlaylist: (playlistId: string) => Promise<void>;
	onEditPlaylist: (playlist: Playlist) => void;
	onCreatePlaylist: () => void;
};

type CapturedBuilderProps = {
	playlist?: {
		id: string;
		name: string;
		items?: Array<{
			id: string;
			screen_id: string;
			screen_type?: string;
			duration: number;
			order_index: number;
			start_time?: string;
			end_time?: string;
			days_of_week?: string[];
		}>;
	};
	onSave: (data: {
		id?: string;
		name: string;
		items: Array<{
			id: string;
			screen_id: string;
			screen_type?: string;
			duration: number;
			order_index: number;
			start_time?: string;
			end_time?: string;
			days_of_week?: string[];
		}>;
	}) => Promise<void>;
	onCancel: () => void;
	isSaving: boolean;
};

const playlistState = vi.hoisted(() => ({
	routerRefresh: vi.fn(),
	listProps: null as CapturedListProps | null,
	builderProps: null as CapturedBuilderProps | null,
}));

const toastState = vi.hoisted(() => ({
	success: vi.fn(),
	error: vi.fn(),
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		refresh: playlistState.routerRefresh,
	}),
}));

vi.mock("sonner", () => ({
	toast: toastState,
}));

vi.mock("@/app/actions/playlist", () => ({
	deletePlaylist: vi.fn(),
	savePlaylistWithItems: vi.fn(),
}));

vi.mock("@/components/playlists/playlist-builder", () => ({
	PlaylistBuilder: (props: CapturedBuilderProps) => {
		playlistState.builderProps = props;
		return <div>playlist-builder</div>;
	},
}));

vi.mock("@/components/playlists/playlist-list", () => ({
	PlaylistList: (props: CapturedListProps) => {
		playlistState.listProps = props;
		return <div>playlist-list</div>;
	},
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({ children }: { children: React.ReactNode }) => (
		<button type="button">{children}</button>
	),
}));

async function loadClientPage(stateEntries: StateEntry[]) {
	vi.resetModules();
	const entries = stateEntries;
	let callIndex = 0;

	vi.doMock("react", async (importOriginal) => {
		const actual = await importOriginal<typeof import("react")>();
		return {
			...actual,
			useState: (initial: unknown) => {
				const resolvedInitial =
					typeof initial === "function"
						? (initial as () => unknown)()
						: initial;
				const entry = entries[callIndex++];
				if (!entry) {
					return [resolvedInitial, vi.fn()] as const;
				}
				return [entry.value, entry.setter ?? vi.fn()] as const;
			},
		};
	});

	return (await import("./client-page.tsx")).default;
}

function buildPlaylist(overrides: Partial<Playlist> = {}): Playlist {
	return {
		id: "playlist-1",
		name: "Morning",
		created_at: null,
		updated_at: null,
		...overrides,
	};
}

function buildPlaylistItem(
	overrides: Partial<PlaylistItem> = {},
): PlaylistItem {
	return {
		id: "item-1",
		playlist_id: "playlist-1",
		screen_id: "screen-1",
		screen_type: "recipe",
		duration: 30,
		start_time: null,
		end_time: null,
		days_of_week: null,
		order_index: 0,
		created_at: null,
		...overrides,
	};
}

function buildRecipe(overrides: Partial<Recipe> = {}): Recipe {
	return {
		id: "recipe-1",
		slug: "weather",
		type: "liquid",
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
		...overrides,
	};
}

afterEach(() => {
	vi.clearAllMocks();
	playlistState.routerRefresh.mockClear();
	playlistState.listProps = null;
	playlistState.builderProps = null;
	toastState.success.mockClear();
	toastState.error.mockClear();
	vi.unstubAllGlobals();
});

describe("Playlists client page handlers", () => {
	it("sorts playlist items before opening the editor", async () => {
		const setShowEditor = vi.fn();
		const setEditingPlaylist = vi.fn();
		const PlaylistsClientPage = await loadClientPage([
			{ value: false, setter: setShowEditor },
			{ value: null, setter: setEditingPlaylist },
			{ value: false },
		]);

		renderToStaticMarkup(
			<PlaylistsClientPage
				initialPlaylists={[buildPlaylist()]}
				initialPlaylistItems={[
					buildPlaylistItem({ id: "item-2", order_index: 2 }),
					buildPlaylistItem({ id: "item-1", order_index: 0 }),
				]}
				recipes={[buildRecipe()]}
				mixups={[] as Mixup[]}
				screens={[]}
			/>,
		);
		playlistState.listProps?.onEditPlaylist(buildPlaylist());

		assert.deepEqual(setEditingPlaylist.mock.calls[0]?.[0], {
			...buildPlaylist(),
			items: [
				buildPlaylistItem({ id: "item-1", order_index: 0 }),
				buildPlaylistItem({ id: "item-2", order_index: 2 }),
			],
		});
		assert.equal(setShowEditor.mock.calls[0]?.[0], true);
	});

	it("opens a new playlist editor from the list create action", async () => {
		const setShowEditor = vi.fn();
		const setEditingPlaylist = vi.fn();
		const PlaylistsClientPage = await loadClientPage([
			{ value: false, setter: setShowEditor },
			{ value: buildPlaylist(), setter: setEditingPlaylist },
			{ value: false },
		]);

		renderToStaticMarkup(
			<PlaylistsClientPage
				initialPlaylists={[]}
				initialPlaylistItems={[]}
				recipes={[buildRecipe()]}
				mixups={[] as Mixup[]}
				screens={[]}
			/>,
		);
		playlistState.listProps?.onCreatePlaylist();

		assert.deepEqual(setEditingPlaylist.mock.calls[0], [null]);
		assert.deepEqual(setShowEditor.mock.calls[0], [true]);
	});

	it("passes normalized editable items and handles cancel from the builder", async () => {
		const setShowEditor = vi.fn();
		const setEditingPlaylist = vi.fn();
		const PlaylistsClientPage = await loadClientPage([
			{ value: true, setter: setShowEditor },
			{
				value: {
					...buildPlaylist(),
					items: [
						buildPlaylistItem({
							id: "item-nullable",
							start_time: null,
							end_time: null,
							days_of_week: null,
						}),
						buildPlaylistItem({
							id: "item-scheduled",
							start_time: "08:00",
							end_time: "09:00",
							days_of_week: ["mon"],
						}),
					],
				},
				setter: setEditingPlaylist,
			},
			{ value: true },
		]);

		renderToStaticMarkup(
			<PlaylistsClientPage
				initialPlaylists={[buildPlaylist()]}
				initialPlaylistItems={[]}
				recipes={[buildRecipe()]}
				mixups={[] as Mixup[]}
				screens={[]}
			/>,
		);

		assert.deepEqual(playlistState.builderProps?.playlist?.items, [
			{
				id: "item-nullable",
				screen_id: "screen-1",
				screen_type: "recipe",
				duration: 30,
				order_index: 0,
				start_time: undefined,
				end_time: undefined,
				days_of_week: undefined,
			},
			{
				id: "item-scheduled",
				screen_id: "screen-1",
				screen_type: "recipe",
				duration: 30,
				order_index: 0,
				start_time: "08:00",
				end_time: "09:00",
				days_of_week: ["mon"],
			},
		]);
		assert.equal(playlistState.builderProps?.isSaving, true);

		playlistState.builderProps?.onCancel();

		assert.deepEqual(setShowEditor.mock.calls[0], [false]);
		assert.deepEqual(setEditingPlaylist.mock.calls[0], [null]);
	});

	it("saves a playlist and refreshes the route on success", async () => {
		const setShowEditor = vi.fn();
		const setEditingPlaylist = vi.fn();
		const setIsLoading = vi.fn();
		const savePlaylistWithItems = vi.mocked(
			(await import("@/app/actions/playlist")).savePlaylistWithItems,
		);
		savePlaylistWithItems.mockResolvedValue({
			success: true,
			playlistId: "playlist-1",
		});

		const PlaylistsClientPage = await loadClientPage([
			{ value: true, setter: setShowEditor },
			{ value: buildPlaylist(), setter: setEditingPlaylist },
			{ value: false, setter: setIsLoading },
		]);

		renderToStaticMarkup(
			<PlaylistsClientPage
				initialPlaylists={[buildPlaylist()]}
				initialPlaylistItems={[]}
				recipes={[buildRecipe()]}
				mixups={[] as Mixup[]}
				screens={[]}
			/>,
		);
		await playlistState.builderProps?.onSave({
			id: "playlist-1",
			name: "Morning",
			items: [],
		});

		assert.equal(
			toastState.success.mock.calls[0]?.[0],
			"Playlist updated successfully!",
		);
		assert.equal(setShowEditor.mock.calls[0]?.[0], false);
		assert.equal(setEditingPlaylist.mock.calls[0]?.[0], null);
		assert.equal(playlistState.routerRefresh.mock.calls.length, 1);
		assert.deepEqual(
			setIsLoading.mock.calls.map((call) => call[0]),
			[true, false],
		);
	});

	it("shows create success text for a new playlist", async () => {
		const savePlaylistWithItems = vi.mocked(
			(await import("@/app/actions/playlist")).savePlaylistWithItems,
		);
		savePlaylistWithItems.mockResolvedValue({
			success: true,
			playlistId: "playlist-new",
		});

		const PlaylistsClientPage = await loadClientPage([
			{ value: true },
			{ value: null },
			{ value: false },
		]);

		renderToStaticMarkup(
			<PlaylistsClientPage
				initialPlaylists={[]}
				initialPlaylistItems={[]}
				recipes={[buildRecipe()]}
				mixups={[] as Mixup[]}
				screens={[]}
			/>,
		);
		await playlistState.builderProps?.onSave({
			name: "Evening",
			items: [],
		});

		assert.equal(
			toastState.success.mock.calls[0]?.[0],
			"Playlist created successfully!",
		);
		assert.equal(playlistState.routerRefresh.mock.calls.length, 1);
	});

	it("deletes a playlist after confirmation and resets editor state", async () => {
		const setShowEditor = vi.fn();
		const setEditingPlaylist = vi.fn();
		const setIsLoading = vi.fn();
		const deletePlaylist = vi.mocked(
			(await import("@/app/actions/playlist")).deletePlaylist,
		);
		deletePlaylist.mockResolvedValue({ success: true });
		vi.stubGlobal(
			"confirm",
			vi.fn(() => true),
		);

		const PlaylistsClientPage = await loadClientPage([
			{ value: false, setter: setShowEditor },
			{ value: buildPlaylist(), setter: setEditingPlaylist },
			{ value: false, setter: setIsLoading },
		]);

		renderToStaticMarkup(
			<PlaylistsClientPage
				initialPlaylists={[buildPlaylist()]}
				initialPlaylistItems={[]}
				recipes={[buildRecipe()]}
				mixups={[] as Mixup[]}
				screens={[]}
			/>,
		);
		await playlistState.listProps?.onDeletePlaylist("playlist-1");

		assert.deepEqual(deletePlaylist.mock.calls[0], ["playlist-1"]);
		assert.equal(
			toastState.success.mock.calls[0]?.[0],
			"Playlist deleted successfully!",
		);
		assert.equal(setShowEditor.mock.calls[0]?.[0], false);
		assert.equal(setEditingPlaylist.mock.calls[0]?.[0], null);
		assert.equal(playlistState.routerRefresh.mock.calls.length, 1);
		assert.deepEqual(
			setIsLoading.mock.calls.map((call) => call[0]),
			[true, false],
		);
	});

	it("shows an error when playlist save fails without closing the editor", async () => {
		const setShowEditor = vi.fn();
		const setEditingPlaylist = vi.fn();
		const setIsLoading = vi.fn();
		const savePlaylistWithItems = vi.mocked(
			(await import("@/app/actions/playlist")).savePlaylistWithItems,
		);
		savePlaylistWithItems.mockResolvedValue({
			success: false,
			error: "screen missing",
		});

		const PlaylistsClientPage = await loadClientPage([
			{ value: true, setter: setShowEditor },
			{ value: buildPlaylist(), setter: setEditingPlaylist },
			{ value: false, setter: setIsLoading },
		]);

		renderToStaticMarkup(
			<PlaylistsClientPage
				initialPlaylists={[buildPlaylist()]}
				initialPlaylistItems={[]}
				recipes={[buildRecipe()]}
				mixups={[] as Mixup[]}
				screens={[]}
			/>,
		);
		await playlistState.builderProps?.onSave({
			id: "playlist-1",
			name: "Morning",
			items: [],
		});

		assert.equal(toastState.error.mock.calls[0]?.[0], "screen missing");
		assert.equal(setShowEditor.mock.calls.length, 0);
		assert.equal(setEditingPlaylist.mock.calls.length, 0);
		assert.equal(playlistState.routerRefresh.mock.calls.length, 0);
		assert.deepEqual(
			setIsLoading.mock.calls.map((call) => call[0]),
			[true, false],
		);
	});

	it("falls back to default save error text and handles save exceptions", async () => {
		const setIsLoading = vi.fn();
		const savePlaylistWithItems = vi.mocked(
			(await import("@/app/actions/playlist")).savePlaylistWithItems,
		);
		savePlaylistWithItems
			.mockResolvedValueOnce({
				success: false,
			})
			.mockRejectedValueOnce(new Error("network down"));
		const errorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);

		const PlaylistsClientPage = await loadClientPage([
			{ value: true },
			{ value: buildPlaylist() },
			{ value: false, setter: setIsLoading },
		]);

		renderToStaticMarkup(
			<PlaylistsClientPage
				initialPlaylists={[buildPlaylist()]}
				initialPlaylistItems={[]}
				recipes={[buildRecipe()]}
				mixups={[] as Mixup[]}
				screens={[]}
			/>,
		);

		await playlistState.builderProps?.onSave({
			id: "playlist-1",
			name: "Morning",
			items: [],
		});
		await playlistState.builderProps?.onSave({
			id: "playlist-1",
			name: "Morning",
			items: [],
		});

		assert.equal(
			toastState.error.mock.calls[0]?.[0],
			"Failed to save playlist",
		);
		assert.equal(
			toastState.error.mock.calls[1]?.[0],
			"An unexpected error occurred",
		);
		assert.equal(errorSpy.mock.calls.length, 1);
		assert.deepEqual(
			setIsLoading.mock.calls.map((call) => call[0]),
			[true, false, true, false],
		);
	});

	it("skips playlist deletion when the confirmation dialog is cancelled", async () => {
		const setIsLoading = vi.fn();
		const deletePlaylist = vi.mocked(
			(await import("@/app/actions/playlist")).deletePlaylist,
		);
		vi.stubGlobal(
			"confirm",
			vi.fn(() => false),
		);

		const PlaylistsClientPage = await loadClientPage([
			{ value: false },
			{ value: null },
			{ value: false, setter: setIsLoading },
		]);

		renderToStaticMarkup(
			<PlaylistsClientPage
				initialPlaylists={[buildPlaylist()]}
				initialPlaylistItems={[]}
				recipes={[buildRecipe()]}
				mixups={[] as Mixup[]}
				screens={[]}
			/>,
		);
		await playlistState.listProps?.onDeletePlaylist("playlist-1");

		assert.equal(deletePlaylist.mock.calls.length, 0);
		assert.equal(setIsLoading.mock.calls.length, 0);
		assert.equal(toastState.success.mock.calls.length, 0);
	});

	it("falls back to default delete error text and handles delete exceptions", async () => {
		const setIsLoading = vi.fn();
		const deletePlaylist = vi.mocked(
			(await import("@/app/actions/playlist")).deletePlaylist,
		);
		deletePlaylist
			.mockResolvedValueOnce({ success: false })
			.mockRejectedValueOnce(new Error("delete failed"));
		vi.stubGlobal(
			"confirm",
			vi.fn(() => true),
		);
		const errorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);

		const PlaylistsClientPage = await loadClientPage([
			{ value: false },
			{ value: null },
			{ value: false, setter: setIsLoading },
		]);

		renderToStaticMarkup(
			<PlaylistsClientPage
				initialPlaylists={[buildPlaylist()]}
				initialPlaylistItems={[]}
				recipes={[buildRecipe()]}
				mixups={[] as Mixup[]}
				screens={[]}
			/>,
		);

		await playlistState.listProps?.onDeletePlaylist("playlist-1");
		await playlistState.listProps?.onDeletePlaylist("playlist-1");

		assert.equal(
			toastState.error.mock.calls[0]?.[0],
			"Failed to delete playlist",
		);
		assert.equal(
			toastState.error.mock.calls[1]?.[0],
			"An unexpected error occurred",
		);
		assert.equal(errorSpy.mock.calls.length, 1);
		assert.deepEqual(
			setIsLoading.mock.calls.map((call) => call[0]),
			[true, false, true, false],
		);
	});
});
