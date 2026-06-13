"use client";

import { Film, Plus } from "lucide-react";
import { CreateActionTile } from "@/components/common/create-action-tile";
import type { Mixup, Playlist, PlaylistItem, Recipe } from "@/lib/types";
import { PlaylistReelCard } from "./playlist-reel-card";

interface PlaylistListProps {
	playlists: Playlist[];
	playlistItems: PlaylistItem[];
	recipes: Recipe[];
	mixups: Mixup[];
	onEditPlaylist?: (playlist: Playlist) => void;
	onDeletePlaylist?: (playlistId: string) => void;
	onCreatePlaylist?: () => void;
	isLoading?: boolean;
}

export function PlaylistList({
	playlists,
	playlistItems,
	recipes,
	mixups,
	onEditPlaylist,
	onDeletePlaylist,
	onCreatePlaylist,
	isLoading = false,
}: PlaylistListProps) {
	const itemsByPlaylist = playlistItems.reduce<Record<string, PlaylistItem[]>>(
		(acc, item) => {
			if (!item.playlist_id) return acc;
			if (!acc[item.playlist_id]) acc[item.playlist_id] = [];
			acc[item.playlist_id].push(item);
			return acc;
		},
		{},
	);

	const getRecipeName = (screenId: string) => {
		const recipe = recipes.find((r) => r.slug === screenId);
		if (recipe) return recipe.name;
		const mixup = mixups.find((m) => m.id === screenId);
		return mixup?.name || screenId;
	};

	if (playlists.length === 0) {
		return (
			<CreateActionTile
				onClick={onCreatePlaylist}
				icon={<Film className="h-7 w-7" />}
				title="No playlists yet"
				description="Create a reel of screens that rotate on your TRMNL devices."
				actionLabel={
					<>
						<Plus className="h-4 w-4" />
						Create your first playlist
					</>
				}
				className="w-full px-6 py-16 text-base [&_p]:text-sm"
			/>
		);
	}

	return (
		<div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
			{playlists.map((playlist) => {
				const items =
					itemsByPlaylist[playlist.id]
						?.slice()
						.sort(
							(a, b) =>
								(a.order_index ?? Number.MAX_SAFE_INTEGER) -
								(b.order_index ?? Number.MAX_SAFE_INTEGER),
						) || [];

				return (
					<PlaylistReelCard
						key={playlist.id}
						playlist={playlist}
						items={items}
						getRecipeName={getRecipeName}
						onEdit={() => onEditPlaylist?.(playlist)}
						onDelete={() => onDeletePlaylist?.(playlist.id)}
						disabled={isLoading}
					/>
				);
			})}
			{onCreatePlaylist && (
				<CreateActionTile
					onClick={onCreatePlaylist}
					icon={<Plus className="h-6 w-6" />}
					title="New playlist"
					description="Start a new reel from scratch"
					className="min-h-[320px] p-6 text-sm [&_p]:mt-0.5 [&_p]:text-xs"
					iconClassName="h-12 w-12"
				/>
			)}
		</div>
	);
}
