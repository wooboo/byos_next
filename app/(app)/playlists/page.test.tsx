import assert from "node:assert/strict";
import type React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";
import type { Mixup, Playlist, PlaylistItem, Recipe } from "@/lib/types";

type PlaylistScreen = { id: string; name: string; recipe_name: string };

type InitData = {
	playlists: Playlist[];
	playlistItems: PlaylistItem[];
};

type CapturedClientProps = {
	initialPlaylists: Playlist[];
	initialPlaylistItems: PlaylistItem[];
	recipes: Recipe[];
	mixups: Mixup[];
	screens: PlaylistScreen[];
};

const playlistsState = vi.hoisted(() => ({
	initData: {
		playlists: [] as Playlist[],
		playlistItems: [] as PlaylistItem[],
	} as InitData,
	recipes: [] as Recipe[],
	mixups: [] as Mixup[],
	screens: [] as PlaylistScreen[],
	capturedClientProps: null as CapturedClientProps | null,
}));

vi.mock("@/lib/getInitData", () => ({
	getInitData: vi.fn(async () => playlistsState.initData),
}));

vi.mock("@/app/actions/mixup", () => ({
	fetchMixups: vi.fn(async () => playlistsState.mixups),
	fetchRecipes: vi.fn(async () => playlistsState.recipes),
}));

vi.mock("@/app/actions/screens", () => ({
	listScreens: vi.fn(async () => playlistsState.screens),
}));

vi.mock("@/components/common/page-template", () => ({
	PageTemplate: ({
		title,
		subtitle,
		children,
	}: {
		title: string;
		subtitle: string;
		children: React.ReactNode;
	}) => (
		<div data-title={title} data-subtitle={subtitle}>
			{children}
		</div>
	),
}));

vi.mock("./client-page", () => ({
	default: (props: CapturedClientProps) => {
		playlistsState.capturedClientProps = props;
		return <div>playlists-client:{JSON.stringify(props)}</div>;
	},
}));

type PlaylistsPageModule = typeof import("./page.tsx").default;
let pageCache: PlaylistsPageModule | null = null;

async function getPage() {
	if (!pageCache) {
		pageCache = (await import("./page.tsx")).default;
	}
	return pageCache;
}

describe("Playlists page", () => {
	it("passes empty init data to client component", async () => {
		playlistsState.initData = {
			playlists: [],
			playlistItems: [],
		};
		playlistsState.recipes = [];
		playlistsState.mixups = [];
		playlistsState.screens = [];
		playlistsState.capturedClientProps = null;

		const PlaylistsPage = await getPage();
		const _html = renderToStaticMarkup(await PlaylistsPage());

		assert.match(_html, /playlists-client:/);
		assert.deepEqual(playlistsState.capturedClientProps, {
			initialPlaylists: [],
			initialPlaylistItems: [],
			recipes: [],
			mixups: [],
			screens: [],
		});
	});

	it("passes populated data to client component", async () => {
		playlistsState.initData = {
			playlists: [
				{
					id: "playlist-1",
					name: "Morning",
					created_at: null,
					updated_at: null,
				},
			],
			playlistItems: [
				{
					id: "item-1",
					playlist_id: "playlist-1",
					screen_id: "screen-1",
					screen_type: "recipe",
					duration: 30,
					order_index: 0,
					created_at: null,
					start_time: null,
					end_time: null,
					days_of_week: null,
				},
			],
		};
		playlistsState.recipes = [
			{
				id: "recipe-1",
				slug: "weather",
				name: "Weather",
				type: "liquid",
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
		];
		playlistsState.mixups = [
			{
				id: "mixup-1",
				name: "Split",
				layout_id: "full",
				created_at: null,
				updated_at: null,
			},
		];
		playlistsState.screens = [
			{ id: "screen-1", name: "Living room", recipe_name: "weather" },
		];
		playlistsState.capturedClientProps = null;

		const PlaylistsPage = await getPage();
		const _html = renderToStaticMarkup(await PlaylistsPage());

		assert.deepEqual(playlistsState.capturedClientProps, {
			initialPlaylists: playlistsState.initData.playlists,
			initialPlaylistItems: playlistsState.initData.playlistItems,
			recipes: playlistsState.recipes,
			mixups: playlistsState.mixups,
			screens: playlistsState.screens,
		});
	});
});
