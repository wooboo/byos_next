"use server";

import { revalidatePath } from "next/cache";
import {
	actionErrorResult,
	databaseUnavailableResult,
} from "@/app/actions/action-results";
import { getCurrentUserId } from "@/lib/auth/get-user";
import {
	withUserScope,
	withUserScopeTransaction,
} from "@/lib/database/scoped-db";
import { checkDbConnection } from "@/lib/database/utils";
import type { Playlist, PlaylistItem } from "@/lib/types";

/**
 * Fetch a single playlist with its items
 */
export async function fetchPlaylistWithItems(playlistId: string): Promise<{
	playlist: Playlist | null;
	items: PlaylistItem[];
}> {
	const { ready } = await checkDbConnection();

	if (!ready) {
		console.warn("Database client not initialized");
		return { playlist: null, items: [] };
	}

	const [playlist, items] = await withUserScope((scopedDb) =>
		Promise.all([
			scopedDb
				.selectFrom("playlists")
				.selectAll()
				.where("id", "=", playlistId)
				.executeTakeFirst(),
			scopedDb
				.selectFrom("playlist_items")
				.selectAll()
				.where("playlist_id", "=", playlistId)
				.orderBy("order_index", "asc")
				.execute(),
		]),
	);

	if (!playlist) {
		return { playlist: null, items: [] };
	}

	return {
		playlist: playlist as unknown as Playlist,
		items: items as unknown as PlaylistItem[],
	};
}

/**
 * Delete a playlist and all its items
 */
export async function deletePlaylist(playlistId: string): Promise<{
	success: boolean;
	error?: string;
}> {
	const { ready } = await checkDbConnection();

	if (!ready) {
		return databaseUnavailableResult();
	}

	try {
		await withUserScope((scopedDb) =>
			scopedDb.deleteFrom("playlists").where("id", "=", playlistId).execute(),
		);

		revalidatePath("/playlists");
		return { success: true };
	} catch (error) {
		return actionErrorResult("Error deleting playlist:", error);
	}
}

/**
 * Save a complete playlist with all its items
 */
export async function savePlaylistWithItems(playlistData: {
	id?: string;
	name: string;
	items: Array<{
		id?: string;
		screen_id: string;
		screen_type?: string;
		duration: number;
		order_index: number;
		start_time?: string;
		end_time?: string;
		days_of_week?: string[];
	}>;
}): Promise<{ success: boolean; playlistId?: string; error?: string }> {
	const { ready } = await checkDbConnection();

	if (!ready) {
		return databaseUnavailableResult();
	}

	const userId = await getCurrentUserId();

	try {
		return await withUserScopeTransaction(async (trx) => {
			let playlistId: string;

			// Create or update playlist
			if (playlistData.id) {
				// Update existing playlist (RLS handles user check)
				await trx
					.updateTable("playlists")
					.set({
						name: playlistData.name,
						updated_at: new Date().toISOString(),
					})
					.where("id", "=", playlistData.id)
					.execute();

				playlistId = playlistData.id;

				// Delete existing items
				await trx
					.deleteFrom("playlist_items")
					.where("playlist_id", "=", playlistId)
					.execute();
			} else {
				// Create new playlist (include user_id for new records)
				const newPlaylist = await trx
					.insertInto("playlists")
					.values({ name: playlistData.name, user_id: userId })
					.returning("id")
					.executeTakeFirstOrThrow();

				playlistId = newPlaylist.id;
			}

			// Insert new items
			if (playlistData.items.length > 0) {
				const itemsToInsert = playlistData.items.map((item) => ({
					playlist_id: playlistId,
					screen_type: item.screen_type || "recipe",
					screen_id: item.screen_id,
					duration: item.duration,
					start_time: item.start_time || null,
					end_time: item.end_time || null,
					days_of_week: item.days_of_week
						? JSON.stringify(item.days_of_week)
						: null,
					order_index: item.order_index,
				}));

				await trx.insertInto("playlist_items").values(itemsToInsert).execute();
			}

			revalidatePath("/playlists");
			return { success: true, playlistId };
		});
	} catch (error) {
		return actionErrorResult("Error saving playlist with items:", error);
	}
}
