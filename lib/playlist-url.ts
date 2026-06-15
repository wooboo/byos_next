import { resolveRenderableContentType } from "./content-ref.ts";

/** Build the correct BMP API URL for a playlist frame (recipe, named screen, or mixup). */
export function playlistFrameBmpUrl(
	screenId: string,
	screenType?: string | null,
	width = 800,
	height = 480,
	grayscale = 16,
): string {
	const contentType = resolveRenderableContentType(screenType, screenId);
	const base =
		screenType === "mixup"
			? `/api/bitmap/mixup/${screenId}.bmp`
			: contentType === "screen"
				? `/api/bitmap/screen/${screenId}.bmp`
				: `/api/bitmap/${screenId}.bmp`;
	const params = new URLSearchParams({
		width: String(width),
		height: String(height),
	});
	if (grayscale) params.set("grayscale", String(grayscale));
	return `${base}?${params}`;
}

/** Build the PNG API URL for a renderable preview. Keep a .png suffix so browser blockers do not flag extensionless image routes. */
export function playlistFramePngUrl(
	screenId: string,
	screenType?: string | null,
	width = 800,
	height = 480,
): string {
	const contentType = resolveRenderableContentType(screenType, screenId);
	const base =
		screenType === "mixup"
			? `/api/png/mixup/${screenId}.png`
			: contentType === "screen"
				? `/api/png/screen/${screenId}.png`
				: `/api/png/${screenId}/default.png`;
	const params = new URLSearchParams({
		width: String(width),
		height: String(height),
	});
	return `${base}?${params}`;
}
