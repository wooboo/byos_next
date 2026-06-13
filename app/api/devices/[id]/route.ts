import { NextResponse } from "next/server";
import { withUserScope } from "@/lib/database/scoped-db";
import { checkDbConnection } from "@/lib/database/utils";
import { logError, logInfo } from "@/lib/logger";
import { findDeviceByIdOrFriendlyId, toDeviceApiData } from "../devices-api";

/**
 * GET /api/devices/{id}
 * Get the data of a specific device
 *
 * @param id - Device ID (can be numeric ID or friendly_id)
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const { ready } = await checkDbConnection();

	if (!ready) {
		logInfo("Database not available for /api/devices/{id}", {
			source: "api/devices/[id]",
			metadata: { id },
		});
		return NextResponse.json(
			{
				error: "Database not available",
			},
			{ status: 503 },
		);
	}

	try {
		const device = await withUserScope((scopedDb) =>
			findDeviceByIdOrFriendlyId(scopedDb, id),
		);

		if (!device) {
			return NextResponse.json(
				{
					error: "Device not found",
				},
				{ status: 404 },
			);
		}

		// Transform device to match TRMNL API format
		const deviceData = toDeviceApiData(device);

		logInfo("Device data request successful", {
			source: "api/devices/[id]",
			metadata: { deviceId: id },
		});

		return NextResponse.json(
			{
				data: deviceData,
			},
			{ status: 200 },
		);
	} catch (error) {
		logError(error as Error, {
			source: "api/devices/[id]",
			metadata: { id },
		});
		return NextResponse.json(
			{
				error: "Internal server error",
			},
			{ status: 500 },
		);
	}
}
