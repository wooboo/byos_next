"use server";

import { runAdminAction } from "@/app/actions/admin-utils";
import { db } from "@/lib/database/db";

export async function deleteAllSystemLogs(): Promise<{
	success: boolean;
	count?: number;
	error?: string;
}> {
	return runAdminAction(
		async () => {
			const result = await db
				.deleteFrom("system_logs")
				.where("id", "is not", null)
				.executeTakeFirst();

			return { success: true, count: Number(result.numDeletedRows) };
		},
		{
			logMessage: "Error deleting system logs:",
			unknownError: "Unknown error",
		},
	);
}

export async function deleteAllDeviceLogs(): Promise<{
	success: boolean;
	count?: number;
	error?: string;
}> {
	return runAdminAction(
		async () => {
			const result = await db
				.deleteFrom("logs")
				.where("id", ">", "0")
				.executeTakeFirst();

			return { success: true, count: Number(result.numDeletedRows) };
		},
		{
			logMessage: "Error deleting device logs:",
			unknownError: "Unknown error",
		},
	);
}
