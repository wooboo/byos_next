import type { NextRequest } from "next/server";
import {
	DEFAULT_IMAGE_HEIGHT,
	DEFAULT_IMAGE_WIDTH,
	renderRecipeToImage,
} from "@/lib/recipes/recipe-renderer";
import { resolveRenderableRef } from "@/lib/screens/render-target";
import { resolveColorPaletteProfile } from "@/utils/color-palettes";
import type { RgbPalette } from "@/utils/image-processing";
import { DitheringMethod } from "@/utils/render-bmp";

export type RenderSize = {
	width: number;
	height: number;
};

export type BitmapRenderOptions = RenderSize & {
	grayscale: number;
	palette?: RgbPalette;
	ditherPalette?: RgbPalette;
	ditherAnchorPalette?: RgbPalette;
	ditheringMethod?: DitheringMethod;
	bayerPatternSize?: 2 | 4 | 8;
	colorSaturation?: number;
};

type RenderRecipeTargetOptions = RenderSize & {
	recipeId: string;
	screenId: string | null;
	format: "bitmap" | "png";
	grayscale?: number;
	palette?: RgbPalette;
	ditherPalette?: RgbPalette;
	ditherAnchorPalette?: RgbPalette;
	ditheringMethod?: DitheringMethod;
	bayerPatternSize?: 2 | 4 | 8;
	colorSaturation?: number;
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

function parseFloatParam(value: string | null) {
	if (!value) return undefined;
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

const DITHERING_METHOD_ALIASES: Record<string, DitheringMethod> = {
	atkinson: DitheringMethod.ATKINSON,
	bayer: DitheringMethod.BAYER,
	"floyd-steinberg": DitheringMethod.FLOYD_STEINBERG,
	floyd: DitheringMethod.FLOYD_STEINBERG,
	fs: DitheringMethod.FLOYD_STEINBERG,
	"jarvis-judice-ninke": DitheringMethod.JARVIS_JUDICE_NINKE,
	jarvis: DitheringMethod.JARVIS_JUDICE_NINKE,
	jjn: DitheringMethod.JARVIS_JUDICE_NINKE,
	none: DitheringMethod.NONE,
	random: DitheringMethod.RANDOM,
	threshold: DitheringMethod.THRESHOLD,
};

function shouldUseObservedPalette(searchParams: URLSearchParams) {
	const value =
		searchParams.get("palette_preview") ??
		searchParams.get("palettePreview") ??
		searchParams.get("palette_mode");
	return value === "observed" || value === "1" || value === "true";
}

function resolveBitmapPaletteOptions(searchParams: URLSearchParams) {
	const profile = resolveColorPaletteProfile(searchParams.get("palette"));
	if (!profile) return {};
	const useObservedPreview = shouldUseObservedPalette(searchParams);

	return {
		palette: useObservedPreview ? profile.previewColors : profile.colors,
		ditherPalette: profile.ditherColors,
		ditherAnchorPalette: profile.colors,
	};
}

function resolveDitheringMethod(searchParams: URLSearchParams) {
	const value =
		searchParams.get("dithering") ??
		searchParams.get("dithering_method") ??
		searchParams.get("ditheringMethod");
	if (!value) return undefined;
	return DITHERING_METHOD_ALIASES[value.trim().toLowerCase()];
}

function resolveBayerPatternSize(
	searchParams: URLSearchParams,
): 2 | 4 | 8 | undefined {
	const value =
		parseIntParam(searchParams.get("bayer")) ??
		parseIntParam(searchParams.get("bayerPatternSize")) ??
		parseIntParam(searchParams.get("bayer_pattern_size"));
	return value === 2 || value === 4 || value === 8 ? value : undefined;
}

function resolveColorSaturation(searchParams: URLSearchParams) {
	const value =
		parseFloatParam(searchParams.get("saturation")) ??
		parseFloatParam(searchParams.get("colorSaturation")) ??
		parseFloatParam(searchParams.get("color_saturation"));
	if (value === undefined || value < 0 || value > 4) return undefined;
	return value;
}

function resolveBitmapDitheringOptions(searchParams: URLSearchParams) {
	const ditheringMethod = resolveDitheringMethod(searchParams);
	const bayerPatternSize = resolveBayerPatternSize(searchParams);
	const colorSaturation = resolveColorSaturation(searchParams);

	return {
		...(ditheringMethod ? { ditheringMethod } : {}),
		...(bayerPatternSize ? { bayerPatternSize } : {}),
		...(colorSaturation !== undefined ? { colorSaturation } : {}),
	};
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
	const paletteOptions = resolveBitmapPaletteOptions(searchParams);
	const ditheringOptions = resolveBitmapDitheringOptions(searchParams);

	return {
		width: width > 0 ? width : DEFAULT_IMAGE_WIDTH,
		height: height > 0 ? height : DEFAULT_IMAGE_HEIGHT,
		grayscale,
		...paletteOptions,
		...ditheringOptions,
	};
}

export function parseBitmapOptions(req: NextRequest): BitmapRenderOptions {
	const searchParams = getSearchParams(req);
	return {
		width: parseIntParam(searchParams.get("width")) ?? DEFAULT_IMAGE_WIDTH,
		height: parseIntParam(searchParams.get("height")) ?? DEFAULT_IMAGE_HEIGHT,
		grayscale:
			parseIntParam(searchParams.get("bpp")) ??
			parseIntParam(searchParams.get("grayscale")) ??
			16,
		...resolveBitmapPaletteOptions(searchParams),
		...resolveBitmapDitheringOptions(searchParams),
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
	return resolveBitmapPaletteOptions(getSearchParams(req));
}

export function parsePreviewDithering(req: NextRequest) {
	return resolveBitmapDitheringOptions(getSearchParams(req));
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
	ditherPalette,
	ditherAnchorPalette,
	ditheringMethod,
	bayerPatternSize,
	colorSaturation,
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
		...(format === "bitmap" && ditherPalette ? { ditherPalette } : {}),
		...(format === "bitmap" && ditherAnchorPalette
			? { ditherAnchorPalette }
			: {}),
		...(format === "bitmap" && ditheringMethod ? { ditheringMethod } : {}),
		...(format === "bitmap" && bayerPatternSize ? { bayerPatternSize } : {}),
		...(format === "bitmap" && colorSaturation !== undefined
			? { colorSaturation }
			: {}),
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
