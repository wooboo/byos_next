"use server";

import { runAdminAction, withAdminDb } from "@/app/actions/admin-utils";
import { db } from "@/lib/database/db";

export interface AdminDevice {
	id: number;
	name: string;
	friendly_id: string;
	api_key: string;
	mac_address: string;
	user_id: string | null;
	user_name: string | null;
	user_email: string | null;
	created_at: string | null;
	updated_at: string | null;
}

export interface AdminUser {
	id: string;
	name: string;
	email: string;
}

export async function fetchAllDevicesAdmin(): Promise<AdminDevice[]> {
	return withAdminDb([], async () => {
		const devices = await db
			.selectFrom("devices")
			.leftJoin("user", "devices.user_id", "user.id")
			.select([
				"devices.id",
				"devices.name",
				"devices.friendly_id",
				"devices.api_key",
				"devices.mac_address",
				"devices.user_id",
				"user.name as user_name",
				"user.email as user_email",
				"devices.created_at",
				"devices.updated_at",
			])
			.orderBy("devices.created_at", "desc")
			.execute();

		return devices as unknown as AdminDevice[];
	});
}

export async function fetchAllUsersForAdmin(): Promise<AdminUser[]> {
	return withAdminDb(
		[],
		() =>
			db
				.selectFrom("user")
				.select(["id", "name", "email"])
				.orderBy("name", "asc")
				.execute() as Promise<AdminUser[]>,
	);
}

export async function assignDeviceToUser(
	deviceId: number,
	userId: string,
): Promise<{ success: boolean; error?: string }> {
	return runAdminAction(async () => {
		await db
			.updateTable("devices")
			.set({ user_id: userId, updated_at: new Date().toISOString() })
			.where("id", "=", String(deviceId))
			.execute();
		return { success: true };
	});
}

export async function unassignDevice(
	deviceId: number,
): Promise<{ success: boolean; error?: string }> {
	return runAdminAction(async () => {
		await db
			.updateTable("devices")
			.set({ user_id: null, updated_at: new Date().toISOString() })
			.where("id", "=", String(deviceId))
			.execute();
		return { success: true };
	});
}

export async function deleteDeviceAdmin(
	deviceId: number,
): Promise<{ success: boolean; error?: string }> {
	return runAdminAction(async () => {
		await db.deleteFrom("devices").where("id", "=", String(deviceId)).execute();
		return { success: true };
	});
}
