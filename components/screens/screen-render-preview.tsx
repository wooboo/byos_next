import { Suspense, use } from "react";
import {
	EmptyRenderState,
	RenderLoadingState,
	RenderOutputImage,
	ScaledRenderPreview,
} from "@/components/preview/render-output-preview";
import { RecipePreviewStage } from "@/components/recipes/recipe-preview-stage";
import {
	addDimensionsToProps,
	ComponentProps,
	fetchRecipeComponent,
	fetchRecipeConfig,
	fetchRecipeProps,
	renderRecipeOutputs,
} from "@/lib/recipes/recipe-renderer";

type Format = "bitmap" | "png" | "react";

type ScreenRenderProps = {
	screenId: string;
	recipeSlug: string;
	title: string;
	format: Format;
	imageWidth: number;
	imageHeight: number;
	paramsOverride: Record<string, unknown>;
	userId?: string | null;
};

function ScreenRenderComponent({
	screenId,
	recipeSlug,
	title,
	format,
	imageWidth,
	imageHeight,
	paramsOverride,
	userId,
}: ScreenRenderProps) {
	const config = use(fetchRecipeConfig(recipeSlug, userId ?? undefined));
	if (!config)
		return <EmptyRenderState>Configuration not found</EmptyRenderState>;

	const Component = use(Promise.resolve(fetchRecipeComponent(recipeSlug)));
	if (!Component)
		return <EmptyRenderState>Component not found</EmptyRenderState>;

	const props = use(
		Promise.resolve(
			fetchRecipeProps(
				recipeSlug,
				config,
				undefined,
				userId ?? undefined,
				paramsOverride,
			),
		),
	);
	const propsWithDimensions = addDimensionsToProps(
		props,
		imageWidth,
		imageHeight,
	) as ComponentProps;
	const reactProps =
		recipeSlug === "school-schedule"
			? { ...propsWithDimensions, disableDoubling: true }
			: propsWithDimensions;

	if (format === "react") {
		return (
			<ScaledRenderPreview imageWidth={imageWidth} imageHeight={imageHeight}>
				<Component {...reactProps} />
			</ScaledRenderPreview>
		);
	}

	const renders = use(
		renderRecipeOutputs({
			slug: screenId,
			Component,
			props: propsWithDimensions,
			config,
			imageWidth,
			imageHeight,
			formats: [format === "bitmap" ? "bitmap" : "png"],
		}),
	);

	if (format === "bitmap") {
		return (
			<RenderOutputImage
				format="bitmap"
				image={renders.bitmap}
				title={title}
				imageWidth={imageWidth}
				imageHeight={imageHeight}
			/>
		);
	}

	return (
		<RenderOutputImage
			format="png"
			image={renders.png}
			title={title}
			imageWidth={imageWidth}
			imageHeight={imageHeight}
		/>
	);
}

export function ScreenRenderPreview({
	screenId,
	recipeSlug,
	title,
	isPortrait,
	imageWidth,
	imageHeight,
	paramsOverride,
	userId,
}: {
	screenId: string;
	recipeSlug: string;
	title: string;
	isPortrait: boolean;
	imageWidth: number;
	imageHeight: number;
	paramsOverride: Record<string, unknown>;
	userId?: string | null;
}) {
	return (
		<RecipePreviewStage
			slug={screenId}
			basePath={`/screens/${screenId}`}
			bitmapUrl={`/api/bitmap/screen/${screenId}.bmp`}
			isPortrait={isPortrait}
			bmpNode={
				<Suspense fallback={<RenderLoadingState label="Rendering bitmap…" />}>
					<ScreenRenderComponent
						screenId={screenId}
						recipeSlug={recipeSlug}
						title={title}
						format="bitmap"
						imageWidth={imageWidth}
						imageHeight={imageHeight}
						paramsOverride={paramsOverride}
						userId={userId}
					/>
				</Suspense>
			}
			pngNode={
				<Suspense fallback={<RenderLoadingState label="Rendering PNG…" />}>
					<ScreenRenderComponent
						screenId={screenId}
						recipeSlug={recipeSlug}
						title={title}
						format="png"
						imageWidth={imageWidth}
						imageHeight={imageHeight}
						paramsOverride={paramsOverride}
						userId={userId}
					/>
				</Suspense>
			}
			reactPreviewSrc={`/preview/screen/${screenId}`}
			bmpPipeline={
				<span>
					Screen params → JSX → PNG → render-bmp → /api/bitmap/screen/{screenId}
					.bmp
				</span>
			}
			pngPipeline={<span>Screen params → JSX → PNG</span>}
			reactPipeline={<span>Screen params → React preview</span>}
		/>
	);
}
