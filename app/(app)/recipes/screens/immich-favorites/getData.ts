import { createHash } from "node:crypto";
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

const DEFAULT_ROTATION_SECONDS = 15 * 60;
const MIN_ROTATION_SECONDS = 1;
const MAX_ROTATION_SECONDS = 24 * 60 * 60;

type CachedAssetSelection = {
	windowId: number;
	asset: ImmichAsset;
};

const selectedAssetCache = new Map<string, CachedAssetSelection>();

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

function normalizeRotationSeconds(value: unknown): number {
	const parsedSeconds =
		typeof value === "number"
			? value
			: typeof value === "string" && value.trim() !== ""
				? Number(value)
				: DEFAULT_ROTATION_SECONDS;

	if (!Number.isFinite(parsedSeconds)) return DEFAULT_ROTATION_SECONDS;
	return Math.min(
		MAX_ROTATION_SECONDS,
		Math.max(MIN_ROTATION_SECONDS, Math.round(parsedSeconds)),
	);
}

function getRotationWindowId(rotationSeconds: number, now = Date.now()) {
	return Math.floor(now / (rotationSeconds * 1000));
}

function getApiKeySignature(apiKey: string) {
	return createHash("sha256").update(apiKey).digest("hex").slice(0, 16);
}

function getSelectionCacheKey({
	serverUrl,
	apiKey,
	orientationFilter,
	rotationSeconds,
}: {
	serverUrl: string;
	apiKey: string;
	orientationFilter: OrientationFilter;
	rotationSeconds: number;
}) {
	return [
		serverUrl,
		getApiKeySignature(apiKey),
		orientationFilter,
		rotationSeconds,
	].join("|");
}

async function selectFavoriteAsset({
	serverUrl,
	headers,
	apiKey,
	orientationFilter,
	rotationSeconds,
}: {
	serverUrl: string;
	headers: HeadersInit;
	apiKey: string;
	orientationFilter: OrientationFilter;
	rotationSeconds: number;
}): Promise<ImmichAsset | undefined> {
	const windowId = getRotationWindowId(rotationSeconds);
	const cacheKey = getSelectionCacheKey({
		serverUrl,
		apiKey,
		orientationFilter,
		rotationSeconds,
	});
	const cached = selectedAssetCache.get(cacheKey);
	if (cached?.windowId === windowId) return cached.asset;

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
		return undefined;
	}

	const assets = (await searchRes.json()) as ImmichAsset[];
	if (!assets?.length) {
		console.warn("No favorite photos in Immich");
		return undefined;
	}

	const selectedAsset = getAssetByOrientation(assets, orientationFilter);
	if (!selectedAsset?.id) {
		console.warn(
			`No favorite photos matching orientation filter: ${orientationFilter}`,
		);
		return undefined;
	}

	selectedAssetCache.set(cacheKey, { windowId, asset: selectedAsset });
	return selectedAsset;
}

/**
 * Fetches a favorite photo from Immich and returns it as a base64 JPEG.
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
	const rotationSeconds = normalizeRotationSeconds(params?.rotationSeconds);

	if (!apiKey) {
		return { imageDataUrl: "", assetId: "" };
	}

	const headers = {
		"x-api-key": apiKey,
		"Content-Type": "application/json",
		Accept: "application/json",
	};

	try {
		const selectedAsset = await selectFavoriteAsset({
			serverUrl,
			headers,
			apiKey,
			orientationFilter,
			rotationSeconds,
		});
		if (!selectedAsset?.id) {
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
