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
	const grayscale = parseIntParam(searchParams.get("grayscale")) ?? 16;

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
	return Number.parseInt(searchParams.get("grayscale") || "", 10) || 16;
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
