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

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const headers = parseRequestHeaders(req);
	try {
		const { id } = await params;
		const screenId = id.replace(".bmp", "");
		const { searchParams } = new URL(req.url);
		const width =
			Number.parseInt(searchParams.get("width") || "", 10) ||
			DEFAULT_IMAGE_WIDTH;
		const height =
			Number.parseInt(searchParams.get("height") || "", 10) ||
			DEFAULT_IMAGE_HEIGHT;
		const grayscale =
			Number.parseInt(searchParams.get("grayscale") || "", 10) || 16;
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
		);
		if (!bitmap?.length) return await renderFallbackBitmap(screenId);
		return new Response(new Uint8Array(bitmap), {
			headers: {
				"Content-Type": "image/bmp",
				"Content-Length": bitmap.length.toString(),
			},
		});
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
		});
		return renders.bitmap ?? Buffer.from([]);
	},
);

const renderFallbackBitmap = cache(async (slug: string = "not-found") => {
	const renders = await renderRecipeOutputs({
		slug,
		Component: NotFoundScreen,
		props: { slug },
		config: null,
		imageWidth: DEFAULT_IMAGE_WIDTH,
		imageHeight: DEFAULT_IMAGE_HEIGHT,
		formats: ["bitmap"],
		grayscale: 2,
	});
	if (!renders.bitmap)
		return new Response("Error generating image", { status: 500 });
	return new Response(new Uint8Array(renders.bitmap), {
		headers: {
			"Content-Type": "image/bmp",
			"Content-Length": renders.bitmap.length.toString(),
		},
	});
});
