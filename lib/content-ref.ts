export type RenderableContentType = "recipe" | "screen";

export function isUuid(value: string | null | undefined): boolean {
	return (
		!!value &&
		/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
			value,
		)
	);
}

export function resolveRenderableContentType(
	contentType: string | null | undefined,
	contentId: string | null | undefined,
): RenderableContentType {
	return contentType === "screen" || isUuid(contentId) ? "screen" : "recipe";
}
