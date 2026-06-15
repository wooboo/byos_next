import { NextResponse } from "next/server";
import { findDeviceByApiKeyAndUpdateMac } from "@/app/api/device-api-key";
import type { CustomError } from "@/lib/api/types";
import { getCurrentUserId } from "@/lib/auth/get-user";
import { db } from "@/lib/database/db";
import { checkDbConnection } from "@/lib/database/utils";
import { logError, logInfo } from "@/lib/logger";
import { generateApiKey, generateFriendlyId } from "@/utils/helpers";

type SetupHeaders = {
	apiKey: string | null;
	macAddress: string | undefined;
	model: string | null;
};

type ValidatedSetupHeaders = {
	apiKey: string | null;
	macAddress: string;
	model: string;
};

type DeviceSetupResponse = {
	status: number;
	api_key?: string | null;
	friendly_id?: string | null;
	image_url?: string | null;
	filename?: string | null;
	message: string;
	reset_firmware?: boolean;
	error?: string;
};

type SetupDevice = {
	api_key: string | null;
	friendly_id: string;
	mac_address: string | null;
	user_id: string | null;
};

const DEVICE_COMPAT_STATUS = { status: 200 };
const SETUP_LOG_SOURCE = "api/setup";

function readSetupHeaders(request: Request): SetupHeaders {
	return {
		apiKey: request.headers.get("Access-Token"),
		macAddress: request.headers.get("ID")?.toUpperCase(),
		model: request.headers.get("Model"),
	};
}

function jsonSetupResponse(body: DeviceSetupResponse) {
	return NextResponse.json(body, DEVICE_COMPAT_STATUS);
}

function deviceSetupResponse({
	apiKey,
	friendlyId,
	message,
}: {
	apiKey: string | null;
	friendlyId: string;
	message: string;
}) {
	return jsonSetupResponse({
		status: 200,
		api_key: apiKey,
		friendly_id: friendlyId,
		image_url: null,
		filename: null,
		message,
	});
}

function skippedSetupResponse(headers: SetupHeaders) {
	console.warn(
		"Database client not initialized, using noDB mode, skipping device setup",
	);
	logInfo(
		"Database client not initialized, using noDB mode, skipping device setup",
		{
			source: SETUP_LOG_SOURCE,
			metadata: {
				macAddress: headers.macAddress || null,
				hasApiKey: Boolean(headers.apiKey),
			},
		},
	);
	return NextResponse.json(
		{
			status: 200,
			message: "Device setup skipped",
		},
		{ status: 200 },
	);
}

function missingIdResponse(headers: SetupHeaders) {
	const error = new Error("Missing ID header");
	logError(error, {
		source: SETUP_LOG_SOURCE,
		metadata: {
			macAddress: headers.macAddress || null,
			hasApiKey: Boolean(headers.apiKey),
			model: headers.model || null,
		},
	});

	return jsonSetupResponse({
		status: 404,
		api_key: null,
		friendly_id: null,
		image_url: null,
		message: "ID header is required",
	});
}

function missingModelResponse() {
	return jsonSetupResponse({
		status: 400,
		api_key: null,
		friendly_id: null,
		image_url: null,
		message: "Model header is required",
	});
}

function unauthenticatedCreateResponse(headers: ValidatedSetupHeaders) {
	logError("Refusing to set up an unowned device", {
		source: SETUP_LOG_SOURCE,
		metadata: {
			macAddress: headers.macAddress,
			hasApiKey: Boolean(headers.apiKey),
			model: headers.model,
		},
	});

	return jsonSetupResponse({
		status: 403,
		api_key: null,
		friendly_id: null,
		image_url: null,
		message: "Device setup requires an authenticated owner",
	});
}

function unauthorizedExistingDeviceResponse(
	device: SetupDevice,
	headers: ValidatedSetupHeaders,
) {
	logError("Refusing setup for device without owner or valid access token", {
		source: SETUP_LOG_SOURCE,
		metadata: {
			friendly_id: device.friendly_id,
			mac_address: headers.macAddress,
			hasApiKey: Boolean(headers.apiKey),
		},
	});

	return jsonSetupResponse({
		status: 403,
		api_key: null,
		friendly_id: null,
		image_url: null,
		message: "Device setup requires a valid access token or owner session",
	});
}

function createDeviceErrorResponse(
	createError: unknown,
	macAddress: string,
	friendlyId: string,
	apiKey: string,
) {
	const deviceError: CustomError = new Error("Error creating device");
	deviceError.originalError = createError;

	logError(deviceError, {
		source: SETUP_LOG_SOURCE,
		metadata: {
			macAddress,
			friendly_id: friendlyId,
			has_api_key: Boolean(apiKey),
		},
	});

	return jsonSetupResponse({
		status: 500,
		reset_firmware: false,
		message: `Error creating new device. ${friendlyId}`,
	});
}

function internalErrorResponse(error: unknown) {
	logError(error as Error, {
		source: SETUP_LOG_SOURCE,
	});

	return jsonSetupResponse({
		status: 500,
		error: "Internal server error",
		message: "Internal server error",
	});
}

async function findDeviceByMacAddress(macAddress: string) {
	return db
		.selectFrom("devices")
		.selectAll()
		.where("mac_address", "=", macAddress)
		.executeTakeFirst();
}

async function updateDeviceApiKey(device: SetupDevice, apiKey: string) {
	try {
		await db
			.updateTable("devices")
			.set({
				api_key: apiKey,
				updated_at: new Date().toISOString(),
			})
			.where("friendly_id", "=", device.friendly_id)
			.execute();

		logInfo("Updated API key for device", {
			source: SETUP_LOG_SOURCE,
			metadata: {
				device_id: device.friendly_id,
				mac_address: device.mac_address,
			},
		});
		return apiKey;
	} catch (updateError) {
		logError(new Error("Error updating API key for device"), {
			source: SETUP_LOG_SOURCE,
			metadata: {
				device_id: device.friendly_id,
				mac_address: device.mac_address,
				error: updateError,
			},
		});
		return device.api_key;
	}
}

async function ensureDeviceApiKey(device: SetupDevice, macAddress: string) {
	if (device.api_key) {
		return device.api_key;
	}

	const suffix = new Date().toISOString().replace(/[-:Z]/g, "");
	return updateDeviceApiKey(device, generateApiKey(macAddress, suffix));
}

async function findDeviceByProvidedApiKey(headers: ValidatedSetupHeaders) {
	if (!headers.apiKey) {
		return null;
	}

	return findDeviceByApiKeyAndUpdateMac(db, {
		apiKey: headers.apiKey,
		macAddress: headers.macAddress,
		source: SETUP_LOG_SOURCE,
		successMessage: "Updated device MAC address",
	});
}

function existingApiKeyDeviceResponse(device: SetupDevice) {
	return deviceSetupResponse({
		apiKey: device.api_key,
		friendlyId: device.friendly_id,
		message: `Device ${device.friendly_id} updated with new MAC address!`,
	});
}

function buildDefaultSetupTiming() {
	return {
		refreshSchedule: JSON.stringify({
			default_refresh_rate: 60,
			time_ranges: [
				{
					start_time: "00:00",
					end_time: "07:00",
					refresh_rate: 3600,
				},
			],
		}),
		lastUpdateTime: new Date().toISOString(),
		nextExpectedUpdate: new Date(Date.now() + 3600 * 1000).toISOString(),
	};
}

function buildNewDeviceValues(
	headers: ValidatedSetupHeaders,
	currentUserId: string,
) {
	const suffix = new Date().toISOString().replace(/[-:Z]/g, "");
	const friendlyId = generateFriendlyId(headers.macAddress, suffix);
	const apiKey = headers.apiKey || generateApiKey(headers.macAddress, suffix);
	const timing = buildDefaultSetupTiming();

	return {
		apiKey,
		friendlyId,
		values: {
			mac_address: headers.macAddress,
			name: `TRMNL Device ${friendlyId}`,
			friendly_id: friendlyId,
			api_key: apiKey,
			refresh_schedule: timing.refreshSchedule,
			last_update_time: timing.lastUpdateTime,
			next_expected_update: timing.nextExpectedUpdate,
			timezone: "Europe/London",
			user_id: currentUserId,
		},
	};
}

async function createNewDevice(
	headers: ValidatedSetupHeaders,
	currentUserId: string,
) {
	const { apiKey, friendlyId, values } = buildNewDeviceValues(
		headers,
		currentUserId,
	);

	try {
		const newDevice = await db
			.insertInto("devices")
			.values(values)
			.returningAll()
			.executeTakeFirst();

		if (!newDevice) {
			throw new Error("Failed to create new device record");
		}

		logInfo(`New device ${newDevice.friendly_id} created!`, {
			source: SETUP_LOG_SOURCE,
			metadata: {
				friendly_id: newDevice.friendly_id,
				mac_address: headers.macAddress,
				has_api_key: Boolean(apiKey),
			},
		});

		return deviceSetupResponse({
			apiKey: newDevice.api_key,
			friendlyId: newDevice.friendly_id,
			message: `Device ${newDevice.friendly_id} added to BYOS!`,
		});
	} catch (createError) {
		return createDeviceErrorResponse(
			createError,
			headers.macAddress,
			friendlyId,
			apiKey,
		);
	}
}

function canManageDevice(
	device: SetupDevice,
	apiKey: string | null,
	currentUserId: string | null,
) {
	return (
		!apiKey ||
		apiKey === device.api_key ||
		(Boolean(currentUserId) && device.user_id === currentUserId)
	);
}

async function setupExistingDevice(
	device: SetupDevice,
	headers: ValidatedSetupHeaders,
	currentUserId: string | null,
) {
	if (!canManageDevice(device, headers.apiKey, currentUserId)) {
		return unauthorizedExistingDeviceResponse(device, headers);
	}

	const currentApiKey =
		headers.apiKey && headers.apiKey !== device.api_key
			? await updateDeviceApiKey(device, headers.apiKey)
			: await ensureDeviceApiKey(device, headers.macAddress);

	logInfo(`Device ${device.friendly_id} added to BYOS!`, {
		source: SETUP_LOG_SOURCE,
		metadata: {
			friendly_id: device.friendly_id,
			mac_address: headers.macAddress,
			has_api_key: Boolean(currentApiKey),
		},
	});

	return deviceSetupResponse({
		apiKey: currentApiKey,
		friendlyId: device.friendly_id,
		message: `Device ${device.friendly_id} added to BYOS!`,
	});
}

async function setupKnownHeaders(headers: ValidatedSetupHeaders) {
	const currentUserId = await getCurrentUserId();
	const device = await findDeviceByMacAddress(headers.macAddress);

	if (device) {
		return setupExistingDevice(device, headers, currentUserId);
	}

	const deviceByApiKey = await findDeviceByProvidedApiKey(headers);
	if (deviceByApiKey) {
		return existingApiKeyDeviceResponse(deviceByApiKey);
	}

	if (!currentUserId) {
		return unauthenticatedCreateResponse(headers);
	}

	return createNewDevice(headers, currentUserId);
}

export async function GET(request: Request) {
	try {
		const headers = readSetupHeaders(request);
		const { ready } = await checkDbConnection();
		if (!ready) {
			return skippedSetupResponse(headers);
		}

		if (!headers.macAddress) {
			return missingIdResponse(headers);
		}

		if (!headers.model) {
			return missingModelResponse();
		}

		return setupKnownHeaders({
			apiKey: headers.apiKey,
			macAddress: headers.macAddress,
			model: headers.model,
		});
	} catch (error) {
		return internalErrorResponse(error);
	}
}
