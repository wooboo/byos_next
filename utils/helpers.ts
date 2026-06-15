import crypto from "crypto";
import type { Device, Log } from "@/lib/types";

// Compare two semantic version strings
// Returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2
export function compareVersions(v1: string, v2: string): number {
	const parseVersion = (version: string): number[] =>
		version
			.replace(/^v/i, "")
			.split(".")
			.map((p) => Number.parseInt(p, 10) || 0);

	const parts1 = parseVersion(v1);
	const parts2 = parseVersion(v2);
	const maxLength = Math.max(parts1.length, parts2.length);

	for (let i = 0; i < maxLength; i++) {
		const p1 = parts1[i] || 0;
		const p2 = parts2[i] || 0;
		if (p1 < p2) return -1;
		if (p1 > p2) return 1;
	}
	return 0;
}

// Format date to a readable format
export function formatDate(dateString: string | null): string {
	if (!dateString) return "Never";

	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMsAbs = Math.abs(diffMs);
	const diffSecs = Math.floor(diffMsAbs / 1000);
	const diffMins = Math.floor(diffSecs / 60);
	const diffHours = Math.floor(diffMins / 60);
	const diffDays = Math.floor(diffHours / 24);

	let timeText = "";
	if (diffSecs < 60) {
		timeText = `${diffSecs}s`;
	} else if (diffMins < 60) {
		timeText = `${diffMins}m`;
	} else if (diffHours < 24) {
		timeText = `${diffHours}h`;
	} else if (diffDays < 7) {
		const options: Intl.DateTimeFormatOptions = {
			weekday: "short",
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		};
		timeText = date.toLocaleString("en-US", options);
	} else {
		timeText = date.toLocaleString("en-US", {
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		});
	}

	return diffMs < 0 ? `in ${timeText}` : `${timeText} ago`;
}

// Determine device status based on next expected update time
export function getDeviceStatus(device: Device): "online" | "offline" {
	if (!device.next_expected_update) return "offline";

	const nextExpectedUpdate = new Date(device.next_expected_update);
	const now = new Date();

	// Device is offline if current time is past the next expected update time
	return now < nextExpectedUpdate ? "online" : "offline";
}

// Parse log data to determine log type
export function getLogType(log: Log): "error" | "warning" | "info" {
	const logData = log.log_data.toLowerCase();

	if (logData.includes("error") || logData.includes("fail")) return "error";
	if (logData.includes("warn")) return "warning";

	return "info";
}

// Add validation functions for API key and friendly ID
export const isValidApiKey = (key: string): boolean => {
	const regex = /^[a-zA-Z0-9]{8,60}$/; // Alphanumeric, 8-60 characters
	return regex.test(key);
};

export const isValidFriendlyId = (id: string): boolean => {
	const regex = /^[A-Z0-9]{6}$/; // 6 uppercase alphanumeric characters
	return regex.test(id);
};

// Add the new hashing and generation functions with types
export function hashString(
	input: string,
	salt: string,
	length: number,
	charset: string,
): string {
	const hash = crypto.createHmac("sha256", salt).update(input).digest("hex");
	let result = "";
	for (let i = 0; i < length; i++) {
		result +=
			charset[
				Number.parseInt(hash.slice(i * 2, i * 2 + 2), 16) % charset.length
			];
	}
	return result;
}

export function generateApiKey(macAddress: string, salt?: string): string {
	const normalizedMacAddress = macAddress.toUpperCase().replace(/[:-]/g, ""); // Normalize MAC
	const characters =
		"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	return hashString(
		normalizedMacAddress,
		salt || "API_KEY_SALT",
		22,
		characters,
	);
}

export function generateFriendlyId(macAddress: string, salt?: string): string {
	const normalizedMacAddress = macAddress.toUpperCase().replace(/[:-]/g, ""); // Normalize MAC
	const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	return hashString(
		normalizedMacAddress,
		salt || "FRIENDLY_ID_SALT",
		6,
		characters,
	);
}

const timezoneLabelOverrides = new Map<string, string>([
	["UTC", "UTC"],
	["Europe/London", "London (GMT/BST)"],
	["Europe/Paris", "Paris (CET/CEST)"],
	["Europe/Berlin", "Berlin (CET/CEST)"],
	["Europe/Madrid", "Madrid (CET/CEST)"],
	["Europe/Rome", "Rome (CET/CEST)"],
	["Europe/Amsterdam", "Amsterdam (CET/CEST)"],
	["Europe/Athens", "Athens (EET/EEST)"],
	["Europe/Moscow", "Moscow (MSK)"],
	["America/New_York", "New York (EST/EDT)"],
	["America/Chicago", "Chicago (CST/CDT)"],
	["America/Denver", "Denver (MST/MDT)"],
	["America/Los_Angeles", "Los Angeles (PST/PDT)"],
	["America/Toronto", "Toronto (EST/EDT)"],
	["America/Vancouver", "Vancouver (PST)"],
	["Asia/Tokyo", "Tokyo (JST)"],
	["Asia/Shanghai", "Shanghai (CST)"],
	["Asia/Singapore", "Singapore (SGT)"],
	["Asia/Dubai", "Dubai (GST)"],
	["Asia/Hong_Kong", "Hong Kong (HKT)"],
	["Australia/Sydney", "Sydney (AEST/AEDT)"],
	["Australia/Melbourne", "Melbourne (AEST/AEDT)"],
	["Australia/Perth", "Perth (AWST)"],
	["Pacific/Auckland", "Auckland (NZST/NZDT)"],
]);

const timezoneRegionOrder = [
	"UTC",
	"Africa",
	"America",
	"Antarctica",
	"Arctic",
	"Asia",
	"Atlantic",
	"Australia",
	"Europe",
	"Indian",
	"Pacific",
] as const;

const getSupportedTimeZones = () => {
	const intlWithSupportedValues = Intl as typeof Intl & {
		supportedValuesOf?: (key: "timeZone") => string[];
	};
	return intlWithSupportedValues.supportedValuesOf?.("timeZone") ?? [];
};

const getTimezoneRegion = (timezone: string) =>
	timezone.split("/")[0] || "Other";

const getTimezoneLabel = (timezone: string) => {
	const override = timezoneLabelOverrides.get(timezone);
	if (override) return override;
	const parts = timezone.split("/");
	const city = (parts[parts.length - 1] || timezone).replace(/_/g, " ");
	return `${city} (${timezone})`;
};

const compareTimezones = (
	a: { label: string; region: string },
	b: { label: string; region: string },
) => {
	const regionA = timezoneRegionOrder.indexOf(
		a.region as (typeof timezoneRegionOrder)[number],
	);
	const regionB = timezoneRegionOrder.indexOf(
		b.region as (typeof timezoneRegionOrder)[number],
	);
	const safeRegionA = regionA === -1 ? timezoneRegionOrder.length : regionA;
	const safeRegionB = regionB === -1 ? timezoneRegionOrder.length : regionB;
	if (safeRegionA !== safeRegionB) return safeRegionA - safeRegionB;
	return a.label.localeCompare(b.label);
};

// Full IANA timezone list grouped by region.
export const timezones = Array.from(
	new Set([
		"UTC",
		...getSupportedTimeZones(),
		...timezoneLabelOverrides.keys(),
	]),
)
	.map((value) => ({
		value,
		label: getTimezoneLabel(value),
		region: getTimezoneRegion(value),
	}))
	.sort(compareTimezones);

// Format timezone for display
export const formatTimezone = (timezone: string): string => {
	const found = timezones.find((tz) => tz.value === timezone);
	return found ? found.label : timezone;
};

export function estimateBatteryLife(
	batteryVoltage: number,
	refreshPerDay: number,
	batteryCapacity = 1800, // use 2500mAh if you have battery upgrade
): { batteryPercentage: number; remainingDays: number; isCharging: boolean } {
	// Battery voltage range (adjust based on real battery discharge curve if needed)
	const V_CHARGING = 4.6; // Charging voltage
	const V_MAX = 4.2; // Fully charged
	const V_MIN = 3.6; // Cutoff voltage

	// Estimate battery percentage (linear approximation)
	const batteryPercentage = Math.max(
		0,
		Math.min(100, ((batteryVoltage - V_MIN) / (V_MAX - V_MIN)) * 100),
	);

	// Power consumption rates
	const SLEEP_POWER = 0.1 * 24; // 0.1mA * 24h = 2.4mAh per day in sleep mode
	const REFRESH_POWER = 32.8 * (24 / 3600); // 32.8mA for 24s per refresh (converted to mAh)

	// Total daily power consumption
	const dailyConsumption = refreshPerDay * REFRESH_POWER + SLEEP_POWER;

	// Remaining days calculation
	const remainingDays =
		((batteryCapacity || 1000) * (batteryPercentage / 100)) / dailyConsumption;

	return {
		batteryPercentage: Number.parseFloat(batteryPercentage.toFixed(2)),
		remainingDays: Number.parseFloat(remainingDays.toFixed(2)),
		isCharging: batteryVoltage > V_CHARGING,
	};
}
