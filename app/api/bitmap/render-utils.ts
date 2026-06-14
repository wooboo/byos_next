import type { NextRequest } from "next/server";
import {
	DEFAULT_IMAGE_HEIGHT,
	DEFAULT_IMAGE_WIDTH,
} from "@/lib/recipes/recipe-renderer";

export type RenderSize = {
	width: number;
	height: number;
};

export type BitmapRenderOptions = RenderSize & {
	grayscale: number;
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

	return {
		width: width > 0 ? width : DEFAULT_IMAGE_WIDTH,
		height: height > 0 ? height : DEFAULT_IMAGE_HEIGHT,
		grayscale,
	};
}

export function parseBitmapOptions(req: NextRequest): BitmapRenderOptions {
	const searchParams = getSearchParams(req);
	return {
		width: parseIntParam(searchParams.get("width")) ?? DEFAULT_IMAGE_WIDTH,
		height: parseIntParam(searchParams.get("height")) ?? DEFAULT_IMAGE_HEIGHT,
		grayscale: parseIntParam(searchParams.get("grayscale")) ?? 16,
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

export function binaryImageResponse(
	buffer: Buffer,
	contentType: "image/bmp" | "image/png",
) {
	return new Response(new Uint8Array(buffer), {
		headers: {
			"Content-Type": contentType,
			"Content-Length": buffer.length.toString(),
		},
	});
}
