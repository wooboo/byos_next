import type { NextRequest } from "next/server";
import { cache } from "react";
import NotFoundScreen from "@/app/(app)/recipes/screens/not-found/not-found";
import { getCurrentUserId } from "@/lib/auth/get-user";
import {
	DEFAULT_IMAGE_HEIGHT,
	DEFAULT_IMAGE_WIDTH,
	logger,
	renderRecipeOutputs,
} from "@/lib/recipes/recipe-renderer";
import type { RgbPalette } from "@/utils/image-processing";
import {
	parseRequestHeaders,
	resolveUserIdFromApiKey,
} from "../../display/utils";
import {
	binaryImageResponse,
	parsePositiveBitmapOptions,
	parseRenderPath,
	renderRecipeTargetImage,
} from "../render-utils";

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ slug?: string[] }> },
) {
	const headers = parseRequestHeaders(req);
	try {
		// Always await params as required by Next.js 14/15
		const { slug = ["not-found"] } = await params;
		const bitmapPath = Array.isArray(slug) ? slug.join("/") : slug;
		const targetRef = parseRenderPath(slug, "bmp");
		const { width, height, grayscale, palette, ditherPalette } =
			parsePositiveBitmapOptions(req);

		logger.info(
			`Bitmap request for: ${bitmapPath} in ${width}x${height} with ${grayscale} gray levels`,
		);

		// Resolve the device owner so DB queries are scoped to the right user
		const userId = headers.apiKey
			? await resolveUserIdFromApiKey(headers.apiKey)
			: await getCurrentUserId();

		// Forward cookies so browser rendering can reuse the caller's auth session.
		const cookieHeader = req.headers.get("cookie");

		const recipeBuffer = await renderRecipeBitmap(
			targetRef.recipeSlug,
			targetRef.screenId,
			width,
			height,
			grayscale,
			palette,
			ditherPalette,
			userId,
			cookieHeader || undefined,
			headers.hostUrl,
			headers.apiKey,
		);

		if (
			!recipeBuffer ||
			!(recipeBuffer instanceof Buffer) ||
			recipeBuffer.length === 0
		) {
			logger.warn(
				`Failed to generate bitmap for ${targetRef.sourcePath}, returning fallback`,
			);
			const fallback = await renderFallbackBitmap();
			return fallback;
		}

		return binaryImageResponse(recipeBuffer, "image/bmp");
	} catch (error) {
		logger.error("Error generating image:", error);

		// Instead of returning an error, return the NotFoundScreen as a fallback
		return await renderFallbackBitmap("Error occurred");
	}
}

const renderRecipeBitmap = cache(
	(
		recipeId: string,
		screenId: string | null,
		width: number,
		height: number,
		grayscale: number = 16,
		palette: RgbPalette | undefined = undefined,
		ditherPalette: RgbPalette | undefined = undefined,
		userId: string | null = null,
		cookies?: string,
		previewBaseUrl?: string,
		previewAccessToken?: string | null,
	) =>
		renderRecipeTargetImage({
			recipeId,
			screenId,
			width,
			height,
			format: "bitmap",
			grayscale,
			...(palette && { palette }),
			...(ditherPalette && { ditherPalette }),
			userId,
			cookies,
			previewBaseUrl,
			previewAccessToken,
		}),
);

const renderFallbackBitmap = cache(async (slug: string = "not-found") => {
	try {
		const renders = await renderRecipeOutputs({
			slug,
			Component: NotFoundScreen,
			props: { slug },
			config: null,
			imageWidth: DEFAULT_IMAGE_WIDTH,
			imageHeight: DEFAULT_IMAGE_HEIGHT,
			formats: ["bitmap"],
			grayscale: 2, // Default to 2 levels for fallback
		});

		if (!renders.bitmap) {
			throw new Error("Missing bitmap buffer for fallback");
		}

		return binaryImageResponse(renders.bitmap, "image/bmp");
	} catch (fallbackError) {
		logger.error("Error generating fallback image:", fallbackError);
		return new Response("Error generating image", {
			status: 500,
			headers: {
				"Content-Type": "text/plain",
			},
		});
	}
});
