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

export async function duplicateScreen(screenId: string, name: string) {
	const userId = await getCurrentUserId();
	if (!userId) return { success: false, error: "You must be signed in" };
	const trimmedName = name.trim();
	if (!trimmedName) return { success: false, error: "Screen name is required" };
	const source = await withUserScope((db) =>
		db
			.selectFrom("screens")
			.select(["recipe_id", "params"])
			.where("id", "=", screenId)
			.executeTakeFirst(),
	);
	if (!source) return { success: false, error: "Screen not found" };
	const [screen] = await withUserScope((db) =>
		db
			.insertInto("screens")
			.values({
				user_id: userId,
				name: trimmedName,
				recipe_id: source.recipe_id,
				params: source.params as JsonObject,
			})
			.returning(["id", "name"])
			.execute(),
	);
	revalidatePath("/screens");
	return { success: true, screen };
}

async function getScreenUsage(screenId: string) {
	return withUserScope(async (db) => {
		const [devices, playlistItems, mixupSlots] = await Promise.all([
			db
				.selectFrom("devices")
				.select(["id", "name"])
				.where("screen_type", "=", "screen")
				.where("screen_id", "=", screenId)
				.execute(),
			db
				.selectFrom("playlist_items")
				.innerJoin("playlists", "playlists.id", "playlist_items.playlist_id")
				.select(["playlist_items.id", "playlists.name"])
				.where("playlist_items.screen_type", "=", "screen")
				.where("playlist_items.screen_id", "=", screenId)
				.execute(),
			db
				.selectFrom("mixup_slots")
				.innerJoin("mixups", "mixups.id", "mixup_slots.mixup_id")
				.select(["mixup_slots.id", "mixups.name"])
				.where("mixup_slots.ref_type", "=", "screen")
				.where("mixup_slots.ref_id", "=", screenId)
				.execute(),
		]);
		return { devices, playlistItems, mixupSlots };
	});
}

export async function deleteScreen(screenId: string) {
	const usage = await getScreenUsage(screenId);
	if (
		usage.devices.length ||
		usage.playlistItems.length ||
		usage.mixupSlots.length
	) {
		return {
			success: false,
			error: "Screen is used and cannot be deleted",
			usage,
		};
	}
	await withUserScope((db) =>
		db.deleteFrom("screens").where("id", "=", screenId).execute(),
	);
	revalidatePath("/screens");
	return { success: true };
}

export async function convertLegacyRecipeAssignments(
	recipeRef: string,
	name: string,
) {
	const userId = await getCurrentUserId();
	if (!userId) return { success: false, error: "You must be signed in" };
	const recipe = await resolveRecipeByIdOrSlug(recipeRef, userId);
	if (!recipe) return { success: false, error: "Recipe not found" };
	const created = await createScreenFromRecipe(recipe.id, name);
	if (!created.success || !created.screen) return created;
	const screenId = created.screen.id;
	await withUserScope(async (db) => {
		await db
			.updateTable("devices")
			.set({ screen_type: "screen", screen_id: screenId })
			.where("screen_type", "=", "recipe")
			.where((eb) =>
				eb.or([
					eb("screen_id", "=", recipe.id),
					eb("screen_id", "=", recipe.slug),
					eb("screen", "=", recipe.slug),
				]),
			)
			.execute();
		await db
			.updateTable("playlist_items")
			.set({ screen_type: "screen", screen_id: screenId })
			.where("screen_type", "=", "recipe")
			.where((eb) =>
				eb.or([
					eb("screen_id", "=", recipe.id),
					eb("screen_id", "=", recipe.slug),
				]),
			)
			.execute();
		await db
			.updateTable("mixup_slots")
			.set({ ref_type: "screen", ref_id: screenId })
			.where("ref_type", "=", "recipe")
			.where((eb) =>
				eb.or([
					eb("ref_id", "=", recipe.id),
					eb("ref_id", "=", recipe.slug),
					eb("recipe_id", "=", recipe.id),
					eb("recipe_slug", "=", recipe.slug),
				]),
			)
			.execute();
	});
	revalidatePath("/");
	return { success: true, screen: created.screen };
}
