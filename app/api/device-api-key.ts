import crypto from "crypto";
import type { Selectable } from "kysely";
import type { db } from "@/lib/database/db";
import type { DB } from "@/lib/database/db.d";
import { logError, logInfo } from "@/lib/logger";
import { generateApiKey, generateFriendlyId } from "@/utils/helpers";

type DeviceRow = Selectable<DB["devices"]>;

type FindDeviceByApiKeyOptions = {
	apiKey: string;
	macAddress: string;
	source: string;
	successMessage: string;
};

export const generateMockMacAddress = (apiKey: string): string => {
	const hash = crypto.createHash("sha256").update(apiKey).digest("hex");
	const macPart = hash.substring(hash.length - 6).toUpperCase();
	return `A1:B2:C3:${macPart.substring(0, 2)}:${macPart.substring(2, 4)}:${macPart.substring(4, 6)}`;
};

export const createMockDeviceIdentity = (
	apiKey: string,
	macAddress: string | null | undefined,
) => {
	const mockMacAddress = generateMockMacAddress(apiKey);
	const timestamp = new Date().toISOString().replace(/[-:Z]/g, "");

	return {
		mockMacAddress,
		friendlyId: generateFriendlyId(mockMacAddress, timestamp),
		apiKey: macAddress ? apiKey : generateApiKey(mockMacAddress, timestamp),
	};
};

export async function findDeviceByApiKeyAndUpdateMac(
	database: typeof db,
	{ apiKey, macAddress, source, successMessage }: FindDeviceByApiKeyOptions,
): Promise<DeviceRow | undefined> {
	const deviceByApiKey = await database
		.selectFrom("devices")
		.selectAll()
		.where("api_key", "=", apiKey)
		.executeTakeFirst();

	if (!deviceByApiKey) return undefined;

	try {
		await database
			.updateTable("devices")
			.set({
				mac_address: macAddress,
				updated_at: new Date().toISOString(),
			})
			.where("friendly_id", "=", deviceByApiKey.friendly_id)
			.execute();

		logInfo(successMessage, {
			source,
			metadata: {
				device_id: deviceByApiKey.friendly_id,
				mac_address: macAddress,
				has_api_key: Boolean(apiKey),
			},
		});
	} catch (updateError) {
		logError(new Error("Error updating MAC address for device"), {
			source,
			metadata: {
				device_id: deviceByApiKey.friendly_id,
				mac_address: macAddress,
				has_api_key: Boolean(apiKey),
				error: updateError,
			},
		});
	}

	return deviceByApiKey;
}
