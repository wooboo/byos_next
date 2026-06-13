"use server";

import type { SelectQueryBuilder } from "kysely";
import { auth } from "@/lib/auth/auth";
import { getCurrentUser } from "@/lib/auth/get-user";
import { db } from "@/lib/database/db";
import type { DB } from "@/lib/database/db.d";
import { checkDbConnection } from "@/lib/database/utils";
import type { SystemLog } from "@/lib/types";

type FetchSystemLogsParams = {
	page: number;
	perPage: number;
	search?: string;
	level?: string;
	source?: string;
};

type FetchSystemLogsResult = {
	logs: SystemLog[];
	total: number;
	uniqueSources: string[];
};

type SystemLogsQuery<O> = SelectQueryBuilder<DB, "system_logs", O>;
type BaseSystemLogFilters = Pick<FetchSystemLogsParams, "level" | "source">;
type SystemLogSearchFilter = Pick<FetchSystemLogsParams, "search">;
type SystemLogDeviceFilters = Pick<
	FetchDeviceSystemLogsParams,
	"apiKey" | "deviceId" | "friendlyId" | "macAddress"
>;

const EMPTY_SYSTEM_LOGS_RESULT: FetchSystemLogsResult = {
	logs: [],
	total: 0,
	uniqueSources: [],
};

async function canReadSystemLogs(): Promise<boolean> {
	if (!auth) {
		return true;
	}

	const user = await getCurrentUser();
	return user?.role === "admin";
}

async function canFetchSystemLogs(): Promise<boolean> {
	const { ready } = await checkDbConnection();

	if (!ready) {
		console.warn("Database client not initialized");
		return false;
	}

	return canReadSystemLogs();
}

function applyBaseSystemLogFilters<O>(
	query: SystemLogsQuery<O>,
	{ level, source }: BaseSystemLogFilters,
): SystemLogsQuery<O> {
	let filteredQuery = query;

	if (level) {
		filteredQuery = filteredQuery.where("level", "=", level);
	}

	if (source) {
		filteredQuery = filteredQuery.where("source", "=", source);
	}

	return filteredQuery;
}

function applySearchFilter<O>(
	query: SystemLogsQuery<O>,
	{ search }: SystemLogSearchFilter,
): SystemLogsQuery<O> {
	if (!search) return query;

	return query.where((eb) =>
		eb.or([
			eb("message", "ilike", `%${search}%`),
			eb("metadata", "ilike", `%${search}%`),
		]),
	);
}

function applyDeviceFilters<O>(
	query: SystemLogsQuery<O>,
	{
		apiKey,
		deviceId,
		friendlyId,
		macAddress,
		search,
	}: SystemLogDeviceFilters & SystemLogSearchFilter,
): SystemLogsQuery<O> {
	return query.where((eb) => {
		const ors = [];

		if (search) {
			ors.push(eb("message", "ilike", `%${search}%`));
			ors.push(eb("metadata", "ilike", `%${search}%`));
		}

		if (deviceId) {
			ors.push(eb("metadata", "ilike", `%"device_id":${deviceId}%`));
			ors.push(eb("metadata", "ilike", `%"id":${deviceId}%`));
		}

		if (friendlyId) {
			ors.push(eb("metadata", "ilike", `%"friendly_id":"${friendlyId}"%`));
		}

		if (macAddress) {
			ors.push(eb("metadata", "ilike", `%"mac_address":"${macAddress}"%`));
		}

		if (apiKey) {
			ors.push(eb("metadata", "ilike", `%"api_key":"${apiKey}"%`));
		}

		return ors.length > 0 ? eb.or(ors) : eb.and([]);
	});
}

async function fetchUniqueSystemLogSources(): Promise<string[]> {
	const uniqueSourcesResult = await db
		.selectFrom("system_logs")
		.select("source")
		.distinct()
		.orderBy("source", "asc")
		.execute();

	return uniqueSourcesResult
		.map((item) => item.source)
		.filter(Boolean) as string[];
}

function baseSystemLogQuery() {
	return db.selectFrom("system_logs").selectAll();
}

function systemLogCountQuery() {
	return db
		.selectFrom("system_logs")
		.select((eb) => eb.fn.countAll().as("count"));
}

async function executeSystemLogsQuery<O extends Record<string, unknown>>(
	query: SystemLogsQuery<O>,
	countQuery: SystemLogsQuery<{ count: string | number | bigint }>,
	page: number,
	perPage: number,
): Promise<FetchSystemLogsResult> {
	const offset = (page - 1) * perPage;
	const logs = await query
		.orderBy("created_at", "desc")
		.limit(perPage)
		.offset(offset)
		.execute();
	const countResult = await countQuery.executeTakeFirst();
	const uniqueSources = await fetchUniqueSystemLogSources();

	return {
		logs: logs as unknown as SystemLog[],
		total: Number(countResult?.count || 0),
		uniqueSources,
	};
}

export async function fetchSystemLogs({
	page,
	perPage,
	search,
	level,
	source,
}: FetchSystemLogsParams): Promise<FetchSystemLogsResult> {
	if (!(await canFetchSystemLogs())) {
		return EMPTY_SYSTEM_LOGS_RESULT;
	}

	const filters = { level, search, source };
	const query = applySearchFilter(
		applyBaseSystemLogFilters(baseSystemLogQuery(), filters),
		filters,
	);
	const countQuery = applySearchFilter(
		applyBaseSystemLogFilters(systemLogCountQuery(), filters),
		filters,
	);

	return executeSystemLogsQuery(query, countQuery, page, perPage);
}

/**
 * Fetch system logs that contain device information in the metadata
 */
export type FetchDeviceSystemLogsParams = {
	page: number;
	perPage: number;
	search?: string;
	level?: string;
	source?: string;
	deviceId?: number;
	friendlyId?: string;
	macAddress?: string;
	apiKey?: string;
};

export async function fetchDeviceSystemLogs({
	page,
	perPage,
	search,
	level,
	source,
	deviceId,
	friendlyId,
	macAddress,
	apiKey,
}: FetchDeviceSystemLogsParams): Promise<FetchSystemLogsResult> {
	if (!(await canFetchSystemLogs())) {
		return EMPTY_SYSTEM_LOGS_RESULT;
	}

	const filters = {
		apiKey,
		deviceId,
		friendlyId,
		level,
		macAddress,
		search,
		source,
	};
	const query = applyDeviceFilters(
		applyBaseSystemLogFilters(baseSystemLogQuery(), filters),
		filters,
	);
	const countQuery = applyDeviceFilters(
		applyBaseSystemLogFilters(systemLogCountQuery(), filters),
		filters,
	);

	return executeSystemLogsQuery(query, countQuery, page, perPage);
}
