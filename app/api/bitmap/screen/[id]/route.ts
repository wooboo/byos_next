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
	parseRequestHeaders,
	resolveUserIdFromApiKey,
} from "../../../display/utils";
import {
	binaryImageResponse,
	parsePreviewGrayscale,
	parsePreviewSize,
	screenPreviewPath,
} from "../../render-utils";

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const headers = parseRequestHeaders(req);
	try {
		const { id } = await params;
		const screenId = id.replace(".bmp", "");
		const { width, height } = parsePreviewSize(req);
		const grayscale = parsePreviewGrayscale(req);
		const userId = headers.apiKey
			? await resolveUserIdFromApiKey(headers.apiKey)
			: await getCurrentUserId();
		const cookieHeader = req.headers.get("cookie") || undefined;

		const bitmap = await renderScreenBitmap(
			screenId,
			width,
			height,
			grayscale,
			userId,
			cookieHeader,
			headers.hostUrl,
			headers.apiKey,
		);
		if (!bitmap?.length)
			return await renderFallbackBitmap(screenId, width, height, grayscale);
		return binaryImageResponse(bitmap, "image/bmp");
	} catch (error) {
		logger.error("Error generating screen bitmap:", error);
		return await renderFallbackBitmap("screen");
	}
}

const renderScreenBitmap = cache(
	async (
		screenId: string,
		width: number,
		height: number,
		grayscale: number,
		userId: string | null,
		cookies?: string,
		previewBaseUrl?: string,
		previewAccessToken?: string | null,
	) => {
		const target = await resolveRenderableRef({
			type: "screen",
			id: screenId,
			userId,
		});
		if (!target) return Buffer.from([]);
		const renders = await renderRecipeToImage({
			slug: target.recipeSlug,
			imageWidth: width,
			imageHeight: height,
			formats: ["bitmap"],
			grayscale,
			userId,
			cookies,
			paramsOverride: target.params,
			previewPath: screenPreviewPath(screenId, previewAccessToken),
			previewBaseUrl,
		});
		return renders.bitmap ?? Buffer.from([]);
	},
);

const renderFallbackBitmap = cache(
	async (
		slug: string = "not-found",
		width: number = DEFAULT_IMAGE_WIDTH,
		height: number = DEFAULT_IMAGE_HEIGHT,
		grayscale: number = 2,
	) => {
		const renders = await renderRecipeOutputs({
			slug,
			Component: NotFoundScreen,
			props: { slug },
			config: null,
			imageWidth: width,
			imageHeight: height,
			formats: ["bitmap"],
			grayscale,
		});
		if (!renders.bitmap)
			return new Response("Error generating image", { status: 500 });
		return binaryImageResponse(renders.bitmap, "image/bmp");
	},
);
