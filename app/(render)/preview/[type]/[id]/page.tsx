import { notFound } from "next/navigation";
import { resolveUserIdFromApiKey } from "@/app/api/display/utils";
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
	searchParams: Promise<{
		width?: string;
		height?: string;
		mode?: string;
		raw?: string;
		access_token?: string;
	}>;
}) {
	const { type, id } = await params;
	if (type !== "recipe" && type !== "screen") notFound();
	const {
		width: widthParam,
		height: heightParam,
		mode,
		raw,
		access_token: accessToken,
	} = await searchParams;
	const width = Number.parseInt(widthParam || "", 10) || DEFAULT_IMAGE_WIDTH;
	const height = Number.parseInt(heightParam || "", 10) || DEFAULT_IMAGE_HEIGHT;
	const isScrollMode = mode === "scroll";
	const isRawRender = raw === "1";
	const sessionUserId = await getCurrentUserId();
	const userId =
		sessionUserId ??
		(accessToken ? await resolveUserIdFromApiKey(accessToken) : null);
	console.info("[preview-render] preview auth", {
		type,
		id,
		width,
		height,
		raw: isRawRender,
		mode: mode ?? null,
		hasSessionUser: Boolean(sessionUserId),
		hasAccessToken: Boolean(accessToken),
		hasResolvedUser: Boolean(userId),
	});
	const target = await resolveRenderableRef({ type, id, userId });
	if (!target) {
		console.warn("[preview-render] preview target missing", {
			type,
			id,
			hasResolvedUser: Boolean(userId),
		});
		notFound();
	}

	const config = await fetchRecipeConfig(
		target.recipeSlug,
		userId ?? undefined,
	);
	if (!config) {
		console.warn("[preview-render] preview config missing", {
			type,
			id,
			recipeSlug: target.recipeSlug,
			hasResolvedUser: Boolean(userId),
		});
		notFound();
	}
	const Component = await fetchRecipeComponent(target.recipeSlug);
	if (!Component) {
		console.warn("[preview-render] preview component missing", {
			type,
			id,
			recipeSlug: target.recipeSlug,
		});
		notFound();
	}
	const props = await fetchRecipeProps(
		target.recipeSlug,
		config,
		undefined,
		userId ?? undefined,
		target.params,
	);
	console.info("[preview-render] preview resolved", {
		type,
		id,
		recipeSlug: target.recipeSlug,
		targetType: target.type,
		raw: isRawRender,
		hasResolvedUser: Boolean(userId),
	});
	const previewProps = addDimensionsToProps(props, width, height);

	if (isRawRender) {
		return (
			<>
				<style>{`
					html, body { margin: 0; overflow: hidden; }
					::-webkit-scrollbar { display: none !important; }
					* { scrollbar-width: none !important; -ms-overflow-style: none !important; }
				`}</style>
				<Component {...previewProps} />
			</>
		);
	}

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
