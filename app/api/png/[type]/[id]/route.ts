import type { NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth/get-user";
import {
	DEFAULT_IMAGE_HEIGHT,
	DEFAULT_IMAGE_WIDTH,
	renderRecipeToImage,
} from "@/lib/recipes/recipe-renderer";
import { resolveRenderableRef } from "@/lib/screens/render-target";

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ type: string; id: string }> },
) {
	const { type, id } = await params;
	if (type !== "recipe" && type !== "screen") {
		return new Response("Unsupported preview type", { status: 400 });
	}

	const { searchParams } = new URL(req.url);
	const width =
		Number.parseInt(searchParams.get("width") || "", 10) || DEFAULT_IMAGE_WIDTH;
	const height =
		Number.parseInt(searchParams.get("height") || "", 10) ||
		DEFAULT_IMAGE_HEIGHT;
	const userId = await getCurrentUserId();
	const target = await resolveRenderableRef({ type, id, userId });
	if (!target) return new Response("Not found", { status: 404 });

	const renders = await renderRecipeToImage({
		slug: target.recipeSlug,
		imageWidth: width,
		imageHeight: height,
		formats: ["png"],
		userId,
		paramsOverride: target.params,
	});

	if (!renders.png) return new Response("Failed to render", { status: 500 });
	return new Response(new Uint8Array(renders.png), {
		headers: {
			"Content-Type": "image/png",
			"Content-Length": renders.png.length.toString(),
		},
	});
}
