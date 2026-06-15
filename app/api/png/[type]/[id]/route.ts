import type { NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth/get-user";
import { renderRecipeToImage } from "@/lib/recipes/recipe-renderer";
import { resolveRenderableRef } from "@/lib/screens/render-target";
import {
	binaryImageResponse,
	parsePreviewSize,
	recipePreviewPath,
	screenPreviewPath,
} from "../../../bitmap/render-utils";
import {
	parseRequestHeaders,
	resolveUserIdFromApiKey,
} from "../../../display/utils";

type RenderableRef = {
	type: "recipe" | "screen";
	id: string;
};

function resolvePngTargetRef(type: string, id: string): RenderableRef | null {
	const normalizedId = id.replace(".png", "");
	if (type === "recipe" || type === "screen") {
		return { type, id: normalizedId };
	}
	if (!id.endsWith(".png")) return null;
	return {
		type: normalizedId === "default" ? "recipe" : "screen",
		id: normalizedId === "default" ? type : normalizedId,
	};
}

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ type: string; id: string }> },
) {
	const { type, id } = await params;
	const targetRef = resolvePngTargetRef(type, id);
	if (!targetRef) {
		return new Response("Unsupported preview type", { status: 400 });
	}

	const { width, height } = parsePreviewSize(req);
	const headers = parseRequestHeaders(req);
	const userId = headers.apiKey
		? await resolveUserIdFromApiKey(headers.apiKey)
		: await getCurrentUserId();
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
		previewBaseUrl: headers.hostUrl,
		previewPath:
			targetRef.type === "screen"
				? screenPreviewPath(targetRef.id, headers.apiKey)
				: recipePreviewPath(target.recipeSlug),
	});

	if (!renders.png) return new Response("Failed to render", { status: 500 });
	return binaryImageResponse(renders.png, "image/png");
}
