import { NextResponse } from "next/server";
import { resolveRenderableContentType } from "@/lib/content-ref";
import { db } from "@/lib/database/db";
import { checkDbConnection } from "@/lib/database/utils";
import { getLatestFirmware, isUpdateAvailable } from "@/lib/firmware";
import { logError, logInfo } from "@/lib/logger";
import { DeviceDisplayMode } from "@/lib/mixup/constants";
import {
	DEFAULT_IMAGE_HEIGHT,
	DEFAULT_IMAGE_WIDTH,
} from "@/lib/recipes/recipe-renderer";
import type { RefreshSchedule } from "@/lib/types";
import { DEFAULT_REFRESH_RATE, DEFAULT_SCREEN } from "./constants";
import {
	buildDisplayResponse,
	buildErrorResponse,
	calculateRefreshRate,
	findOrCreateDevice,
	getActivePlaylistItem,
	parseRequestHeaders,
	precacheImageInBackground,
	updateDeviceStatus,
} from "./utils";

/**
 * Map grayscale value from database to number of gray levels
 * Valid values: 2, 4, 16, or 256. Defaults to 2 if invalid.
 */
function getGrayscaleLevels(grayscale: number | null | undefined): number {
	if (
		grayscale === 2 ||
		grayscale === 4 ||
		grayscale === 16 ||
		grayscale === 256
	) {
		return grayscale;
	}
	return 2; // Default to 2 levels (black/white)
}

type DisplayHeaders = ReturnType<typeof parseRequestHeaders>;
type DisplayDevice = NonNullable<
	Awaited<ReturnType<typeof findOrCreateDevice>>
>;

type DisplayContent = {
	imageUrl: string;
	refreshRate: number;
	screenToDisplay: string | null | undefined;
};

function buildMissingAccessTokenResponse() {
	return NextResponse.json(
		{
			status: 401,
			error: "Access-Token header is required",
		},
		{ status: 401 },
	);
}

function buildNoDbDisplayResponse(
	headers: DisplayHeaders,
	baseUrl: string,
	uniqueId: string,
) {
	console.warn("Database client not initialized, using noDB mode");
	logInfo("Database client not initialized, using noDB mode", {
		source: "api/display",
		metadata: { headers },
	});

	const width = headers.width || DEFAULT_IMAGE_WIDTH;
	const height = headers.height || DEFAULT_IMAGE_HEIGHT;
	const noDbQueryParams = `width=${width}&height=${height}&grayscale=16${headers.base64 ? "&base64=true" : ""}`;

	return buildDisplayResponse(
		`${baseUrl}/${DEFAULT_SCREEN}.bmp?${noDbQueryParams}`,
		`${DEFAULT_SCREEN}_${uniqueId}.bmp`,
		DEFAULT_REFRESH_RATE,
	);
}

function getHeaderOrDeviceDimension(
	headerValue: number | null | undefined,
	deviceValue: number | null | undefined,
	fallback: number,
) {
	return headerValue ?? deviceValue ?? fallback;
}

function getDeviceDimensions(device: DisplayDevice, headers: DisplayHeaders) {
	const orientation = device.screen_orientation || "landscape";
	const isLandscape = orientation === "landscape";
	const storedWidth = isLandscape ? device.screen_width : device.screen_height;
	const storedHeight = isLandscape ? device.screen_height : device.screen_width;

	return {
		height: getHeaderOrDeviceDimension(
			headers.height,
			storedHeight,
			DEFAULT_IMAGE_HEIGHT,
		),
		orientation,
		width: getHeaderOrDeviceDimension(
			headers.width,
			storedWidth,
			DEFAULT_IMAGE_WIDTH,
		),
	};
}

function buildBaseQueryParams(
	device: DisplayDevice,
	headers: DisplayHeaders,
	width: number,
	height: number,
) {
	const grayscaleLevels = getGrayscaleLevels(device.grayscale);
	return `width=${width}&height=${height}&grayscale=${grayscaleLevels}${headers.base64 ? "&base64=true" : ""}`;
}

function getSingleScreenTarget(device: DisplayDevice) {
	const screenId = device.screen_id || device.screen || "not-found";
	const screenType = resolveRenderableContentType(device.screen_type, screenId);
	const screenPath = screenType === "screen" ? `screen/${screenId}` : screenId;
	const needsAccessToken = screenType === "screen";

	return { needsAccessToken, screenId, screenPath };
}

function appendAccessTokenForProtectedScreen(
	imageUrl: string,
	needsAccessToken: boolean,
	accessTokenParam: string,
) {
	return needsAccessToken ? `${imageUrl}&${accessTokenParam}` : imageUrl;
}

function resolveActivePlaylistItemDisplayContent(
	activeItem: NonNullable<Awaited<ReturnType<typeof getActivePlaylistItem>>>,
	baseUrl: string,
	baseQueryParams: string,
	accessTokenParam: string,
): DisplayContent {
	if (activeItem.screen_type === "mixup") {
		return {
			imageUrl: `${baseUrl}/mixup/${activeItem.screen_id}.bmp?${baseQueryParams}&${accessTokenParam}`,
			refreshRate: Math.max(activeItem.duration, 30),
			screenToDisplay: activeItem.screen_id,
		};
	}

	if (activeItem.screen_type === "screen") {
		return {
			imageUrl: `${baseUrl}/screen/${activeItem.screen_id}.bmp?${baseQueryParams}&${accessTokenParam}`,
			refreshRate: activeItem.duration,
			screenToDisplay: activeItem.screen_id,
		};
	}

	return {
		imageUrl: `${baseUrl}/${activeItem.screen_id}.bmp?${baseQueryParams}`,
		refreshRate: activeItem.duration,
		screenToDisplay: activeItem.screen_id,
	};
}

async function resolvePlaylistDisplayContent(
	device: DisplayDevice,
	baseUrl: string,
	baseQueryParams: string,
	accessTokenParam: string,
): Promise<DisplayContent> {
	const fallbackScreen = device.screen || "not-found";

	if (!device.playlist_id) {
		return {
			imageUrl: `${baseUrl}/${fallbackScreen}.bmp?${baseQueryParams}`,
			refreshRate: 180,
			screenToDisplay: fallbackScreen,
		};
	}

	const activeItem = await getActivePlaylistItem(
		device.playlist_id,
		device.current_playlist_index || 0,
		device.timezone || "UTC",
		device.user_id,
	);

	if (!activeItem) {
		logInfo("No active playlist item found, using fallback", {
			source: "api/display",
			metadata: { deviceId: device.friendly_id },
		});

		return {
			imageUrl: `${baseUrl}/${fallbackScreen}.bmp?${baseQueryParams}`,
			refreshRate: 60,
			screenToDisplay: fallbackScreen,
		};
	}

	await db
		.updateTable("devices")
		.set({ current_playlist_index: activeItem.order_index })
		.where("id", "=", device.id.toString())
		.execute();

	return resolveActivePlaylistItemDisplayContent(
		activeItem,
		baseUrl,
		baseQueryParams,
		accessTokenParam,
	);
}

function resolveMixupDisplayContent(
	device: DisplayDevice,
	baseUrl: string,
	baseQueryParams: string,
	accessTokenParam: string,
): DisplayContent {
	const { needsAccessToken, screenId, screenPath } =
		getSingleScreenTarget(device);
	const refreshRate = calculateRefreshRate(
		device.refresh_schedule as unknown as RefreshSchedule,
		180,
		device.timezone || "UTC",
	);

	if (!device.mixup_id) {
		const imageUrl = `${baseUrl}/${screenPath}.bmp?${baseQueryParams}`;
		return {
			imageUrl: appendAccessTokenForProtectedScreen(
				imageUrl,
				needsAccessToken,
				accessTokenParam,
			),
			refreshRate,
			screenToDisplay: screenId,
		};
	}

	logInfo("Using mixup display mode", {
		source: "api/display",
		metadata: {
			deviceId: device.friendly_id,
			mixupId: device.mixup_id,
		},
	});

	return {
		imageUrl: `${baseUrl}/mixup/${device.mixup_id}.bmp?${baseQueryParams}&${accessTokenParam}`,
		refreshRate,
		screenToDisplay: device.screen,
	};
}

function resolveSingleScreenDisplayContent(
	device: DisplayDevice,
	baseUrl: string,
	baseQueryParams: string,
	accessTokenParam: string,
): DisplayContent {
	const { needsAccessToken, screenId, screenPath } =
		getSingleScreenTarget(device);
	const refreshRate = calculateRefreshRate(
		device.refresh_schedule as unknown as RefreshSchedule,
		180,
		device.timezone || "UTC",
	);
	const imageUrl = `${baseUrl}/${screenPath}.bmp?${baseQueryParams}`;

	return {
		imageUrl: appendAccessTokenForProtectedScreen(
			imageUrl,
			needsAccessToken,
			accessTokenParam,
		),
		refreshRate,
		screenToDisplay: screenId,
	};
}

async function resolveDisplayContent(
	device: DisplayDevice,
	headers: DisplayHeaders,
	baseUrl: string,
	apiKey: string,
): Promise<DisplayContent> {
	const { height, width } = getDeviceDimensions(device, headers);
	const baseQueryParams = buildBaseQueryParams(device, headers, width, height);
	const accessTokenParam = `access_token=${encodeURIComponent(apiKey)}`;

	switch (device.display_mode) {
		case DeviceDisplayMode.PLAYLIST:
			return resolvePlaylistDisplayContent(
				device,
				baseUrl,
				baseQueryParams,
				accessTokenParam,
			);
		case DeviceDisplayMode.MIXUP:
			return resolveMixupDisplayContent(
				device,
				baseUrl,
				baseQueryParams,
				accessTokenParam,
			);
		default:
			return resolveSingleScreenDisplayContent(
				device,
				baseUrl,
				baseQueryParams,
				accessTokenParam,
			);
	}
}

async function buildFirmwareExtra(device: DisplayDevice, orientation: string) {
	const latestFirmware = await getLatestFirmware();
	const firmwareExtra: Record<string, unknown> = {
		// Tell the firmware how to rotate the panel. The TRMNL panel is
		// portrait-native, so a landscape orientation needs a 90° rotation.
		// 0 = portrait (no rotation), 1 = landscape (90°).
		image_rotate: orientation === "landscape" ? 1 : 0,
	};

	if (
		latestFirmware &&
		isUpdateAvailable(device.firmware_version, latestFirmware.version)
	) {
		firmwareExtra.update_firmware = true;
		firmwareExtra.firmware_url = latestFirmware.downloadUrl;
		logInfo("Firmware update available", {
			source: "api/display",
			metadata: {
				deviceId: device.friendly_id,
				currentVersion: device.firmware_version,
				latestVersion: latestFirmware.version,
			},
		});
	}

	return firmwareExtra;
}

async function buildReadyDisplayResponse(
	headers: DisplayHeaders,
	baseUrl: string,
	uniqueId: string,
	apiKey: string,
) {
	try {
		const device = await findOrCreateDevice(headers);

		if (!device) {
			logError("Error fetching/creating device", {
				source: "api/display",
				metadata: { headers },
			});
			return buildErrorResponse("Device not found", baseUrl, uniqueId);
		}

		const orientation = device.screen_orientation || "landscape";
		const { imageUrl, refreshRate, screenToDisplay } =
			await resolveDisplayContent(device, headers, baseUrl, apiKey);

		precacheImageInBackground(imageUrl, device.friendly_id);

		// Update device status in background
		updateDeviceStatus(device, headers, refreshRate);
		const metadata = {
			deviceId: device.friendly_id,
			screen: screenToDisplay,
			refreshRate,
			displayMode: device.display_mode,
		};
		logInfo("Display request successful", { source: "api/display", metadata });

		// Check for firmware updates
		const firmwareExtra = await buildFirmwareExtra(device, orientation);

		return buildDisplayResponse(
			imageUrl,
			`${screenToDisplay || "not-found"}_${uniqueId}.bmp`,
			refreshRate,
			firmwareExtra,
		);
	} catch (_error) {
		logError("Internal server error", {
			source: "api/display",
			metadata: { headers },
		});
		return buildErrorResponse("Internal server error", baseUrl, uniqueId);
	}
}

export async function GET(request: Request) {
	const headers = parseRequestHeaders(request);

	// TRMNL API requires Access-Token header
	if (!headers.apiKey) {
		return buildMissingAccessTokenResponse();
	}

	// log all headers in console for debugging
	console.table(headers);

	const { ready } = await checkDbConnection();
	const baseUrl = `${headers.hostUrl}/api/bitmap`;
	const uniqueId =
		Math.random().toString(36).substring(2, 7) +
		Date.now().toString(36).slice(-3);

	if (!ready) {
		return buildNoDbDisplayResponse(headers, baseUrl, uniqueId);
	}

	logInfo("Display API Request", {
		source: "api/display",
		metadata: { headers },
	});

	return buildReadyDisplayResponse(headers, baseUrl, uniqueId, headers.apiKey);
}
