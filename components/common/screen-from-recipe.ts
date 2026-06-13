import { createScreenFromRecipe } from "@/app/actions/screens";

export function promptScreenName(defaultName: string) {
	const name = window.prompt("Name this screen", defaultName);
	if (name === null) return null;

	const trimmed = name.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export async function createScreenIdFromRecipe(recipeId: string, name: string) {
	const result = await createScreenFromRecipe(recipeId, name);
	return result.success && result.screen ? result.screen.id : null;
}
