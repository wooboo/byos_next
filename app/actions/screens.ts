"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/auth/get-user";
import type { JsonObject } from "@/lib/database/db.d";
import { withUserScope } from "@/lib/database/scoped-db";
import { checkDbConnection } from "@/lib/database/utils";
import {
	getRecipeDefaultsSnapshot,
	resolveRecipeByIdOrSlug,
} from "@/lib/screens/render-target";

export async function listScreens() {
	const { ready } = await checkDbConnection();
	if (!ready) return [];
	return withUserScope((db) =>
		db
			.selectFrom("screens")
			.innerJoin("recipes", "recipes.id", "screens.recipe_id")
			.select([
				"screens.id",
				"screens.name",
				"screens.recipe_id",
				"screens.created_at",
				"screens.updated_at",
				"recipes.name as recipe_name",
				"recipes.slug as recipe_slug",
			])
			.orderBy("screens.updated_at", "desc")
			.execute(),
	);
}

export async function createScreenFromRecipe(recipeRef: string, name: string) {
	const { ready } = await checkDbConnection();
	if (!ready)
		return { success: false, error: "Database client not initialized" };
	const userId = await getCurrentUserId();
	if (!userId) return { success: false, error: "You must be signed in" };
	const recipe = await resolveRecipeByIdOrSlug(recipeRef, userId);
	if (!recipe) return { success: false, error: "Recipe not found" };
	const trimmedName = name.trim();
	if (!trimmedName) return { success: false, error: "Screen name is required" };
	const params = await getRecipeDefaultsSnapshot(recipe.slug, userId);
	const [screen] = await withUserScope((db) =>
		db
			.insertInto("screens")
			.values({
				user_id: userId,
				name: trimmedName,
				recipe_id: recipe.id,
				params: params as JsonObject,
			})
			.returning(["id", "name"])
			.execute(),
	);
	revalidatePath("/screens");
	return { success: true, screen };
}

export async function cloneScreen(screenId: string) {
	const { ready } = await checkDbConnection();
	if (!ready)
		return { success: false, error: "Database client not initialized" };
	const userId = await getCurrentUserId();
	if (!userId) return { success: false, error: "You must be signed in" };

	const source = await withUserScope((db) =>
		db
			.selectFrom("screens")
			.select(["name", "recipe_id", "params"])
			.where("id", "=", screenId)
			.executeTakeFirst(),
	);
	if (!source) return { success: false, error: "Screen not found" };

	const params =
		typeof source.params === "string"
			? (JSON.parse(source.params) as JsonObject)
			: ((source.params ?? {}) as JsonObject);
	const [screen] = await withUserScope((db) =>
		db
			.insertInto("screens")
			.values({
				user_id: userId,
				name: `${source.name} copy`,
				recipe_id: source.recipe_id,
				params,
			})
			.returning(["id", "name"])
			.execute(),
	);
	revalidatePath("/screens");
	revalidatePath(`/screens/${screen.id}`);
	return { success: true, screen };
}

export async function renameScreen(screenId: string, name: string) {
	const trimmedName = name.trim();
	if (!trimmedName) return { success: false, error: "Screen name is required" };
	await withUserScope((db) =>
		db
			.updateTable("screens")
			.set({ name: trimmedName, updated_at: new Date() })
			.where("id", "=", screenId)
			.execute(),
	);
	revalidatePath("/screens");
	revalidatePath(`/screens/${screenId}`);
	return { success: true };
}

export async function deleteScreen(screenId: string) {
	await withUserScope((db) =>
		db.deleteFrom("screens").where("id", "=", screenId).execute(),
	);
	revalidatePath("/screens");
	revalidatePath(`/screens/${screenId}`);
	return { success: true };
}

export async function updateNamedScreenParams(
	screenId: string,
	params: Record<string, unknown>,
) {
	await withUserScope((db) =>
		db
			.updateTable("screens")
			.set({ params: params as JsonObject, updated_at: new Date() })
			.where("id", "=", screenId)
			.execute(),
	);
	revalidatePath(`/screens/${screenId}`);
	revalidatePath(`/api/bitmap/screen/${screenId}.bmp`);
	return { success: true };
}
