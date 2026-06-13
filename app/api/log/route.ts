import type { Selectable } from "kysely";
import { NextResponse } from "next/server";
import {
	createMockDeviceIdentity,
	findDeviceByApiKeyAndUpdateMac,
	generateMockMacAddress,
} from "@/app/api/device-api-key";
import type { CustomError } from "@/lib/api/types";
import { getCurrentUserId } from "@/lib/auth/get-user";
import { db } from "@/lib/database/db";
import type { DB } from "@/lib/database/db.d";
import { checkDbConnection } from "@/lib/database/utils";
import { logError, logInfo } from "@/lib/logger";
import { generateFriendlyId } from "@/utils/helpers";

const LOG_SOURCE = "api/log";
type DeviceRow = Selectable<DB["devices"]>;

interface LogEntry {
	creation_timestamp: number;
	message?: string;
	level?: string;
	device_status?: string;
	battery_voltage?: number;
	rssi?: number;
	firmware_version?: string;
}

interface LogData {
	logs_array: LogEntry[];
	device_id?: string;
	timestamp?: string;
}

// Define a type for the expected request body
// TRMNL API format: { "logs": [] }
interface LogRequestBody {
	logs: unknown[]; // TRMNL API format - required
}

type LogRequestHeaders = {
	refreshRate: string | null;
	batteryVoltage: string | null;
	fwVersion: string | null;
	rssi: string | null;
};

type DeviceLogState = {
	deviceId: string;
	deviceFound: boolean;
	deviceStatus: "known" | "existing_mock" | "new_mock";
};

type LogRequestContext = ReturnType<typeof parseLogRequestHeaders> & {
	currentUserId: string | null;
};

type LogDeviceResult =
	| {
			type: "device";
			state: DeviceLogState;
	  }
	| {
			type: "response";
			response: Response;
	  };

const parseLogRequestHeaders = (request: Request) => ({
	macAddress: request.headers.get("ID")?.toUpperCase(),
	apiKey: request.headers.get("Access-Token"),
	metrics: {
		refreshRate: request.headers.get("Refresh-Rate"),
		batteryVoltage: request.headers.get("Battery-Voltage"),
		fwVersion: request.headers.get("FW-Version"),
		rssi: request.headers.get("RSSI"),
	},
});

const buildDeviceMetricsUpdate = (
	device: DeviceRow,
	{ refreshRate, batteryVoltage, fwVersion, rssi }: LogRequestHeaders,
) => ({
	last_update_time: new Date().toISOString(),
	next_expected_update: new Date(
		Date.now() +
			(refreshRate ? Number.parseInt(refreshRate, 10) * 1000 : 3600 * 1000),
	).toISOString(),
	battery_voltage: batteryVoltage
		? Number.parseFloat(batteryVoltage)
		: device.battery_voltage,
	firmware_version: fwVersion || device.firmware_version,
	rssi: rssi ? Number.parseInt(rssi, 10) : device.rssi,
	updated_at: new Date().toISOString(),
});

const updateDeviceMetrics = async (
	deviceId: string,
	device: DeviceRow,
	metrics: LogRequestHeaders,
	errorMessage = "Error updating device metrics",
) => {
	try {
		await db
			.updateTable("devices")
			.set(buildDeviceMetricsUpdate(device, metrics))
			.where("friendly_id", "=", deviceId)
			.execute();
	} catch (updateError) {
		logError(new Error(errorMessage), {
			source: LOG_SOURCE,
			metadata: {
				device_id: deviceId,
				error: updateError,
			},
		});
	}
};

const updateDeviceMacAddress = async (
	deviceId: string,
	macAddress: string,
	successMessage: string,
	errorMessage = "Error updating MAC address for device",
) => {
	try {
		await db
			.updateTable("devices")
			.set({
				mac_address: macAddress,
				updated_at: new Date().toISOString(),
			})
			.where("friendly_id", "=", deviceId)
			.execute();

		logInfo(successMessage, {
			source: LOG_SOURCE,
			metadata: {
				device_id: deviceId,
				mac_address: macAddress,
			},
		});
	} catch (updateMacError) {
		logError(new Error(errorMessage), {
			source: LOG_SOURCE,
			metadata: {
				device_id: deviceId,
				mac_address: macAddress,
				error: updateMacError,
			},
		});
	}
};

type LogDeviceInsert = {
	macAddress: string;
	name: string;
	friendlyId: string;
	apiKey: string;
	metrics: LogRequestHeaders;
	userId: string;
};

const insertLogDevice = ({
	macAddress,
	name,
	friendlyId,
	apiKey,
	metrics,
	userId,
}: LogDeviceInsert) =>
	db
		.insertInto("devices")
		.values({
			mac_address: macAddress,
			name,
			friendly_id: friendlyId,
			api_key: apiKey,
			refresh_schedule: JSON.stringify({
				default_refresh_rate: metrics.refreshRate
					? Number.parseInt(metrics.refreshRate, 10)
					: 60,
				time_ranges: [],
			}),
			last_update_time: new Date().toISOString(),
			next_expected_update: new Date(
				Date.now() +
					(metrics.refreshRate
						? Number.parseInt(metrics.refreshRate, 10) * 1000
						: 3600 * 1000),
			).toISOString(),
			timezone: "UTC",
			battery_voltage: metrics.batteryVoltage
				? Number.parseFloat(metrics.batteryVoltage)
				: null,
			firmware_version: metrics.fwVersion || null,
			rssi: metrics.rssi ? Number.parseInt(metrics.rssi, 10) : null,
			user_id: userId,
		})
		.returningAll()
		.executeTakeFirst();

const logDeviceState = (
	message: string,
	state: DeviceLogState,
	metrics: LogRequestHeaders,
	metadata: Record<string, unknown> = {},
) => {
	logInfo(message, {
		source: LOG_SOURCE,
		metadata: {
			...metadata,
			device_id: state.deviceId,
			refresh_rate: metrics.refreshRate,
			battery_voltage: metrics.batteryVoltage,
			fw_version: metrics.fwVersion,
			rssi: metrics.rssi,
			device_found: state.deviceFound,
			device_status: state.deviceStatus,
		},
	});
};

const deviceCompatResponse = (
	status: number,
	message: string,
	body: Record<string, unknown> = {},
) =>
	NextResponse.json(
		{
			status,
			message,
			...body,
		},
		{ status: 200 },
	);

const unauthorizedRegisteredDeviceResponse = (
	device: DeviceRow,
	macAddress: string,
	apiKey: string,
) => {
	logError("Refusing logs for device without owner or valid access token", {
		source: LOG_SOURCE,
		metadata: {
			device_id: device.friendly_id,
			mac_address: macAddress,
			hasApiKey: Boolean(apiKey),
		},
	});

	return deviceCompatResponse(
		401,
		"Valid access token required for registered device",
	);
};

const unownedDeviceResponse = (
	message: string,
	metadata: Record<string, unknown>,
) => {
	logError(message, {
		source: LOG_SOURCE,
		metadata,
	});

	return deviceCompatResponse(
		400,
		"Device owner is required before logs can be accepted",
	);
};

const failedUnknownDeviceResponse = () =>
	deviceCompatResponse(500, "Failed to process logs from unknown device");

const failedLogSaveResponse = () =>
	deviceCompatResponse(500, "Failed to save logs");

const internalErrorResponse = () =>
	deviceCompatResponse(500, "Internal server error");

const createKnownDeviceState = (deviceId: string): DeviceLogState => ({
	deviceId,
	deviceFound: true,
	deviceStatus: "known",
});

const canUseDevice = (
	device: DeviceRow,
	apiKey: string,
	currentUserId: string | null,
) =>
	apiKey === device.api_key ||
	(Boolean(currentUserId) && device.user_id === currentUserId);

const updateDeviceApiKey = async (deviceId: string, apiKey: string) => {
	try {
		await db
			.updateTable("devices")
			.set({
				api_key: apiKey,
				updated_at: new Date().toISOString(),
			})
			.where("friendly_id", "=", deviceId)
			.execute();

		logInfo("Updated API key for device", {
			source: LOG_SOURCE,
			metadata: {
				device_id: deviceId,
			},
		});
	} catch (updateError) {
		logError(new Error("Error updating API key for device"), {
			source: LOG_SOURCE,
			metadata: {
				device_id: deviceId,
				error: updateError,
			},
		});
	}
};

const findDeviceByMacAddress = (macAddress: string) =>
	db
		.selectFrom("devices")
		.selectAll()
		.where("mac_address", "=", macAddress)
		.executeTakeFirst();

const findDeviceByApiKey = (apiKey: string) =>
	db
		.selectFrom("devices")
		.selectAll()
		.where("api_key", "=", apiKey)
		.executeTakeFirst();

const resolveDeviceByMac = async (
	context: LogRequestContext & { apiKey: string; macAddress: string },
): Promise<LogDeviceResult | null> => {
	const { apiKey, currentUserId, macAddress, metrics } = context;
	const deviceByMac = await findDeviceByMacAddress(macAddress);

	if (!deviceByMac) {
		return null;
	}

	if (!canUseDevice(deviceByMac, apiKey, currentUserId)) {
		return {
			type: "response",
			response: unauthorizedRegisteredDeviceResponse(
				deviceByMac,
				macAddress,
				apiKey,
			),
		};
	}

	const state = createKnownDeviceState(deviceByMac.friendly_id);

	if (apiKey !== deviceByMac.api_key) {
		await updateDeviceApiKey(state.deviceId, apiKey);
	}

	await updateDeviceMetrics(state.deviceId, deviceByMac, metrics);
	logDeviceState("Device authenticated by MAC address", state, metrics, {
		mac_address: macAddress,
	});

	return { type: "device", state };
};

const createDeviceWithProvidedMac = async (
	context: LogRequestContext & { apiKey: string; macAddress: string },
): Promise<LogDeviceResult | null> => {
	const { apiKey, currentUserId, macAddress, metrics } = context;

	if (!currentUserId) {
		return {
			type: "response",
			response: unownedDeviceResponse(
				"Refusing to auto-provision an unowned device",
				{
					macAddress,
					hasApiKey: true,
				},
			),
		};
	}

	const friendlyId = generateFriendlyId(
		macAddress,
		new Date().toISOString().replace(/[-:Z]/g, ""),
	);

	try {
		const newDevice = await insertLogDevice({
			macAddress,
			name: `TRMNL Device ${friendlyId}`,
			friendlyId,
			apiKey,
			metrics,
			userId: currentUserId,
		});

		if (!newDevice) {
			throw new Error("Failed to create new device record");
		}

		const state = createKnownDeviceState(newDevice.friendly_id);
		logDeviceState(
			"Created new device with provided MAC address",
			state,
			metrics,
			{
				mac_address: macAddress,
				has_api_key: Boolean(apiKey),
			},
		);

		return { type: "device", state };
	} catch (createError) {
		const deviceError: CustomError = new Error(
			"Error creating device with provided MAC address",
		);
		deviceError.originalError = createError;

		logError(deviceError, {
			source: LOG_SOURCE,
			metadata: {
				mac_address: macAddress,
				has_api_key: Boolean(apiKey),
				friendly_id: friendlyId,
			},
		});

		return null;
	}
};

const resolveDeviceByApiKeyAndMac = async (
	context: LogRequestContext & { apiKey: string; macAddress: string },
): Promise<LogDeviceResult | null> => {
	const { apiKey, macAddress, metrics } = context;
	const deviceByApiKey = await findDeviceByApiKeyAndUpdateMac(db, {
		apiKey,
		macAddress,
		source: LOG_SOURCE,
		successMessage: "Updated device with real MAC address",
	});

	if (!deviceByApiKey) {
		return createDeviceWithProvidedMac(context);
	}

	const state = createKnownDeviceState(deviceByApiKey.friendly_id);

	await updateDeviceMetrics(state.deviceId, deviceByApiKey, metrics);
	logDeviceState(
		"Device authenticated by API key and updated with MAC address",
		state,
		metrics,
		{
			mac_address: macAddress,
			has_api_key: Boolean(apiKey),
		},
	);

	return { type: "device", state };
};

const resolveKnownApiKeyDevice = async (
	context: LogRequestContext & { apiKey: string },
	device: DeviceRow,
): Promise<LogDeviceResult> => {
	const { apiKey, macAddress, metrics } = context;
	const state = createKnownDeviceState(device.friendly_id);

	if (macAddress && macAddress !== device.mac_address) {
		await updateDeviceMacAddress(
			state.deviceId,
			macAddress,
			"Updated device with MAC address",
		);
	}

	await updateDeviceMetrics(state.deviceId, device, metrics);
	logDeviceState("Device authenticated by API key", state, metrics, {
		has_api_key: Boolean(apiKey),
	});

	return { type: "device", state };
};

const maskedApiKey = (apiKey: string) =>
	apiKey.length > 8 ? `xxxx${apiKey.substring(apiKey.length - 4)}` : apiKey;

const resolveExistingMockDevice = async (
	context: LogRequestContext & { apiKey: string },
	mockMacAddress: string,
): Promise<LogDeviceResult | null> => {
	const { macAddress, metrics } = context;
	const existingMockDevice = await findDeviceByMacAddress(mockMacAddress);

	if (!existingMockDevice) {
		return null;
	}

	const state: DeviceLogState = {
		deviceId: existingMockDevice.friendly_id,
		deviceFound: true,
		deviceStatus: "existing_mock",
	};

	if (macAddress) {
		await updateDeviceMacAddress(
			state.deviceId,
			macAddress,
			"Updated mock device with real MAC address",
			"Error updating MAC address for mock device",
		);
	}

	await updateDeviceMetrics(
		state.deviceId,
		existingMockDevice,
		metrics,
		"Error updating existing mock device",
	);
	logDeviceState(
		"Using existing mock device for unknown logger",
		state,
		metrics,
		{
			mock_mac_address: mockMacAddress,
		},
	);

	return { type: "device", state };
};

const createUnknownLoggerDevice = async (
	context: LogRequestContext & { apiKey: string },
	mockMacAddress: string,
): Promise<LogDeviceResult> => {
	const { apiKey, currentUserId, macAddress, metrics } = context;

	if (!currentUserId) {
		return {
			type: "response",
			response: unownedDeviceResponse(
				"Refusing to auto-provision an unowned mock device",
				{
					hasApiKey: true,
					mockMacAddress,
				},
			),
		};
	}

	const hiddenApiKey = maskedApiKey(apiKey);
	const mockIdentity = createMockDeviceIdentity(apiKey, macAddress);

	try {
		const newDevice = await insertLogDevice({
			macAddress: macAddress || mockMacAddress,
			name: `Unknown device with API ${hiddenApiKey}`,
			friendlyId: mockIdentity.friendlyId,
			apiKey: mockIdentity.apiKey,
			metrics,
			userId: currentUserId,
		});

		if (!newDevice) {
			throw new Error("Failed to create device record");
		}

		const state: DeviceLogState = {
			deviceId: newDevice.friendly_id,
			deviceFound: true,
			deviceStatus: "new_mock",
		};

		logDeviceState("Created new device for unknown logger", state, metrics, {
			original_api_key: hiddenApiKey,
			new_device_id: state.deviceId,
			mock_mac_address: mockMacAddress,
		});

		return { type: "device", state };
	} catch (createError) {
		const deviceError: CustomError = new Error(
			"Error creating device for unknown logger",
		);
		deviceError.originalError = createError;

		logError(deviceError, {
			source: LOG_SOURCE,
			metadata: {
				apiKey: hiddenApiKey,
				mockMacAddress,
				friendly_id: mockIdentity.friendlyId,
				new_api_key: mockIdentity.apiKey,
				device_status: "new_mock",
			},
		});

		return {
			type: "response",
			response: failedUnknownDeviceResponse(),
		};
	}
};

const resolveUnknownApiKeyDevice = async (
	context: LogRequestContext & { apiKey: string },
): Promise<LogDeviceResult> => {
	const mockMacAddress = generateMockMacAddress(context.apiKey);
	const existingMockDevice = await resolveExistingMockDevice(
		context,
		mockMacAddress,
	);

	return (
		existingMockDevice ??
		(await createUnknownLoggerDevice(context, mockMacAddress))
	);
};

const resolveDeviceByApiKey = async (
	context: LogRequestContext & { apiKey: string },
): Promise<LogDeviceResult> => {
	const device = await findDeviceByApiKey(context.apiKey);

	return device
		? resolveKnownApiKeyDevice(context, device)
		: resolveUnknownApiKeyDevice(context);
};

const resolveLogDevice = async (
	context: LogRequestContext & { apiKey: string },
): Promise<LogDeviceResult> => {
	if (context.macAddress) {
		const deviceByMac = await resolveDeviceByMac({
			...context,
			macAddress: context.macAddress,
		});

		if (deviceByMac) {
			return deviceByMac;
		}

		const deviceByApiKeyAndMac = await resolveDeviceByApiKeyAndMac({
			...context,
			macAddress: context.macAddress,
		});

		if (deviceByApiKeyAndMac) {
			return deviceByApiKeyAndMac;
		}
	}

	return resolveDeviceByApiKey(context);
};

const toLogEntry = (log: unknown) => {
	if (typeof log === "object" && log !== null && "creation_timestamp" in log) {
		const logEntry = log as LogEntry;
		return {
			...logEntry,
			timestamp: logEntry.creation_timestamp
				? new Date(logEntry.creation_timestamp * 1000).toISOString()
				: new Date().toISOString(),
		};
	}

	const now = Math.floor(Date.now() / 1000);
	return {
		creation_timestamp: now,
		message: String(log),
		timestamp: new Date().toISOString(),
	};
};

const readLogsArray = async (request: Request) => {
	const requestBody: LogRequestBody = await request.json();
	return Array.isArray(requestBody.logs) ? requestBody.logs : null;
};

const logProcessingStart = (
	logsArray: unknown[],
	state: DeviceLogState,
	metrics: LogRequestHeaders,
) => {
	logInfo("Processing logs array", {
		source: LOG_SOURCE,
		metadata: {
			logs_count: logsArray.length,
			refresh_rate: metrics.refreshRate,
			battery_voltage: metrics.batteryVoltage,
			fw_version: metrics.fwVersion,
			rssi: metrics.rssi,
			device_id: state.deviceId,
			device_found: state.deviceFound,
			device_status: state.deviceStatus,
		},
	});
};

const saveLogs = async (
	logsArray: unknown[],
	state: DeviceLogState,
	metrics: LogRequestHeaders,
) => {
	const logData: LogData = {
		logs_array: logsArray.map(toLogEntry),
	};

	console.log("📦 Processed log data:", JSON.stringify(logData, null, 2));

	try {
		await db
			.insertInto("logs")
			.values({
				friendly_id: state.deviceId,
				log_data: JSON.stringify(logData),
			})
			.execute();
	} catch (insertError) {
		const dbError: CustomError = new Error(
			"Error inserting log with device ID",
		);
		dbError.originalError = insertError;
		console.error(insertError);
		logError(dbError, {
			source: LOG_SOURCE,
			metadata: {
				device_id: state.deviceId,
				refresh_rate: metrics.refreshRate,
				battery_voltage: metrics.batteryVoltage,
				fw_version: metrics.fwVersion,
				rssi: metrics.rssi,
				device_found: state.deviceFound,
				device_status: state.deviceStatus,
			},
		});

		return failedLogSaveResponse();
	}

	logInfo("Log saved successfully", {
		source: LOG_SOURCE,
		metadata: {
			device_id: state.deviceId,
			logs_count: logsArray.length,
			refresh_rate: metrics.refreshRate,
			battery_voltage: metrics.batteryVoltage,
			fw_version: metrics.fwVersion,
			rssi: metrics.rssi,
			device_found: state.deviceFound,
			device_status: state.deviceStatus,
		},
	});

	return null;
};

export async function GET(request: Request) {
	logInfo("Log API GET Request received (unexpected)", {
		source: "api/log",
		metadata: {
			url: request.url,
			method: request.method,
			path: new URL(request.url).pathname,
			search: new URL(request.url).search,
			origin: new URL(request.url).origin,
		},
	});

	// Simply return 404 for GET requests
	return NextResponse.json(
		{
			status: 404,
			message: "Not found",
		},
		{ status: 404 },
	);
}

export async function POST(request: Request) {
	logInfo("Log API Request", {
		source: LOG_SOURCE,
		metadata: {
			url: request.url,
			method: request.method,
			path: new URL(request.url).pathname,
			search: new URL(request.url).search,
			origin: new URL(request.url).origin,
		},
	});

	try {
		const { macAddress, apiKey, metrics } = parseLogRequestHeaders(request);

		if (!apiKey) {
			return NextResponse.json(
				{
					error: "Access-Token header is required",
				},
				{ status: 401 },
			);
		}

		const { ready } = await checkDbConnection();
		if (!ready) {
			console.warn(
				"Database client not initialized, using noDB mode, skipping log processing",
			);
			logInfo(
				"Database client not initialized, using noDB mode, skipping log processing",
				{
					source: LOG_SOURCE,
					metadata: {
						macAddress: macAddress || null,
						hasApiKey: Boolean(apiKey),
						refreshRate: metrics.refreshRate || null,
						batteryVoltage: metrics.batteryVoltage || null,
						fwVersion: metrics.fwVersion || null,
						rssi: metrics.rssi || null,
					},
				},
			);
			return NextResponse.json(
				{
					status: 200,
					message: "Log received",
				},
				{ status: 200 },
			);
		}

		const currentUserId = await getCurrentUserId();
		const resolvedDevice = await resolveLogDevice({
			macAddress,
			apiKey,
			metrics,
			currentUserId,
		});

		if (resolvedDevice.type === "response") {
			return resolvedDevice.response;
		}

		const logsArray = await readLogsArray(request);
		if (!logsArray) {
			return NextResponse.json(
				{
					error: "Invalid request body. Expected { 'logs': [] }",
				},
				{ status: 422 },
			);
		}

		const { state } = resolvedDevice;
		logProcessingStart(logsArray, state, metrics);
		const saveErrorResponse = await saveLogs(logsArray, state, metrics);
		if (saveErrorResponse) {
			return saveErrorResponse;
		}

		return new NextResponse(null, { status: 204 });
	} catch (error) {
		logError(error as Error, {
			source: LOG_SOURCE,
		});
		return internalErrorResponse();
	}
}
