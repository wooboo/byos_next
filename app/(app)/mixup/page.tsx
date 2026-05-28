import { fetchMixups, fetchRecipes } from "@/app/actions/mixup";
import { listScreens } from "@/app/actions/screens";
import MixupClientPage from "./client-page";

export const metadata = {
	title: "Mixup",
	description: "Compose split-screen layouts with your recipes.",
};

export default async function MixupPage() {
	const [mixups, recipes, screens] = await Promise.all([
		fetchMixups(),
		fetchRecipes(),
		listScreens(),
	]);

	const availableRecipes = recipes.map((r) => ({
		id: r.id,
		slug: r.slug,
		title: r.name,
		description: r.description ?? undefined,
	}));

	return (
		<MixupClientPage
			initialMixups={mixups}
			recipes={availableRecipes}
			screens={screens.map((screen) => ({
				id: screen.id,
				title: screen.name,
				description: screen.recipe_name,
			}))}
		/>
	);
}
