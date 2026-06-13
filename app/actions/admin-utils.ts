"use server";

import { getCurrentUser } from "@/lib/auth/get-user";
import { checkDbConnection } from "@/lib/database/utils";

const DATABASE_UNAVAILABLE_ERROR = "Database not available";

export type AdminActionResult = {
	success: boolean;
	error?: string;
};

type AdminActionOptions = {
	logMessage?: string;
	unknownError?: string;
};

export async function requireAdmin() {
	const user = await getCurrentUser();
	if (!user || user.role !== "admin") {
		throw new Error("Unauthorized");
	}
	return user;
}

export async function withAdminDb<T>(
	unavailableResult: T,
	action: () => Promise<T>,
): Promise<T> {
	await requireAdmin();
	const { ready } = await checkDbConnection();
	if (!ready) {
		return unavailableResult;
	}

	return action();
}

export async function runAdminAction<T extends AdminActionResult>(
	action: () => Promise<T>,
	options: AdminActionOptions = {},
): Promise<T> {
	return withAdminDb(
		{ success: false, error: DATABASE_UNAVAILABLE_ERROR } as T,
		async () => {
			try {
				return await action();
			} catch (error) {
				if (options.logMessage) {
					console.error(options.logMessage, error);
				}

				return {
					success: false,
					error:
						error instanceof Error
							? error.message
							: (options.unknownError ?? String(error)),
				} as T;
			}
		},
	);
}
