import Link from "next/link";
import { notFound } from "next/navigation";
import { updateNamedScreenParams } from "@/app/actions/screens";
import { PageTemplate } from "@/components/common/page-template";
import { ScreenParamsForm } from "@/components/recipes/screen-params-form";
import { CloneScreenButton } from "@/components/screens/clone-screen-button";
import { DeleteScreenButton } from "@/components/screens/delete-screen-button";
import { ScreenNameForm } from "@/components/screens/screen-name-form";
import { ScreenRenderPreview } from "@/components/screens/screen-render-preview";
import { Button } from "@/components/ui/button";
import { getCurrentUserId } from "@/lib/auth/get-user";
import { withUserScope } from "@/lib/database/scoped-db";
import {
	DEFAULT_IMAGE_HEIGHT,
	DEFAULT_IMAGE_WIDTH,
	fetchRecipeConfig,
} from "@/lib/recipes/recipe-renderer";

async function updateScreenParamsAction(
	id: string,
	params: Record<string, unknown>,
) {
	"use server";
	return updateNamedScreenParams(id, params);
}

export default async function ScreenDetailPage({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ format?: string }>;
}) {
	const { id } = await params;
	const { format } = await searchParams;
	const userId = await getCurrentUserId();
	const isPortrait = format === "portrait";
	const imageWidth = isPortrait ? DEFAULT_IMAGE_HEIGHT : DEFAULT_IMAGE_WIDTH;
	const imageHeight = isPortrait ? DEFAULT_IMAGE_WIDTH : DEFAULT_IMAGE_HEIGHT;
	const screen = await withUserScope((db) =>
		db
			.selectFrom("screens")
			.innerJoin("recipes", "recipes.id", "screens.recipe_id")
			.select([
				"screens.id",
				"screens.name",
				"screens.params",
				"recipes.name as recipe_name",
				"recipes.slug as recipe_slug",
			])
			.where("screens.id", "=", id)
			.executeTakeFirst(),
	);
	if (!screen) notFound();
	const config = await fetchRecipeConfig(screen.recipe_slug);
	const schema = config?.params ?? {};
	const values =
		typeof screen.params === "string"
			? JSON.parse(screen.params)
			: screen.params;
	return (
		<PageTemplate
			title={screen.name}
			subtitle={`Named screen based on ${screen.recipe_name}`}
			left={
				<div className="flex items-center gap-2">
					<Button asChild variant="outline" size="sm">
						<Link href="/screens">Back to list</Link>
					</Button>
					<CloneScreenButton id={screen.id} />
					<DeleteScreenButton id={screen.id} name={screen.name} />
				</div>
			}
		>
			<div className="space-y-6">
				<ScreenRenderPreview
					screenId={screen.id}
					recipeSlug={screen.recipe_slug}
					title={screen.name}
					isPortrait={isPortrait}
					imageWidth={imageWidth}
					imageHeight={imageHeight}
					paramsOverride={values as Record<string, unknown>}
					userId={userId}
				/>
				<ScreenNameForm id={screen.id} initialName={screen.name} />
				<ScreenParamsForm
					slug={screen.id}
					paramsSchema={schema}
					initialValues={values as Record<string, unknown>}
					updateAction={updateScreenParamsAction}
				/>
			</div>
		</PageTemplate>
	);
}
