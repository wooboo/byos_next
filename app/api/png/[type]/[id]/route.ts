import type { NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth/get-user";
import { renderRecipeToImage } from "@/lib/recipes/recipe-renderer";
import { resolveRenderableRef } from "@/lib/screens/render-target";
import {
	binaryImageResponse,
	parsePreviewSize,
} from "../../../bitmap/render-utils";

type RenderableRef = {
	type: "recipe" | "screen";
	id: string;
};

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ type: string; id: string }> },
) {
	const { type, id } = await params;
	const normalizedId = id.replace(".png", "");
	let targetRef: RenderableRef | null = null;
	if (type === "recipe" || type === "screen") {
		targetRef = { type, id: normalizedId };
	} else if (id.endsWith(".png")) {
		targetRef = {
			type: normalizedId === "default" ? "recipe" : "screen",
			id: normalizedId === "default" ? type : normalizedId,
		};
	}

	if (!targetRef) {
		return new Response("Unsupported preview type", { status: 400 });
	}

	const { width, height } = parsePreviewSize(req);
	const userId = await getCurrentUserId();
	const target = await resolveRenderableRef({
		type: targetRef.type,
		id: targetRef.id,
		userId,
	});
	if (!target) return new Response("Not found", { status: 404 });

	const renders = await renderRecipeToImage({
		slug: target.recipeSlug,
		imageWidth: width,
		imageHeight: height,
		formats: ["png"],
		userId,
		cookies: req.headers.get("cookie") || undefined,
		paramsOverride: target.params,
		previewPath:
			targetRef.type === "screen"
				? `/preview/screen/${targetRef.id}?raw=1`
				: undefined,
	});

	if (!renders.png) return new Response("Failed to render", { status: 500 });
	return binaryImageResponse(renders.png, "image/png");
}
