import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
	useRouter: vi.fn(() => ({
		refresh: vi.fn(),
	})),
}));

vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

vi.mock("@/components/playlists/playlist-builder", () => ({
	PlaylistBuilder: ({
		playlist,
	}: {
		playlist?: { id: string; name: string };
	}) => (
		<div>
			playlist-builder:{playlist ? "edit" : "new"}
			{playlist ? `:${playlist.name}` : ""}
		</div>
	),
}));

vi.mock("@/components/playlists/playlist-list", () => ({
	PlaylistList: ({
		playlists,
	}: {
		playlists: Array<{ id: string; name: string }>;
	}) => <div>playlist-list:{playlists.length}</div>,
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({
		children,
		...props
	}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button {...props}>{children}</button>
	),
}));

type PlaylistClientPageModule = typeof import("./client-page.tsx");
let moduleCache: PlaylistClientPageModule | null = null;

async function getClientPage() {
	if (!moduleCache) {
		moduleCache = await import("./client-page.tsx");
	}
	return moduleCache.default;
}

describe("Playlists client page", () => {
	it("renders empty playlists fallback", async () => {
		const PlaylistsClientPage = await getClientPage();

		const html = renderToStaticMarkup(
			<PlaylistsClientPage
				initialPlaylists={[]}
				initialPlaylistItems={[]}
				recipes={[]}
				mixups={[]}
				screens={[]}
			/>,
		);

		assert.match(html, /playlist-list:0/);
	});

	it("passes populated playlist data to list", async () => {
		const PlaylistsClientPage = await getClientPage();

		const html = renderToStaticMarkup(
			<PlaylistsClientPage
				initialPlaylists={[
					{
						id: "playlist-1",
						name: "News",
						created_at: null,
						updated_at: null,
					},
					{
						id: "playlist-2",
						name: "Weather",
						created_at: null,
						updated_at: null,
					},
				]}
				initialPlaylistItems={[
					{
						id: "item-1",
						playlist_id: "playlist-1",
						screen_id: "weather",
						screen_type: "recipe",
						duration: 30,
						order_index: 0,
						created_at: null,
						start_time: null,
						end_time: null,
						days_of_week: null,
					},
				]}
				recipes={[
					{
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
					},
				]}
				mixups={[]}
				screens={[]}
			/>,
		);

		assert.match(html, /playlist-list:2/);
	});
});
