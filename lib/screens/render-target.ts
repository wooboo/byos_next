import { sql } from "kysely";
import { getScreenParams } from "@/app/actions/screens-params";
import { db } from "@/lib/database/db";
import type { JsonObject } from "@/lib/database/db.d";
import { withExplicitUserScope } from "@/lib/database/scoped-db";
import { checkDbConnection } from "@/lib/database/utils";
import {
	fetchRecipeConfig,
	type RecipeParamDefinitions,
} from "@/lib/recipes/recipe-renderer";

export type RenderRefType = "recipe" | "screen" | "mixup";

export type RenderTarget = {
	type: "recipe" | "screen";
	id: string;
	recipeId: string;
	recipeSlug: string;
	recipeName: string;
	params: Record<string, unknown>;
	sourceName: string;
};

function parseParams(raw: unknown): Record<string, unknown> {
	if (!raw) return {};
	if (typeof raw === "string")
		return JSON.parse(raw) as Record<string, unknown>;
	return raw as Record<string, unknown>;
}

function isUuid(value: string): boolean {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
		value,
	);
}

async function getParamDefinitions(recipeSlug: string, userId?: string | null) {
	const config = await fetchRecipeConfig(recipeSlug, userId ?? undefined);
	return config?.params as RecipeParamDefinitions | undefined;
}

export async function getRecipeDefaultsSnapshot(
	recipeSlug: string,
	userId?: string | null,
) {
	const definitions = await getParamDefinitions(recipeSlug, userId);
	return getScreenParams(recipeSlug, definitions, userId ?? undefined);
}

export async function resolveRecipeByIdOrSlug(
	ref: string,
	userId?: string | null,
) {
	const runQuery = (conn: typeof db) =>
		conn
			.selectFrom("recipes")
			.select(["id", "slug", "name"])
			.where(sql<boolean>`id::text = ${ref} OR slug = ${ref}`)
			.orderBy(sql`CASE WHEN id::text = ${ref} THEN 0 ELSE 1 END`)
			.executeTakeFirst();

	return userId ? withExplicitUserScope(userId, runQuery) : runQuery(db);
}

export async function resolveRenderableRef({
	type,
	id,
	userId,
}: {
	type: "recipe" | "screen";
	id: string;
	userId?: string | null;
}): Promise<RenderTarget | null> {
	const { ready } = await checkDbConnection();
	if (!ready) return null;

	if (type === "screen") {
		if (!isUuid(id)) return null;
		const runQuery = (conn: typeof db) =>
			conn
				.selectFrom("screens")
				.innerJoin("recipes", "recipes.id", "screens.recipe_id")
				.select([
					"screens.id as screen_id",
					"screens.name as screen_name",
					"screens.params as screen_params",
					"recipes.id as recipe_id",
					"recipes.slug as recipe_slug",
					"recipes.name as recipe_name",
				])
				.where("screens.id", "=", id)
				.executeTakeFirst();
		const row = userId
			? await withExplicitUserScope(userId, runQuery)
			: await runQuery(db);
		if (!row) return null;
		const definitions = await getParamDefinitions(row.recipe_slug, userId);
		const snapshot = parseParams(row.screen_params as JsonObject);
		const withFallbacks = {
			...(definitions
				? await getScreenParams(
						row.recipe_slug,
						definitions,
						userId ?? undefined,
					)
				: {}),
			...snapshot,
		};
		return {
			type: "screen",
			id: row.screen_id,
			recipeId: row.recipe_id,
			recipeSlug: row.recipe_slug,
			recipeName: row.recipe_name,
			params: withFallbacks,
			sourceName: row.screen_name,
		};
	}

	const recipe = await resolveRecipeByIdOrSlug(id, userId);
	if (!recipe) return null;
	const params = await getRecipeDefaultsSnapshot(recipe.slug, userId);
	return {
		type: "recipe",
		id: recipe.id,
		recipeId: recipe.id,
		recipeSlug: recipe.slug,
		recipeName: recipe.name,
		params,
		sourceName: recipe.name,
	};
}
