import type { NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth/get-user";
import { renderRecipeToImage } from "@/lib/recipes/recipe-renderer";
import { resolveRenderableRef } from "@/lib/screens/render-target";
import {
	binaryImageResponse,
	parsePreviewSize,
} from "../../../bitmap/render-utils";

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ type: string; id: string }> },
) {
	const { type, id } = await params;
	if (type !== "recipe" && type !== "screen") {
		return new Response("Unsupported preview type", { status: 400 });
	}

	const { width, height } = parsePreviewSize(req);
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
	return binaryImageResponse(renders.png, "image/png");
}
