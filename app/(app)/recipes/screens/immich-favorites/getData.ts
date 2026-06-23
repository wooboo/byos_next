import sharp from "sharp";

type ImmichAsset = {
	id: string;
	width?: number;
	height?: number;
	originalWidth?: number;
	originalHeight?: number;
	fileName?: string;
};

type OrientationFilter = "any" | "portrait" | "landscape";

function getOrientation(asset: ImmichAsset): OrientationFilter | null {
	const width = asset.width ?? asset.originalWidth;
	const height = asset.height ?? asset.originalHeight;

	if (!width || !height) return null;
	if (height > width) return "portrait";
	if (width > height) return "landscape";
	return null;
}

function getAssetByOrientation(
	assets: ImmichAsset[] = [],
	filter: OrientationFilter,
): ImmichAsset | undefined {
	if (filter === "any") return assets[0];

	for (const asset of assets) {
		const orientation = getOrientation(asset);
		if (orientation === filter) return asset;
	}

	return undefined;
}

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
	const apiKey = params?.apiKey as string;
	const orientationFilter =
		(params?.orientationFilter as OrientationFilter) || "any";

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
			body: JSON.stringify({
				isFavorite: true,
				size: 50,
				type: "IMAGE",
			}),
		});

		if (!searchRes.ok) {
			console.error(`Immich search failed: ${searchRes.status}`);
			return { imageDataUrl: "", assetId: "" };
		}

		const assets = (await searchRes.json()) as ImmichAsset[];
		if (!assets?.length) {
			console.warn("No favorite photos in Immich");
			return { imageDataUrl: "", assetId: "" };
		}

		const selectedAsset = getAssetByOrientation(assets, orientationFilter);
		if (!selectedAsset?.id) {
			console.warn(
				`No favorite photos matching orientation filter: ${orientationFilter}`,
			);
			return { imageDataUrl: "", assetId: "" };
		}

		const assetId = selectedAsset.id;

		// Fetch original, auto-rotate if needed, return as base64 JPEG
		const imgRes = await fetch(
			`${serverUrl}/api/assets/${assetId}/original?apiKey=${encodeURIComponent(apiKey)}`,
		);
		if (!imgRes.ok) {
			console.error(`Immich image fetch failed: ${imgRes.status}`);
			return { imageDataUrl: "", assetId: "" };
		}

		const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

		// Auto-orient all EXIF rotation/mirroring variants before embedding in the recipe.
		const jpeg = await sharp(imgBuffer)
			.rotate()
			.jpeg({ quality: 90 })
			.toBuffer();
		const dataUrl = `data:image/jpeg;base64,${jpeg.toString("base64")}`;

		return { imageDataUrl: dataUrl, assetId };
	} catch (error) {
		console.error("Immich fetch error:", error);
		return { imageDataUrl: "", assetId: "" };
	}
}
