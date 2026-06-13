"use server";

import { revalidatePath } from "next/cache";
import {
	actionErrorResult,
	databaseUnavailableResult,
} from "@/app/actions/action-results";
import { getCurrentUserId } from "@/lib/auth/get-user";
import type { MixupLayoutId as DbMixupLayoutId } from "@/lib/database/db.d";
import {
	withUserScope,
	withUserScopeTransaction,
} from "@/lib/database/scoped-db";
import { checkDbConnection } from "@/lib/database/utils";
import type { Mixup, MixupSlot, Recipe } from "@/lib/types";

/**
 * Fetch all mixups
 */
export async function fetchMixups(): Promise<Mixup[]> {
	const { ready } = await checkDbConnection();

	if (!ready) {
		console.warn("Database client not initialized");
		return [];
	}

	const mixups = await withUserScope((scopedDb) =>
		scopedDb
			.selectFrom("mixups")
			.selectAll()
			.orderBy("created_at", "desc")
			.execute(),
	);

	return mixups as unknown as Mixup[];
}

/**
 * Fetch a single mixup with its slots
 */
export async function fetchMixupWithSlots(mixupId: string): Promise<{
	mixup: Mixup | null;
	slots: MixupSlot[];
}> {
	const { ready } = await checkDbConnection();

	if (!ready) {
		console.warn("Database client not initialized");
		return { mixup: null, slots: [] };
	}

	const [mixup, slots] = await withUserScope((scopedDb) =>
		Promise.all([
			scopedDb
				.selectFrom("mixups")
				.selectAll()
				.where("id", "=", mixupId)
				.executeTakeFirst(),
			scopedDb
				.selectFrom("mixup_slots")
				.selectAll()
				.where("mixup_id", "=", mixupId)
				.orderBy("order_index", "asc")
				.execute(),
		]),
	);

	if (!mixup) {
		return { mixup: null, slots: [] };
	}

	return {
		mixup: mixup as unknown as Mixup,
		slots: slots as unknown as MixupSlot[],
	};
}

/**
 * Create a new mixup
 */
export async function createMixup(
	name: string,
	layoutId: string,
): Promise<{
	success: boolean;
	mixup?: Mixup;
	error?: string;
}> {
	const { ready } = await checkDbConnection();

	if (!ready) {
		return databaseUnavailableResult();
	}

	const userId = await getCurrentUserId();

	try {
		const mixup = await withUserScope((scopedDb) =>
			scopedDb
				.insertInto("mixups")
				.values({
					name,
					layout_id: layoutId as DbMixupLayoutId,
					user_id: userId,
				})
				.returningAll()
				.executeTakeFirst(),
		);

		return { success: true, mixup: mixup as unknown as Mixup };
	} catch (error) {
		return actionErrorResult("Error creating mixup:", error);
	}
}

/**
 * Update a mixup
 */
export async function updateMixup(
	mixupId: string,
	name: string,
	layoutId: string,
): Promise<{ success: boolean; error?: string }> {
	const { ready } = await checkDbConnection();

	if (!ready) {
		return databaseUnavailableResult();
	}

	try {
		await withUserScope((scopedDb) =>
			scopedDb
				.updateTable("mixups")
				.set({
					name,
					layout_id: layoutId as DbMixupLayoutId,
					updated_at: new Date().toISOString(),
				})
				.where("id", "=", mixupId)
				.execute(),
		);

		return { success: true };
	} catch (error) {
		return actionErrorResult("Error updating mixup:", error);
	}
}

/**
 * Delete a mixup and all its slots
 */
export async function deleteMixup(mixupId: string): Promise<{
	success: boolean;
	error?: string;
}> {
	const { ready } = await checkDbConnection();

	if (!ready) {
		return databaseUnavailableResult();
	}

	try {
		await withUserScope((scopedDb) =>
			scopedDb.deleteFrom("mixups").where("id", "=", mixupId).execute(),
		);

		revalidatePath("/mixup");
		return { success: true };
	} catch (error) {
		return actionErrorResult("Error deleting mixup:", error);
	}
}

/**
 * Save a complete mixup with all its slots
 * This is the main function used to save from the builder
 */
export async function saveMixupWithSlots(mixupData: {
	id?: string;
	name: string;
	layout_id: string;
	assignments: Record<string, string>; // slot_id -> recipe_id (UUID)
}): Promise<{ success: boolean; mixupId?: string; error?: string }> {
	const { ready } = await checkDbConnection();

	if (!ready) {
		return databaseUnavailableResult();
	}

	const userId = await getCurrentUserId();

	try {
		return await withUserScopeTransaction(async (trx) => {
			let mixupId: string;

			// Create or update mixup
			if (mixupData.id) {
				// Update existing mixup (RLS handles user check)
				await trx
					.updateTable("mixups")
					.set({
						name: mixupData.name,
						layout_id: mixupData.layout_id as DbMixupLayoutId,
						updated_at: new Date().toISOString(),
					})
					.where("id", "=", mixupData.id)
					.execute();

				mixupId = mixupData.id;

				// Delete existing slots
				await trx
					.deleteFrom("mixup_slots")
					.where("mixup_id", "=", mixupId)
					.execute();
			} else {
				// Create new mixup (include user_id for new records)
				const newMixup = await trx
					.insertInto("mixups")
					.values({
						name: mixupData.name,
						layout_id: mixupData.layout_id as DbMixupLayoutId,
						user_id: userId,
					})
					.returning("id")
					.executeTakeFirstOrThrow();

				mixupId = newMixup.id;
			}

			// Insert new slots
			const slotEntries = Object.entries(mixupData.assignments);
			if (slotEntries.length > 0) {
				const slotsToInsert = slotEntries.map(([slotId, ref], index) => {
					const [kind, id] = ref.includes(":")
						? ref.split(":", 2)
						: ["recipe", ref];
					return {
						mixup_id: mixupId,
						slot_id: slotId,
						recipe_id: kind === "recipe" ? id || null : null,
						ref_type: kind,
						ref_id: id || null,
						order_index: index,
					};
				});

				await trx.insertInto("mixup_slots").values(slotsToInsert).execute();
			}

			revalidatePath("/mixup");
			return { success: true, mixupId };
		});
	} catch (error) {
		return actionErrorResult("Error saving mixup with slots:", error);
	}
}

/**
 * Fetch all recipes visible to the current user (own + shared)
 */
export async function fetchRecipes(): Promise<Recipe[]> {
	const { ready } = await checkDbConnection();

	if (!ready) {
		console.warn("Database client not initialized");
		return [];
	}

	const recipes = await withUserScope((scopedDb) =>
		scopedDb.selectFrom("recipes").selectAll().orderBy("name", "asc").execute(),
	);

	return recipes as unknown as Recipe[];
}
