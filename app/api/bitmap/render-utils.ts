import type { NextRequest } from "next/server";
import {
	DEFAULT_IMAGE_HEIGHT,
	DEFAULT_IMAGE_WIDTH,
	renderRecipeToImage,
} from "@/lib/recipes/recipe-renderer";
import { resolveRenderableRef } from "@/lib/screens/render-target";
import { resolveColorPalette } from "@/utils/color-palettes";
import type { RgbPalette } from "@/utils/image-processing";

export type RenderSize = {
	width: number;
	height: number;
};

export type BitmapRenderOptions = RenderSize & {
	grayscale: number;
	palette?: RgbPalette;
};

type RenderRecipeTargetOptions = RenderSize & {
	recipeId: string;
	screenId: string | null;
	format: "bitmap" | "png";
	grayscale?: number;
	palette?: RgbPalette;
	userId: string | null;
	cookies?: string;
	previewBaseUrl?: string;
	previewAccessToken?: string | null;
};

function getSearchParams(req: NextRequest) {
	return new URL(req.url).searchParams;
}

function parseIntParam(value: string | null) {
	return value ? Number.parseInt(value, 10) : undefined;
}

export function parsePositiveBitmapOptions(
	req: NextRequest,
): BitmapRenderOptions {
	const searchParams = getSearchParams(req);
	const width = parseIntParam(searchParams.get("width")) ?? DEFAULT_IMAGE_WIDTH;
	const height =
		parseIntParam(searchParams.get("height")) ?? DEFAULT_IMAGE_HEIGHT;
	const grayscale =
		parseIntParam(searchParams.get("bpp")) ??
		parseIntParam(searchParams.get("grayscale")) ??
		16;
	const palette = resolveColorPalette(searchParams.get("palette"));

	return {
		width: width > 0 ? width : DEFAULT_IMAGE_WIDTH,
		height: height > 0 ? height : DEFAULT_IMAGE_HEIGHT,
		grayscale,
		...(palette && { palette }),
	};
}

export function parseBitmapOptions(req: NextRequest): BitmapRenderOptions {
	const searchParams = getSearchParams(req);
	const palette = resolveColorPalette(searchParams.get("palette"));
	return {
		width: parseIntParam(searchParams.get("width")) ?? DEFAULT_IMAGE_WIDTH,
		height: parseIntParam(searchParams.get("height")) ?? DEFAULT_IMAGE_HEIGHT,
		grayscale:
			parseIntParam(searchParams.get("bpp")) ??
			parseIntParam(searchParams.get("grayscale")) ??
			16,
		...(palette && { palette }),
	};
}

export function parsePreviewSize(req: NextRequest): RenderSize {
	const searchParams = getSearchParams(req);
	return {
		width:
			Number.parseInt(searchParams.get("width") || "", 10) ||
			DEFAULT_IMAGE_WIDTH,
		height:
			Number.parseInt(searchParams.get("height") || "", 10) ||
			DEFAULT_IMAGE_HEIGHT,
	};
}

export function parsePreviewGrayscale(req: NextRequest) {
	const searchParams = getSearchParams(req);
	return (
		parseIntParam(searchParams.get("bpp")) ??
		parseIntParam(searchParams.get("grayscale")) ??
		16
	);
}

export function parseRenderPath(
	segments: string[] | undefined,
	extension: "bmp" | "png",
) {
	const parts = segments?.length ? segments : ["not-found"];
	const rawId = parts.at(-1) ?? "default";
	const id = rawId.endsWith(`.${extension}`)
		? rawId.slice(0, -1 * `.${extension}`.length)
		: rawId;

	if (parts.length >= 2) {
		return {
			recipeSlug: parts.slice(0, -1).join("/"),
			screenId: id === "default" ? null : id,
			sourcePath: parts.join("/"),
		};
	}

	return {
		recipeSlug: id,
		screenId: null,
		sourcePath: parts.join("/"),
	};
}

export function parsePreviewPalette(req: NextRequest) {
	return resolveColorPalette(getSearchParams(req).get("palette"));
}

export function binaryImageResponse(
	buffer: Buffer,
	contentType: "image/bmp" | "image/png",
) {
	return new Response(new Uint8Array(buffer), {
		headers: {
			"Cache-Control": "no-store",
			"Content-Type": contentType,
			"Content-Length": buffer.length.toString(),
		},
	});
}

export function screenPreviewPath(
	screenId: string,
	accessToken?: string | null,
) {
	const path = `/preview/screen/${screenId}`;
	const params = new URLSearchParams({ raw: "1" });
	if (accessToken) params.set("access_token", accessToken);
	return `${path}?${params}`;
}

export function recipePreviewPath(recipeSlug: string) {
	const path = `/preview/recipe/${recipeSlug}`;
	const params = new URLSearchParams({ raw: "1" });
	return `${path}?${params}`;
}

export async function renderRecipeTargetImage({
	recipeId,
	screenId,
	width,
	height,
	format,
	grayscale,
	palette,
	userId,
	cookies,
	previewBaseUrl,
	previewAccessToken,
}: RenderRecipeTargetOptions) {
	const target = await resolveRenderableRef({
		type: screenId ? "screen" : "recipe",
		id: screenId ?? recipeId,
		userId,
	});
	const renders = await renderRecipeToImage({
		slug: target?.recipeSlug ?? recipeId,
		imageWidth: width,
		imageHeight: height,
		formats: [format],
		...(format === "bitmap" && grayscale !== undefined ? { grayscale } : {}),
		...(format === "bitmap" && palette ? { palette } : {}),
		userId,
		cookies,
		paramsOverride: target?.params,
		previewPath: screenId
			? screenPreviewPath(screenId, previewAccessToken)
			: recipePreviewPath(target?.recipeSlug ?? recipeId),
		previewBaseUrl,
	});
	return renders[format] ?? Buffer.from([]);
}
