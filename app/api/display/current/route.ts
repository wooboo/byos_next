import { NextResponse } from "next/server";
import { resolveRenderableContentType } from "@/lib/content-ref";
import { db } from "@/lib/database/db";
import { checkDbConnection } from "@/lib/database/utils";
import { logError, logInfo } from "@/lib/logger";
import { DeviceDisplayMode } from "@/lib/mixup/constants";
import {
	DEFAULT_IMAGE_HEIGHT,
	DEFAULT_IMAGE_WIDTH,
} from "@/lib/recipes/recipe-renderer";
import type { Device } from "@/lib/types";
import { parseRequestHeaders, type RequestHeaders } from "../utils";

const jsonError = (status: number, error: string) =>
	NextResponse.json({ status, error }, { status });

const unauthorizedResponse = () =>
	jsonError(401, "Access-Token header is required");

const databaseUnavailableResponse = (apiKey: string) => {
	logInfo("Database not available for /api/display/current", {
		source: "api/display/current",
		metadata: { apiKey },
	});

	return jsonError(503, "Database not available");
};

const deviceNotFoundResponse = () => jsonError(404, "Device not found");

const internalServerErrorResponse = (error: unknown, apiKey: string) => {
	logError(error as Error, {
		source: "api/display/current",
		metadata: { apiKey },
	});

	return jsonError(500, "Internal server error");
};

const findDeviceByApiKey = async (apiKey: string) =>
	db
		.selectFrom("devices")
		.selectAll()
		.where("api_key", "=", apiKey)
		.executeTakeFirst();

const defaultDimension = (
	value: Device["screen_width"] | Device["screen_height"],
	fallback: number,
) => value || fallback;

const getDeviceDimensions = (device: Device) => {
	const orientation = device.screen_orientation || "landscape";
	const landscapeDimensions = {
		width: defaultDimension(device.screen_width, DEFAULT_IMAGE_WIDTH),
		height: defaultDimension(device.screen_height, DEFAULT_IMAGE_HEIGHT),
	};
	const portraitDimensions = {
		width: defaultDimension(device.screen_height, DEFAULT_IMAGE_HEIGHT),
		height: defaultDimension(device.screen_width, DEFAULT_IMAGE_WIDTH),
	};

	return orientation === "landscape" ? landscapeDimensions : portraitDimensions;
};

const getGrayscaleLevels = (device: Device) => {
	if (
		device.grayscale === 2 ||
		device.grayscale === 4 ||
		device.grayscale === 16
	) {
		return device.grayscale;
	}

	return 2;
};

const getScreenTarget = (device: Device) => {
	const screenId = device.screen_id || device.screen || "not-found";
	const screenType = resolveRenderableContentType(device.screen_type, screenId);
	const mixupPath = getMixupScreenPath(device);

	if (mixupPath) {
		return {
			screenId,
			screenPath: mixupPath,
			needsAccessToken: true,
		};
	}

	if (screenType === "screen") {
		return {
			screenId,
			screenPath: `screen/${screenId}`,
			needsAccessToken: true,
		};
	}

	return {
		screenId,
		screenPath: screenId,
		needsAccessToken: false,
	};
};

const getMixupScreenPath = (device: Device) => {
	if (device.display_mode !== DeviceDisplayMode.MIXUP) {
		return null;
	}

	return device.mixup_id ? `mixup/${device.mixup_id}` : null;
};

const getRefreshRate = (device: Device) => {
	const refreshSchedule = device.refresh_schedule as {
		default_refresh_rate: number;
	} | null;

	return refreshSchedule?.default_refresh_rate || 180;
};

const buildImageUrl = ({
	apiKey,
	device,
	headers,
}: {
	apiKey: string;
	device: Device;
	headers: RequestHeaders;
}) => {
	const baseUrl = `${headers.hostUrl}/api/bitmap`;
	const { width, height } = getDeviceDimensions(device);
	const grayscaleLevels = getGrayscaleLevels(device);
	const { screenPath, needsAccessToken } = getScreenTarget(device);
	const accessTokenParam = needsAccessToken
		? `&access_token=${encodeURIComponent(apiKey)}`
		: "";

	return `${baseUrl}/${screenPath}.bmp?width=${width}&height=${height}&grayscale=${grayscaleLevels}${accessTokenParam}`;
};

const currentDisplayResponse = ({
	apiKey,
	device,
	headers,
}: {
	apiKey: string;
	device: Device;
	headers: RequestHeaders;
}) => {
	const { screenId } = getScreenTarget(device);
	const imageUrl = buildImageUrl({ apiKey, device, headers });
	const refreshRate = getRefreshRate(device);

	logInfo("Current display request successful", {
		source: "api/display/current",
		metadata: {
			deviceId: device.friendly_id,
			screen: screenId,
		},
	});

	return NextResponse.json(
		{
			status: 200,
			refresh_rate: refreshRate,
			image_url: imageUrl,
			filename: `${screenId}.bmp`,
			rendered_at: device.last_update_time || new Date().toISOString(),
		},
		{ status: 200 },
	);
};

/**
 * GET /api/display/current
 * Fetch the current screen for a device
 *
 * Headers:
 * - Access-Token (required): Device API Key
 */
export async function GET(request: Request) {
	const headers = parseRequestHeaders(request);
	const { apiKey } = headers;

	if (!apiKey) {
		return unauthorizedResponse();
	}

	const { ready } = await checkDbConnection();
	if (!ready) {
		return databaseUnavailableResponse(apiKey);
	}

	try {
		const device = await findDeviceByApiKey(apiKey);

		if (!device) {
			return deviceNotFoundResponse();
		}

		const deviceData = device as unknown as Device;
		return currentDisplayResponse({ apiKey, device: deviceData, headers });
	} catch (error) {
		return internalServerErrorResponse(error, apiKey);
	}
}
