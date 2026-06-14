import type { NextRequest } from "next/server";
import { cache } from "react";
import NotFoundScreen from "@/app/(app)/recipes/screens/not-found/not-found";
import { getCurrentUserId } from "@/lib/auth/get-user";
import {
	DEFAULT_IMAGE_HEIGHT,
	DEFAULT_IMAGE_WIDTH,
	logger,
	renderRecipeOutputs,
	renderRecipeToImage,
} from "@/lib/recipes/recipe-renderer";
import { resolveRenderableRef } from "@/lib/screens/render-target";
import {
	binaryImageResponse,
	parsePreviewSize,
	parseRenderPath,
} from "../../bitmap/render-utils";
import {
	parseRequestHeaders,
	resolveUserIdFromApiKey,
} from "../../display/utils";

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ slug?: string[] }> },
) {
	const headers = parseRequestHeaders(req);
	try {
		const { slug = ["not-found"] } = await params;
		const pngPath = Array.isArray(slug) ? slug.join("/") : slug;
		const targetRef = parseRenderPath(slug, "png");
		const { width, height } = parsePreviewSize(req);

		logger.info(`PNG request for: ${pngPath} in ${width}x${height}`);

		const userId = headers.apiKey
			? await resolveUserIdFromApiKey(headers.apiKey)
			: await getCurrentUserId();
		const cookieHeader = req.headers.get("cookie");

		const recipeBuffer = await renderRecipePng(
			targetRef.recipeSlug,
			targetRef.screenId,
			width,
			height,
			userId,
			cookieHeader || undefined,
		);

		if (
			!recipeBuffer ||
			!(recipeBuffer instanceof Buffer) ||
			recipeBuffer.length === 0
		) {
			logger.warn(
				`Failed to generate PNG for ${targetRef.sourcePath}, returning fallback`,
			);
			return await renderFallbackPng();
		}

		return binaryImageResponse(recipeBuffer, "image/png");
	} catch (error) {
		logger.error("Error generating PNG:", error);
		return await renderFallbackPng("Error occurred");
	}
}

const renderRecipePng = cache(
	async (
		recipeId: string,
		screenId: string | null,
		width: number,
		height: number,
		userId: string | null = null,
		cookies?: string,
	) => {
		const target = await resolveRenderableRef({
			type: screenId ? "screen" : "recipe",
			id: screenId ?? recipeId,
			userId,
		});
		const renders = await renderRecipeToImage({
			slug: target?.recipeSlug ?? recipeId,
			imageWidth: width,
			imageHeight: height,
			formats: ["png"],
			userId,
			cookies,
			paramsOverride: target?.params,
			previewPath: screenId ? `/preview/screen/${screenId}?raw=1` : undefined,
		});
		return renders.png ?? Buffer.from([]);
	},
);

const renderFallbackPng = cache(async (slug: string = "not-found") => {
	try {
		const renders = await renderRecipeOutputs({
			slug,
			Component: NotFoundScreen,
			props: { slug },
			config: null,
			imageWidth: DEFAULT_IMAGE_WIDTH,
			imageHeight: DEFAULT_IMAGE_HEIGHT,
			formats: ["png"],
		});

		if (!renders.png) {
			throw new Error("Missing PNG buffer for fallback");
		}

		return binaryImageResponse(renders.png, "image/png");
	} catch (fallbackError) {
		logger.error("Error generating fallback PNG:", fallbackError);
		return new Response("Error generating image", {
			status: 500,
			headers: {
				"Content-Type": "text/plain",
			},
		});
	}
});
