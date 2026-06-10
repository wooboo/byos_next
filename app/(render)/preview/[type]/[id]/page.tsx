import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth/get-user";
import {
	addDimensionsToProps,
	DEFAULT_IMAGE_HEIGHT,
	DEFAULT_IMAGE_WIDTH,
	fetchRecipeComponent,
	fetchRecipeConfig,
	fetchRecipeProps,
} from "@/lib/recipes/recipe-renderer";
import { resolveRenderableRef } from "@/lib/screens/render-target";

export default async function RenderPreviewPage({
	params,
	searchParams,
}: {
	params: Promise<{ type: string; id: string }>;
	searchParams: Promise<{ width?: string; height?: string; mode?: string }>;
}) {
	const { type, id } = await params;
	if (type !== "recipe" && type !== "screen") notFound();
	const { width: widthParam, height: heightParam, mode } = await searchParams;
	const width = Number.parseInt(widthParam || "", 10) || DEFAULT_IMAGE_WIDTH;
	const height = Number.parseInt(heightParam || "", 10) || DEFAULT_IMAGE_HEIGHT;
	const isScrollMode = mode === "scroll";
	const userId = await getCurrentUserId();
	const target = await resolveRenderableRef({ type, id, userId });
	if (!target) notFound();

	const config = await fetchRecipeConfig(
		target.recipeSlug,
		userId ?? undefined,
	);
	if (!config) notFound();
	const Component = await fetchRecipeComponent(target.recipeSlug);
	if (!Component) notFound();
	const props = await fetchRecipeProps(
		target.recipeSlug,
		config,
		undefined,
		userId ?? undefined,
		target.params,
	);
	const propsWithDimensions = addDimensionsToProps(props, width, height);
	const previewProps =
		target.recipeSlug === "school-schedule"
			? { ...propsWithDimensions, disableDoubling: true }
			: propsWithDimensions;

	if (isScrollMode) {
		return (
			<>
				<style>{`
					html, body { overflow: auto; }
				`}</style>
				<div style={{ width: `${width}px`, height: `${height}px` }}>
					<Component {...previewProps} />
				</div>
			</>
		);
	}

	return (
		<div
			className="absolute inset-0 overflow-hidden"
			style={{ containerType: "inline-size" }}
		>
			<style>{`
				html, body { overflow: hidden; }
				::-webkit-scrollbar { display: none !important; }
				* { scrollbar-width: none !important; -ms-overflow-style: none !important; }
			`}</style>
			<div
				style={{
					width: `${width}px`,
					height: `${height}px`,
					transform: `scale(calc(100cqi / ${width}px))`,
					transformOrigin: "top left",
				}}
			>
				<Component {...previewProps} />
			</div>
		</div>
	);
}
