import { NextResponse } from "next/server";
import {
	createMockDeviceIdentity,
	generateMockMacAddress,
} from "@/app/api/device-api-key";
import { getCurrentUserId } from "@/lib/auth/get-user";
import { db } from "@/lib/database/db";
import { withExplicitUserScope } from "@/lib/database/scoped-db";
import { checkDbConnection } from "@/lib/database/utils";
import { logError, logInfo } from "@/lib/logger";
import { logger } from "@/lib/recipes/logger";
import type {
	Device,
	PlaylistItem,
	RefreshSchedule,
	TimeRange,
} from "@/lib/types";
import { generateFriendlyId, timezones } from "@/utils/helpers";
import { DEFAULT_SCREEN } from "./constants";

// --- Types ---

export interface RequestHeaders {
	apiKey: string | null;
	macAddress: string | null;
	refreshRate: string | null;
	batteryVoltage: string | null;
	fwVersion: string | null;
	rssi: string | null;
	width: number | null;
	height: number | null;
	model: string | null;
	specialFunction: boolean;
	base64: boolean;
	hostUrl: string;
}

// --- Header Parsing ---

export const parseRequestHeaders = (request: Request): RequestHeaders => {
	const headers = request.headers;
	const widthStr = headers.get("Width");
	const heightStr = headers.get("Height");
	let accessToken = headers.get("Access-Token");
	try {
		accessToken ||= new URL(request.url).searchParams.get("access_token");
	} catch {
		// Some tests/mocks may pass a Request without an absolute URL.
	}

	return {
		apiKey: accessToken,
		macAddress: headers.get("ID")?.toUpperCase() || null,
		refreshRate: headers.get("Refresh-Rate"),
		batteryVoltage: headers.get("Battery-Voltage"),
		fwVersion: headers.get("FW-Version"),
		rssi: headers.get("RSSI"),
		width: widthStr ? Number.parseInt(widthStr, 10) : null,
		height: heightStr ? Number.parseInt(heightStr, 10) : null,
		model: headers.get("Model")?.trim() || null,
		specialFunction: headers.get("Special-Function") === "true",
		base64: headers.get("BASE64") === "true",
		hostUrl:
			(headers.get("x-forwarded-proto") || "http") +
			"://" +
			(headers.get("x-forwarded-host") || headers.get("host") || "localhost"),
	};
};

// --- Helper Functions ---

type DisplayDeviceInsert = {
	macAddress: string;
	name: string;
	friendlyId: string;
	apiKey: string;
	defaultRefreshRate: number;
	model: string | null;
	userId: string;
};

const insertDisplayDevice = ({
	macAddress,
	name,
	friendlyId,
	apiKey,
	defaultRefreshRate,
	model,
	userId,
}: DisplayDeviceInsert) =>
	db
		.insertInto("devices")
		.values({
			mac_address: macAddress,
			name,
			friendly_id: friendlyId,
			api_key: apiKey,
			refresh_schedule: JSON.stringify({
				default_refresh_rate: defaultRefreshRate,
				time_ranges: [],
			}),
			last_update_time: new Date().toISOString(),
			next_expected_update: new Date(Date.now() + 3600 * 1000).toISOString(),
			timezone: "UTC",
			screen: DEFAULT_SCREEN,
			model,
			user_id: userId,
		})
		.returningAll()
		.executeTakeFirst();

const updateDeviceIdentity = async (
	device: Device,
	patch: Partial<Device>,
): Promise<Device> => {
	if (Object.keys(patch).length === 0) {
		return device;
	}

	patch.updated_at = new Date().toISOString();
	await db
		.updateTable("devices")
		.set(patch)
		.where("id", "=", device.id.toString())
		.execute();

	Object.assign(device, patch);
	logInfo("Updated device identity from headers", {
		source: "api/display",
		metadata: {
			deviceId: device.friendly_id,
			fields: Object.keys(patch),
		},
	});

	return device;
};

export const precacheImageInBackground = (
	imageUrl: string,
	friendlyId: string,
): void => {
	fetch(imageUrl, { method: "GET" })
		.then((response) => {
			if (!response.ok) {
				throw new Error(`Failed to cache image: ${response.status}`);
			}
			logInfo("Image pre-cached successfully", {
				source: "api/display",
				metadata: { imageUrl, friendlyId },
			});
		})
		.catch((error: Error) => {
			logError("Failed to precache image", {
				source: "api/display",
				metadata: { imageUrl, error: error.message, friendlyId },
			});
		});
};

export const isTimeInRange = (
	timeToCheck: string,
	startTime: string,
	endTime: string,
): boolean => {
	if (startTime > endTime) {
		return timeToCheck >= startTime || timeToCheck < endTime;
	}
	return timeToCheck >= startTime && timeToCheck < endTime;
};

export const calculateRefreshRate = (
	refreshSchedule: RefreshSchedule | null,
	defaultRefreshRate: number,
	timezone: string = timezones[0].value,
): number => {
	if (!refreshSchedule) {
		return defaultRefreshRate;
	}

	const now = new Date();
	const options = {
		timeZone: timezone,
		hour12: false,
	} as Intl.DateTimeFormatOptions;
	const formatter = new Intl.DateTimeFormat("en-US", {
		...options,
		hour: "2-digit",
		minute: "2-digit",
	});

	const [{ value: hour }, , { value: minute }] = formatter.formatToParts(now);
	const currentTimeString = `${hour}:${minute}`;

	for (const range of refreshSchedule.time_ranges as TimeRange[]) {
		if (isTimeInRange(currentTimeString, range.start_time, range.end_time)) {
			return range.refresh_rate;
		}
	}

	return refreshSchedule.default_refresh_rate;
};

export const getActivePlaylistItem = async (
	playlistId: string,
	currentIndex: number,
	timezone: string = "UTC",
	userId?: string | null,
): Promise<PlaylistItem | null> => {
	const { ready } = await checkDbConnection();
	if (!ready) return null;

	const runQuery = (conn: typeof db) =>
		conn
			.selectFrom("playlist_items")
			.selectAll()
			.where("playlist_id", "=", playlistId)
			.orderBy("order_index", "asc")
			.execute();

	const items = userId
		? await withExplicitUserScope(userId, runQuery)
		: await runQuery(db);

	if (!items || items.length === 0) {
		logError("No items in playlist", {
			source: "api/display",
			metadata: { playlistId },
		});
		return null;
	}

	const now = new Date();
	const options = {
		timeZone: timezone,
		hour12: false,
	} as Intl.DateTimeFormatOptions;

	const timeFormatter = new Intl.DateTimeFormat("en-US", {
		...options,
		hour: "2-digit",
		minute: "2-digit",
	});
	const [{ value: hour }, , { value: minute }] =
		timeFormatter.formatToParts(now);
	const currentTime = `${hour}:${minute}`;

	const dayFormatter = new Intl.DateTimeFormat("en-US", {
		...options,
		weekday: "long",
	});
	const currentDay = dayFormatter.format(now).toLowerCase();

	const metadata = {
		playlistId,
		currentIndex,
		timezone,
		currentTime,
		currentDay,
		totalItems: items.length,
	};
	logInfo("Checking playlist items for time/day match", {
		source: "api/display",
		metadata,
	});

	for (let i = 1; i < items.length + 1; i++) {
		const itemIndex = (currentIndex + i) % items.length;
		const item = items[itemIndex];

		const days_of_week = item.days_of_week as string[] | null;
		const start_time = item.start_time;
		const end_time = item.end_time;

		const isTimeValid =
			!start_time ||
			!end_time ||
			isTimeInRange(currentTime, start_time, end_time);
		const isDayValid =
			!days_of_week ||
			(Array.isArray(days_of_week) && days_of_week.includes(currentDay));

		if (isTimeValid && isDayValid) {
			return item as unknown as PlaylistItem;
		}
	}

	return null;
};

// --- User Resolution ---

/**
 * Resolve the user_id that owns a device identified by API key.
 * Returns null if no device or no owner is found.
 */
export const resolveUserIdFromApiKey = async (
	apiKey: string,
): Promise<string | null> => {
	const { ready } = await checkDbConnection();
	if (!ready) return null;

	const device = await db
		.selectFrom("devices")
		.select("user_id")
		.where("api_key", "=", apiKey)
		.executeTakeFirst();

	return device?.user_id ?? null;
};

// --- Device Management ---

export const updateDeviceStatus = async (
	device: Device,
	headers: RequestHeaders,
	refreshDurationSeconds: number,
): Promise<void> => {
	const now = new Date();
	const nextExpectedUpdate = new Date(
		now.getTime() + refreshDurationSeconds * 1000,
	);

	const updateData: Partial<Device> = {
		last_update_time: now.toISOString(),
		next_expected_update: nextExpectedUpdate.toISOString(),
		last_refresh_duration: Math.round(refreshDurationSeconds),
		updated_at: now.toISOString(),
	};

	if (headers.batteryVoltage) {
		updateData.battery_voltage = Number.parseFloat(headers.batteryVoltage);
	}
	if (headers.fwVersion) {
		updateData.firmware_version = headers.fwVersion;
	}
	if (headers.rssi) {
		updateData.rssi = Number.parseInt(headers.rssi, 10);
	}
	if (device.timezone) {
		updateData.timezone = device.timezone;
	}

	try {
		await db
			.updateTable("devices")
			.set(updateData)
			.where("id", "=", device.id.toString())
			.execute();
	} catch (_error) {
		logError("Error updating device status", {
			source: "api/display",
			metadata: { deviceId: device.id, headers },
		});
	}
};

const findDeviceByApiKey = async (
	headers: RequestHeaders,
): Promise<Device | null> => {
	if (!headers.apiKey) {
		return null;
	}

	const deviceByApiKey = await db
		.selectFrom("devices")
		.selectAll()
		.where("api_key", "=", headers.apiKey)
		.executeTakeFirst();

	if (!deviceByApiKey) {
		return null;
	}

	const device = deviceByApiKey as unknown as Device;
	const patch: Partial<Device> = {};
	if (headers.macAddress && headers.macAddress !== device.mac_address) {
		patch.mac_address = headers.macAddress;
	}
	if (headers.model && headers.model !== device.model) {
		patch.model = headers.model;
	}

	return updateDeviceIdentity(device, patch);
};

const buildMacMatchPatch = async (
	device: Device,
	headers: RequestHeaders,
): Promise<Partial<Device> | null> => {
	const patch: Partial<Device> = {};

	if (headers.apiKey && headers.apiKey !== device.api_key) {
		const currentUserId = await getCurrentUserId();
		if (!currentUserId || device.user_id !== currentUserId) {
			logError("Refusing to rotate device API key from MAC-only match", {
				source: "api/display",
				metadata: {
					deviceId: device.friendly_id,
					macAddress: headers.macAddress,
					hasApiKey: true,
				},
			});
			return null;
		}
		patch.api_key = headers.apiKey;
	}

	if (headers.model && headers.model !== device.model) {
		patch.model = headers.model;
	}

	return patch;
};

const findDeviceByMacAddress = async (
	headers: RequestHeaders,
): Promise<Device | null> => {
	if (!headers.macAddress) {
		return null;
	}

	const deviceByMac = await db
		.selectFrom("devices")
		.selectAll()
		.where("mac_address", "=", headers.macAddress)
		.executeTakeFirst();

	if (!deviceByMac) {
		return null;
	}

	const device = deviceByMac as unknown as Device;
	const patch = await buildMacMatchPatch(device, headers);
	if (!patch) {
		return null;
	}

	return updateDeviceIdentity(device, patch);
};

const createDeviceWithProvidedMac = async (
	headers: RequestHeaders,
	currentUserId: string,
): Promise<Device | null> => {
	if (!headers.apiKey || !headers.macAddress) {
		return null;
	}

	const friendlyId = generateFriendlyId(
		headers.macAddress,
		new Date().toISOString().replace(/[-:Z]/g, ""),
	);

	try {
		const newDevice = await insertDisplayDevice({
			macAddress: headers.macAddress,
			name: `TRMNL Device ${friendlyId}`,
			friendlyId,
			apiKey: headers.apiKey,
			defaultRefreshRate: headers.refreshRate
				? Number.parseInt(headers.refreshRate, 10)
				: 60,
			model: headers.model,
			userId: currentUserId,
		});

		if (newDevice) {
			logInfo("Created new device with provided MAC address", {
				source: "api/display",
				metadata: { friendly_id: friendlyId },
			});
			return newDevice as unknown as Device;
		}
	} catch (e) {
		logError("Error creating device with provided MAC", {
			source: "api/display",
			metadata: { error: e },
		});
	}

	return null;
};

const getExistingMockDevice = async (
	apiKey: string,
	macAddress: string | null,
): Promise<Device | null> => {
	const mockMacAddress = generateMockMacAddress(apiKey);
	const existingMock = await db
		.selectFrom("devices")
		.selectAll()
		.where("mac_address", "=", mockMacAddress)
		.executeTakeFirst();

	if (!existingMock) {
		return null;
	}

	const device = existingMock as unknown as Device;
	if (macAddress) {
		await db
			.updateTable("devices")
			.set({ mac_address: macAddress })
			.where("id", "=", device.id.toString())
			.execute();
	}
	logInfo("Using existing mock device", {
		source: "api/display",
		metadata: { friendly_id: device.friendly_id },
	});
	return device;
};

const createMockDisplayDevice = async (
	headers: RequestHeaders,
	currentUserId: string,
): Promise<Device | null> => {
	if (!headers.apiKey) {
		return null;
	}

	const mockIdentity = createMockDeviceIdentity(
		headers.apiKey,
		headers.macAddress,
	);

	try {
		const newDevice = await insertDisplayDevice({
			macAddress: headers.macAddress || generateMockMacAddress(headers.apiKey),
			name: `Unknown device with API ${headers.apiKey.substring(0, 4)}...`,
			friendlyId: mockIdentity.friendlyId,
			apiKey: mockIdentity.apiKey,
			defaultRefreshRate: 60,
			model: headers.model,
			userId: currentUserId,
		});

		if (newDevice) {
			logger.info(`Created new mock device: ${mockIdentity.friendlyId}`);
			return newDevice as unknown as Device;
		}
	} catch (e) {
		logger.error("Error creating mock device", { error: e });
	}

	return null;
};

const createDeviceForApiKey = async (
	headers: RequestHeaders,
): Promise<Device | null> => {
	if (!headers.apiKey) {
		return null;
	}

	const currentUserId = await getCurrentUserId();
	if (!currentUserId) {
		logError("Refusing to auto-provision an unowned device", {
			source: "api/display",
			metadata: {
				macAddress: headers.macAddress,
				hasApiKey: true,
				model: headers.model,
			},
		});
		return null;
	}

	return (
		(await createDeviceWithProvidedMac(headers, currentUserId)) ??
		(await getExistingMockDevice(headers.apiKey, headers.macAddress)) ??
		(await createMockDisplayDevice(headers, currentUserId))
	);
};

export const findOrCreateDevice = async (
	headers: RequestHeaders,
): Promise<Device | null> => {
	return (
		(await findDeviceByApiKey(headers)) ??
		(await findDeviceByMacAddress(headers)) ??
		(await createDeviceForApiKey(headers))
	);
};

// --- Response Builder ---

export const buildDisplayResponse = (
	imageUrl: string,
	filename: string,
	refreshRate: number,
	extra: Record<string, unknown> = {},
) => {
	return NextResponse.json(
		{
			status: 0,
			image_url: imageUrl,
			filename,
			refresh_rate: refreshRate,
			reset_firmware: false,
			update_firmware: false,
			firmware_url: null,
			special_function: "restart_playlist",
			...extra,
		},
		{ status: 200 },
	);
};

export const buildErrorResponse = (
	message: string,
	baseUrl: string,
	uniqueId: string,
) => {
	const notFoundImageUrl = `${baseUrl}/not-found.bmp`;
	return NextResponse.json(
		{
			status: 500,
			reset_firmware: true,
			message,
			image_url: notFoundImageUrl,
			filename: `not-found_${uniqueId}.bmp`,
		},
		{ status: 200 },
	);
};
