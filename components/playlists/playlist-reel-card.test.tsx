import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "vitest";
import type { Playlist, PlaylistItem } from "@/lib/types";
import { PlaylistReelCard } from "./playlist-reel-card";

const playlist: Playlist = {
	id: "playlist-1",
	name: "Morning Loop",
	created_at: "2026-01-01T00:00:00.000Z",
	updated_at: "2026-01-02T00:00:00.000Z",
};

const items: PlaylistItem[] = [
	{
		id: "item-1",
		playlist_id: "playlist-1",
		screen_id: "weather",
		screen_type: "recipe",
		duration: 30,
		start_time: null,
		end_time: null,
		days_of_week: null,
		order_index: 0,
		created_at: null,
	},
	{
		id: "item-2",
		playlist_id: "playlist-1",
		screen_id: "calendar",
		screen_type: "recipe",
		duration: 45,
		start_time: null,
		end_time: null,
		days_of_week: null,
		order_index: 1,
		created_at: null,
	},
	{
		id: "item-3",
		playlist_id: "playlist-1",
		screen_id: "stocks",
		screen_type: "recipe",
		duration: 60,
		start_time: null,
		end_time: null,
		days_of_week: null,
		order_index: 2,
		created_at: null,
	},
	{
		id: "item-4",
		playlist_id: "playlist-1",
		screen_id: "news",
		screen_type: "recipe",
		duration: 90,
		start_time: null,
		end_time: null,
		days_of_week: null,
		order_index: 3,
		created_at: null,
	},
];

describe("PlaylistReelCard", () => {
	it("renders empty playlists with an explicit call to add frames", () => {
		const html = renderToStaticMarkup(
			<PlaylistReelCard
				playlist={playlist}
				items={[]}
				getRecipeName={(screenId) => screenId}
				onEdit={() => {}}
				onDelete={() => {}}
			/>,
		);

		assert.match(html, /Morning Loop/);
		assert.match(html, /0 frames/);
		assert.match(html, /Empty reel — add frames to start rotating/);
		assert.match(html, />0s</);
	});

	it("renders previews, total loop duration, and visible frame tags", () => {
		const html = renderToStaticMarkup(
			<PlaylistReelCard
				playlist={playlist}
				items={items}
				getRecipeName={(screenId) => `Recipe ${screenId}`}
				onEdit={() => {}}
				onDelete={() => {}}
			/>,
		);

		assert.match(html, /4 frames/);
		assert.match(html, /3m 45s loop/);
		assert.match(html, /Recipe weather/);
		assert.match(html, /Recipe calendar/);
		assert.match(html, /Recipe stocks/);
		assert.match(html, /\+1/);
		assert.match(html, /Delete playlist/);
		assert.match(
			html,
			/\/api\/bitmap\/weather\.bmp\?width=800&amp;height=480&amp;grayscale=16/,
		);
	});
});
