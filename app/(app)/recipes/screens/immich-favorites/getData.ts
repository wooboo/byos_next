import sharp from "sharp";

export type OrientationFilter = "any" | "portrait" | "landscape";

export type ImmichFavoritesParams = {
	serverUrl: string;
	apiKey?: string;
	orientationFilter: OrientationFilter;
	photoRotationSeconds: number;
};

export type ImmichFavoritesData = {
	imageDataUrl: string;
	assetId: string;
	message?: string;
};

type ImmichAsset = {
	id: string;
	width?: number;
	height?: number;
	originalWidth?: number;
	originalHeight?: number;
	fileName?: string;
};

const selectionCache = new Map<string, ImmichFavoritesData>();

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

function cacheKey(params: ImmichFavoritesParams): string | null {
	const seconds = Math.floor(params.photoRotationSeconds);
	if (!Number.isFinite(seconds) || seconds <= 0) return null;
	const bucket = Math.floor(Date.now() / (seconds * 1000));
	return [
		params.serverUrl,
		params.apiKey ? params.apiKey.slice(0, 12) : "",
		params.orientationFilter,
		seconds,
		bucket,
	].join("|");
}

function empty(message: string): ImmichFavoritesData {
	return { imageDataUrl: "", assetId: "", message };
}

/**
 * Fetches a random favorite photo from Immich and returns it as a base64 JPEG.
 * Successful results are cached for `photoRotationSeconds` to avoid changing
 * the image on every preview/device refresh.
 */
export default async function getImmichFavoritesData(
	params: ImmichFavoritesParams,
): Promise<ImmichFavoritesData> {
	const serverUrl = (params.serverUrl || "").replace(/\/$/, "");
	const apiKey = params.apiKey;
	const orientationFilter = params.orientationFilter || "any";
	const key = cacheKey(params);

	if (key) {
		const cached = selectionCache.get(key);
		if (cached) return cached;
	}

	if (!serverUrl) return empty("Missing Immich server URL");
	if (!apiKey) return empty("Missing Immich API key");

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
			return empty(`Immich search failed: ${searchRes.status}`);
		}

		const assets = (await searchRes.json()) as ImmichAsset[];
		if (!assets?.length) {
			return empty("No favorite photos in Immich");
		}

		const selectedAsset = getAssetByOrientation(assets, orientationFilter);
		if (!selectedAsset?.id) {
			return empty(
				`No favorite photos matching orientation filter: ${orientationFilter}`,
			);
		}

		const assetId = selectedAsset.id;
		const imgRes = await fetch(
			`${serverUrl}/api/assets/${assetId}/original?apiKey=${encodeURIComponent(apiKey)}`,
		);
		if (!imgRes.ok) {
			return empty(`Immich image fetch failed: ${imgRes.status}`);
		}

		const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
		const jpeg = await sharp(imgBuffer)
			.rotate()
			.jpeg({ quality: 90 })
			.toBuffer();
		const data: ImmichFavoritesData = {
			imageDataUrl: `data:image/jpeg;base64,${jpeg.toString("base64")}`,
			assetId,
		};
		if (key) selectionCache.set(key, data);
		return data;
	} catch (error) {
		return empty(
			error instanceof Error ? error.message : "Immich favorite fetch failed",
		);
	}
}
