/** Build the correct BMP API URL for a playlist frame (recipe or mixup). */
export function playlistFrameBmpUrl(
	screenId: string,
	screenType?: string | null,
	width = 800,
	height = 480,
	grayscale = 16,
): string {
	const base =
		screenType === "mixup"
			? `/api/bitmap/mixup/${screenId}.bmp`
			: `/api/bitmap/${screenId}.bmp`;
	const params = new URLSearchParams({
		width: String(width),
		height: String(height),
	});
	if (grayscale) params.set("grayscale", String(grayscale));
	return `${base}?${params}`;
}
