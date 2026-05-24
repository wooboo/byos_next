/**
 * Fetches a random favorite photo from Immich and returns it as a base64 JPEG.
 * The component handles centering/scaling — no pre-compositing needed.
 */
export default async function getData(
	params?: Record<string, unknown>,
): Promise<{ imageDataUrl: string; assetId: string }> {
	const serverUrl = (
		(params?.serverUrl as string) || "https://immich.lab.zabowka.pl"
	).replace(/\/$/, "");
	const apiKey = (params?.apiKey as string) || process.env.IMMICH_API_KEY;

	if (!apiKey) {
		return { imageDataUrl: "", assetId: "" };
	}

	const headers = {
		"x-api-key": apiKey,
		"Content-Type": "application/json",
		Accept: "application/json",
	};

	try {
		const searchRes = await fetch(`${serverUrl}/api/search/random`, {
			method: "POST",
			headers,
			body: JSON.stringify({ isFavorite: true, size: 1, type: "IMAGE" }),
		});

		if (!searchRes.ok) {
			console.error(`Immich search failed: ${searchRes.status}`);
			return { imageDataUrl: "", assetId: "" };
		}

		const assets = (await searchRes.json()) as Array<{ id: string }>;
		if (!assets?.length) {
			console.warn("No favorite photos in Immich");
			return { imageDataUrl: "", assetId: "" };
		}

		const assetId = assets[0].id;

		// Fetch original, auto-rotate if needed, return as base64 JPEG
		const imgRes = await fetch(
			`${serverUrl}/api/assets/${assetId}/original?apiKey=${encodeURIComponent(apiKey)}`,
		);
		if (!imgRes.ok) {
			console.error(`Immich image fetch failed: ${imgRes.status}`);
			return { imageDataUrl: "", assetId: "" };
		}

		const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

		// Auto-rotate based on EXIF (only if orientation says so)
		const sharpImg = require("sharp")(imgBuffer);
		const meta = await sharpImg.metadata();
		let pipeline = sharpImg;
		if (meta.orientation && meta.orientation >= 5 && meta.orientation <= 8) {
			pipeline = pipeline.rotate();
		}

		const jpeg = await pipeline.jpeg({ quality: 90 }).toBuffer();
		const dataUrl = `data:image/jpeg;base64,${jpeg.toString("base64")}`;

		return { imageDataUrl: dataUrl, assetId };
	} catch (error) {
		console.error("Immich fetch error:", error);
		return { imageDataUrl: "", assetId: "" };
	}
}
