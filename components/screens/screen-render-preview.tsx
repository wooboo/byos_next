import Image from "next/image";
import { Suspense, use } from "react";
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

function EmptyState({ children }: { children: React.ReactNode }) {
	return (
		<div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-500">
			{children}
		</div>
	);
}

function LoadingState({ label }: { label: string }) {
	return (
		<div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-neutral-500">
			<span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
			{label}
		</div>
	);
}

function ScaledToFit({
	imageWidth,
	imageHeight,
	children,
}: {
	imageWidth: number;
	imageHeight: number;
	children: React.ReactNode;
}) {
	return (
		<div className="absolute inset-0" style={{ containerType: "inline-size" }}>
			<div
				style={{
					width: `${imageWidth}px`,
					height: `${imageHeight}px`,
					transform: `scale(calc(100cqi / ${imageWidth}px))`,
					transformOrigin: "top left",
				}}
			>
				{children}
			</div>
		</div>
	);
}

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
	if (!config) return <EmptyState>Configuration not found</EmptyState>;

	const Component = use(Promise.resolve(fetchRecipeComponent(recipeSlug)));
	if (!Component) return <EmptyState>Component not found</EmptyState>;

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
			<ScaledToFit imageWidth={imageWidth} imageHeight={imageHeight}>
				<Component {...reactProps} />
			</ScaledToFit>
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
		if (!renders.bitmap)
			return <EmptyState>Failed to generate bitmap</EmptyState>;
		return (
			<Image
				width={imageWidth}
				height={imageHeight}
				src={`data:image/bmp;base64,${renders.bitmap.toString("base64")}`}
				style={{ imageRendering: "pixelated" }}
				alt={`${title} BMP render`}
				className="absolute inset-0 h-full w-full object-cover"
			/>
		);
	}

	if (!renders.png) return <EmptyState>Failed to generate PNG</EmptyState>;
	return (
		<Image
			width={imageWidth}
			height={imageHeight}
			src={`data:image/png;base64,${renders.png.toString("base64")}`}
			style={{ imageRendering: "pixelated" }}
			alt={`${title} PNG render`}
			className="absolute inset-0 h-full w-full object-cover"
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
				<Suspense fallback={<LoadingState label="Rendering bitmap…" />}>
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
				<Suspense fallback={<LoadingState label="Rendering PNG…" />}>
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
			reactNode={
				<Suspense fallback={<LoadingState label="Rendering recipe…" />}>
					<ScreenRenderComponent
						screenId={screenId}
						recipeSlug={recipeSlug}
						title={title}
						format="react"
						imageWidth={imageWidth}
						imageHeight={imageHeight}
						paramsOverride={paramsOverride}
						userId={userId}
					/>
				</Suspense>
			}
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
