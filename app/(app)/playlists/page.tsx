import { Suspense } from "react";
import { fetchMixups, fetchRecipes } from "@/app/actions/mixup";
import { listScreens } from "@/app/actions/screens";
import { PageTemplate } from "@/components/common/page-template";
import { getInitData } from "@/lib/getInitData";
import PlaylistsClientPage from "./client-page";

export const metadata = {
	title: "Playlists",
	description: "Manage your device playlists",
};

export default async function PlaylistsPage() {
	const [{ playlists, playlistItems }, recipes, mixups, screens] =
		await Promise.all([
			getInitData(),
			fetchRecipes(),
			fetchMixups(),
			listScreens(),
		]);

	return (
		<PageTemplate
			title="Playlists"
			subtitle="Create and manage playlists for your TRMNL devices."
		>
			<Suspense fallback={<div>Loading playlists...</div>}>
				<PlaylistsClientPage
					initialPlaylists={playlists}
					initialPlaylistItems={playlistItems}
					recipes={recipes}
					mixups={mixups}
					screens={screens}
				/>
			</Suspense>
		</PageTemplate>
	);
}
