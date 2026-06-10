import { fetchRecipes } from "@/app/actions/mixup";
import { PageTemplate } from "@/components/common/page-template";
import { CreateScreenForm } from "@/components/screens/create-screen-form";

export default async function NewScreenPage() {
	const recipes = await fetchRecipes();
	return (
		<PageTemplate
			title="New screen"
			subtitle="Choose a recipe and name the configured screen instance. Parameters start as a full snapshot of the recipe defaults."
		>
			<CreateScreenForm
				recipes={recipes.map((recipe) => ({
					id: recipe.id,
					name: recipe.name,
					slug: recipe.slug,
				}))}
			/>
		</PageTemplate>
	);
}
