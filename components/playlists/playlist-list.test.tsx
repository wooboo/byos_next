import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "vitest";
import type { Mixup, Playlist, PlaylistItem, Recipe } from "@/lib/types";
import { PlaylistList } from "./playlist-list";

const recipes: Recipe[] = [
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
];

const mixups: Mixup[] = [
	{
		id: "mixup-1",
		name: "Mixed board",
		layout_id: "quarters",
		created_at: null,
		updated_at: null,
	},
];

describe("PlaylistList", () => {
	it("renders the empty state when no playlists exist", () => {
		const html = renderToStaticMarkup(
			<PlaylistList
				playlists={[]}
				playlistItems={[]}
				recipes={recipes}
				mixups={mixups}
				onCreatePlaylist={() => {}}
			/>,
		);

		assert.match(html, /No playlists yet/);
		assert.match(
			html,
			/Create a reel of screens that rotate on your TRMNL devices\./,
		);
		assert.match(html, /Create your first playlist/);
	});

	it("renders playlist cards with items sorted by order index and a create tile", () => {
		const playlists: Playlist[] = [
			{
				id: "playlist-1",
				name: "Daily",
				created_at: null,
				updated_at: null,
			},
		];
		const playlistItems: PlaylistItem[] = [
			{
				id: "item-2",
				playlist_id: "playlist-1",
				screen_id: "mixup-1",
				screen_type: "mixup",
				duration: 30,
				start_time: null,
				end_time: null,
				days_of_week: null,
				order_index: 2,
				created_at: null,
			},
			{
				id: "item-1",
				playlist_id: "playlist-1",
				screen_id: "weather",
				screen_type: "recipe",
				duration: 15,
				start_time: null,
				end_time: null,
				days_of_week: null,
				order_index: 0,
				created_at: null,
			},
		];

		const html = renderToStaticMarkup(
			<PlaylistList
				playlists={playlists}
				playlistItems={playlistItems}
				recipes={recipes}
				mixups={mixups}
				onCreatePlaylist={() => {}}
			/>,
		);

		assert.match(html, /Daily/);
		assert.match(html, /New playlist/);
		assert.ok(html.indexOf("Weather") < html.indexOf("Mixed board"));
	});
});
