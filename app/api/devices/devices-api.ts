import type { Selectable } from "kysely";
import type { db } from "@/lib/database/db";
import type { DB } from "@/lib/database/db.d";
import type { Device } from "@/lib/types";

type ScopedDb = typeof db;
type DeviceRow = Selectable<DB["devices"]>;

export function toDeviceApiData(device: DeviceRow) {
	const deviceObj = device as unknown as Device;
	const batteryVoltage = deviceObj.battery_voltage
		? Number.parseFloat(deviceObj.battery_voltage.toString())
		: null;

	return {
		id: Number.parseInt(device.id.toString(), 10),
		name: deviceObj.name,
		friendly_id: deviceObj.friendly_id,
		mac_address: deviceObj.mac_address,
		battery_voltage: batteryVoltage,
		rssi: deviceObj.rssi,
		percent_charged: batteryVoltage
			? Math.min(100, Math.max(0, ((batteryVoltage - 3.0) / (4.2 - 3.0)) * 100))
			: null,
		wifi_strength: deviceObj.rssi
			? Math.min(100, Math.max(0, ((deviceObj.rssi + 100) / 70) * 100))
			: null,
	};
}

export async function findDeviceByIdOrFriendlyId(
	scopedDb: ScopedDb,
	id: string,
) {
	const numericId = Number.parseInt(id, 10);

	if (!Number.isNaN(numericId)) {
		const byId = await scopedDb
			.selectFrom("devices")
			.selectAll()
			.where("id", "=", numericId.toString())
			.executeTakeFirst();
		if (byId) return byId;
	}

	return scopedDb
		.selectFrom("devices")
		.selectAll()
		.where("friendly_id", "=", id)
		.executeTakeFirst();
}
