const DB_NOT_INITIALIZED = "Database client not initialized";

export type ActionErrorResult = {
	success: false;
	error: string;
};

export function databaseUnavailableResult(): ActionErrorResult {
	console.warn(DB_NOT_INITIALIZED);
	return { success: false, error: DB_NOT_INITIALIZED };
}

export function actionErrorResult(
	message: string,
	error: unknown,
): ActionErrorResult {
	console.error(message, error);
	return {
		success: false,
		error: error instanceof Error ? error.message : String(error),
	};
}
