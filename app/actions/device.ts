"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth/get-user";
import { db } from "@/lib/database/db";
import { withUserScope } from "@/lib/database/scoped-db";
import { checkDbConnection } from "@/lib/database/utils";
import type { Device, Log } from "@/lib/types";
import { generateFriendlyId } from "@/utils/helpers";

/**
 * Fetch a single device by friendly_id
 */
export async function fetchDeviceByFriendlyId(
	friendlyId: string,
): Promise<Device | null> {
	const { ready } = await checkDbConnection();

	if (!ready) {
		console.warn("Database client not initialized");
		return null;
	}

	const device = await withUserScope((scopedDb) =>
		scopedDb
			.selectFrom("devices")
			.selectAll()
			.where("friendly_id", "=", friendlyId)
			.executeTakeFirst(),
	);

	if (!device) {
		return null;
	}

	return device as unknown as Device;
}

/**
 * Fetch logs for a specific device
 */
export async function fetchDeviceLogs(friendlyId: string): Promise<Log[]> {
	const { ready } = await checkDbConnection();

	if (!ready) {
		console.warn("Database client not initialized");
		return [];
	}

	const visibleDeviceIds = await getVisibleDeviceFriendlyIds(friendlyId);
	if (visibleDeviceIds.length === 0) {
		return [];
	}

	const logs = await db
		.selectFrom("logs")
		.selectAll()
		.where("friendly_id", "in", visibleDeviceIds)
		.orderBy("created_at", "desc")
		.limit(50)
		.execute();

	return logs as unknown as Log[];
}

/**
 * Fetch device logs with pagination and filtering
 */
export type FetchDeviceLogsParams = {
	page: number;
	perPage: number;
	search?: string;
	friendlyId?: string;
};

export type FetchDeviceLogsResult = {
	logs: Log[];
	total: number;
	uniqueTypes: string[];
};

async function getVisibleDeviceFriendlyIds(
	friendlyId?: string,
): Promise<string[]> {
	const devices = await withUserScope((scopedDb) => {
		let query = scopedDb.selectFrom("devices").select("friendly_id");
		if (friendlyId) {
			query = query.where("friendly_id", "=", friendlyId);
		}
		return query.execute();
	});

	return devices.map((device) => device.friendly_id);
}

export async function fetchDeviceLogsWithFilters({
	page,
	perPage,
	search,
	friendlyId,
}: FetchDeviceLogsParams): Promise<FetchDeviceLogsResult> {
	const { ready } = await checkDbConnection();

	if (!ready) {
		console.warn("Database client not initialized");
		return { logs: [], total: 0, uniqueTypes: [] };
	}

	// Calculate pagination
	const offset = (page - 1) * perPage;
	const visibleDeviceIds = await getVisibleDeviceFriendlyIds(friendlyId);

	if (visibleDeviceIds.length === 0) {
		return { logs: [], total: 0, uniqueTypes: [] };
	}

	// Start building the query
	let query = db
		.selectFrom("logs")
		.selectAll()
		.where("friendly_id", "in", visibleDeviceIds);

	if (search) {
		query = query.where("log_data", "ilike", `%${search}%`);
	}

	// Get paginated results
	const logs = await query
		.orderBy("created_at", "desc")
		.limit(perPage)
		.offset(offset)
		.execute();

	// Get total count
	let countQuery = db
		.selectFrom("logs")
		.select((eb) => eb.fn.countAll().as("count"))
		.where("friendly_id", "in", visibleDeviceIds);

	if (search) {
		countQuery = countQuery.where("log_data", "ilike", `%${search}%`);
	}

	const countResult = await countQuery.executeTakeFirst();

	// Get unique types for the filter dropdown
	// We need to fetch all relevant logs or perform a distinct query on the log_data content which might be hard with SQL only if it requires parsing
	// The original code fetched all logs (with pagination) and then computed uniqueTypes from the returned page.
	// Wait, the original code: `const { data: logs } = await query...` then `(logs || []).map...`
	// It only computed unique types from the *current page* of logs. That seems correct to replicate.

	const logsData = logs as unknown as Log[];

	const uniqueTypes = Array.from(
		new Set(
			logsData.map((log) => {
				const logData = log.log_data.toLowerCase();

				if (logData.includes("error") || logData.includes("fail")) {
					return "error";
				}
				if (logData.includes("warn")) {
					return "warning";
				}

				return "info";
			}),
		),
	);

	return {
		logs: logsData,
		total: Number(countResult?.count || 0),
		uniqueTypes,
	};
}

/**
 * Update a device
 */
type UpdateDeviceInput = Partial<Device> & { id: number };

const DEVICE_UPDATE_FIELDS_BEFORE_REFRESH = [
	"name",
	"mac_address",
	"api_key",
	"friendly_id",
	"timezone",
] as const satisfies readonly (keyof Device)[];

const DEVICE_UPDATE_FIELDS_AFTER_REFRESH = [
	"screen",
	"screen_id",
	"screen_type",
	"playlist_id",
	"mixup_id",
	"display_mode",
	"battery_voltage",
	"firmware_version",
	"rssi",
	"screen_width",
	"screen_height",
	"screen_orientation",
	"grayscale",
] as const satisfies readonly (keyof Device)[];

type DeviceUpdateField =
	| (typeof DEVICE_UPDATE_FIELDS_BEFORE_REFRESH)[number]
	| (typeof DEVICE_UPDATE_FIELDS_AFTER_REFRESH)[number];

function setDefinedDeviceUpdateField(
	updateData: Record<string, unknown>,
	device: UpdateDeviceInput,
	field: DeviceUpdateField,
) {
	const value = device[field];
	if (value !== undefined) {
		updateData[field] = value;
	}
}

function setRefreshScheduleUpdate(
	updateData: Record<string, unknown>,
	device: UpdateDeviceInput,
) {
	if (device.refresh_schedule !== undefined) {
		updateData.refresh_schedule = device.refresh_schedule
			? JSON.stringify(device.refresh_schedule)
			: null;
	}
}

function buildDeviceUpdateData(
	device: UpdateDeviceInput,
): Record<string, unknown> {
	const updateData: Record<string, unknown> = {};

	for (const field of DEVICE_UPDATE_FIELDS_BEFORE_REFRESH) {
		setDefinedDeviceUpdateField(updateData, device, field);
	}
	setRefreshScheduleUpdate(updateData, device);
	for (const field of DEVICE_UPDATE_FIELDS_AFTER_REFRESH) {
		setDefinedDeviceUpdateField(updateData, device, field);
	}
	updateData.updated_at = new Date().toISOString();

	return updateData;
}

export async function updateDevice(
	device: UpdateDeviceInput,
): Promise<{ success: boolean; error?: string }> {
	const { ready } = await checkDbConnection();

	if (!ready) {
		console.warn("Database client not initialized");
		return { success: false, error: "Database client not initialized" };
	}

	const updateData = buildDeviceUpdateData(device);

	try {
		await withUserScope((scopedDb) =>
			scopedDb
				.updateTable("devices")
				.set(updateData)
				.where("id", "=", String(device.id))
				.execute(),
		);

		return { success: true };
	} catch (error) {
		console.error("Error updating device:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Delete a device owned by the current user.
 */
export async function deleteDevice(friendlyId: string): Promise<void> {
	const { ready } = await checkDbConnection();

	if (!ready) {
		throw new Error("Database client not initialized");
	}

	await withUserScope((scopedDb) =>
		scopedDb
			.deleteFrom("devices")
			.where("friendly_id", "=", friendlyId)
			.execute(),
	);

	revalidatePath("/");
	revalidatePath(`/device/${friendlyId}`);
	redirect("/");
}

/**
 * Add a new device for the current user.
 * Creates a device record with a placeholder MAC address that will be
 * replaced when the physical device connects via /api/setup.
 */
export async function addUserDevice(input: {
	apiKey: string;
	name?: string;
}): Promise<{
	success: boolean;
	apiKey?: string;
	friendlyId?: string;
	error?: string;
}> {
	const { ready } = await checkDbConnection();
	if (!ready) {
		return { success: false, error: "Database not available" };
	}

	const userId = await getCurrentUserId();
	if (!userId) {
		return { success: false, error: "You must be signed in to add a device" };
	}

	const apiKey = input.apiKey.trim();
	if (!apiKey || apiKey.length < 8) {
		return {
			success: false,
			error: "API key must be at least 8 characters",
		};
	}

	try {
		// Check uniqueness of API key (bypass RLS to check across all users)
		const existing = await db
			.selectFrom("devices")
			.select("id")
			.where("api_key", "=", apiKey)
			.executeTakeFirst();

		if (existing) {
			return {
				success: false,
				error: "A device with this API key already exists",
			};
		}

		// Generate a placeholder MAC from the API key (will be replaced on /api/setup)
		const hash = crypto.createHash("sha256").update(apiKey).digest("hex");
		const mockMac = [
			hash.slice(0, 2),
			hash.slice(2, 4),
			hash.slice(4, 6),
			hash.slice(6, 8),
			hash.slice(8, 10),
			hash.slice(10, 12),
		]
			.join(":")
			.toUpperCase();

		const timestamp = new Date().toISOString().replace(/[-:Z]/g, "");
		const friendlyId = generateFriendlyId(mockMac, timestamp);
		const deviceName = input.name?.trim() || `TRMNL Device ${friendlyId}`;

		await withUserScope((scopedDb) =>
			scopedDb
				.insertInto("devices")
				.values({
					mac_address: mockMac,
					name: deviceName,
					friendly_id: friendlyId,
					api_key: apiKey,
					user_id: userId,
					refresh_schedule: JSON.stringify({
						default_refresh_rate: 60,
						time_ranges: [
							{
								start_time: "00:00",
								end_time: "07:00",
								refresh_rate: 3600,
							},
						],
					}),
					last_update_time: new Date().toISOString(),
					next_expected_update: new Date(
						Date.now() + 3600 * 1000,
					).toISOString(),
					timezone: "Europe/London",
				})
				.execute(),
		);

		return { success: true, apiKey, friendlyId };
	} catch (error) {
		console.error("Error adding device:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}
