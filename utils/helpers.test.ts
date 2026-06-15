import assert from "node:assert/strict";
import { describe, it } from "vitest";
import type { Device, Log } from "../lib/types.ts";
import {
	compareVersions,
	estimateBatteryLife,
	formatDate,
	formatTimezone,
	generateApiKey,
	generateFriendlyId,
	getDeviceStatus,
	getLogType,
	hashString,
	isValidApiKey,
	isValidFriendlyId,
	timezones,
} from "./helpers.ts";

describe("version and date helpers", () => {
	it("compares semantic versions with optional v prefix and missing parts", () => {
		assert.equal(compareVersions("v1.2.0", "1.2"), 0);
		assert.equal(compareVersions("1.2.1", "1.2.0"), 1);
		assert.equal(compareVersions("1.1.9", "1.2.0"), -1);
		assert.equal(compareVersions("bad", "0.0.1"), -1);
	});

	it("formats missing, past, and future dates", () => {
		assert.equal(formatDate(null), "Never");

		const past = new Date(Date.now() - 90_000).toISOString();
		const future = new Date(Date.now() + 90_000).toISOString();

		assert.match(formatDate(past), /^1m ago$/);
		assert.match(formatDate(future), /^in 1m$/);
	});

	it("formats hour, weekday, and month/day date ranges", () => {
		const hoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
		const daysAgo = new Date(
			Date.now() - 3 * 24 * 60 * 60 * 1000,
		).toISOString();
		const weeksAgo = new Date(
			Date.now() - 10 * 24 * 60 * 60 * 1000,
		).toISOString();

		assert.match(formatDate(hoursAgo), /^3h ago$/);
		assert.match(formatDate(daysAgo), /^[A-Z][a-z]{2} \d{2}:\d{2} ago$/);
		assert.match(formatDate(weeksAgo), /^\d{2}\/\d{2}, \d{2}:\d{2} ago$/);
	});
});

describe("device and log helpers", () => {
	it("derives device status from next expected update", () => {
		assert.equal(
			getDeviceStatus({ next_expected_update: null } as Device),
			"offline",
		);
		assert.equal(
			getDeviceStatus({
				next_expected_update: new Date(Date.now() + 60_000).toISOString(),
			} as Device),
			"online",
		);
		assert.equal(
			getDeviceStatus({
				next_expected_update: new Date(Date.now() - 60_000).toISOString(),
			} as Device),
			"offline",
		);
	});

	it("classifies logs by data content", () => {
		assert.equal(getLogType({ log_data: "ERROR: failed" } as Log), "error");
		assert.equal(getLogType({ log_data: "request failed" } as Log), "error");
		assert.equal(getLogType({ log_data: "warn: slow" } as Log), "warning");
		assert.equal(getLogType({ log_data: "connected" } as Log), "info");
	});
});

describe("identifier helpers", () => {
	it("validates API keys and friendly IDs", () => {
		assert.equal(isValidApiKey("abcDEF123"), true);
		assert.equal(isValidApiKey("short"), false);
		assert.equal(isValidApiKey("invalid-key"), false);
		assert.equal(isValidFriendlyId("ABC123"), true);
		assert.equal(isValidFriendlyId("abc123"), false);
		assert.equal(isValidFriendlyId("ABC1234"), false);
	});

	it("generates deterministic API keys and friendly IDs from MAC addresses", () => {
		const mac = "aa:bb:cc:dd:ee:ff";
		assert.equal(
			generateApiKey(mac, "salt"),
			generateApiKey("AABBCCDDEEFF", "salt"),
		);
		assert.equal(generateApiKey(mac, "salt").length, 22);
		assert.equal(generateFriendlyId(mac, "salt").length, 6);
		assert.match(hashString("input", "salt", 8, "AB"), /^[AB]{8}$/);
	});
});

describe("timezone and battery helpers", () => {
	it("formats known timezones and passes unknown values through", () => {
		assert.equal(formatTimezone("Europe/London"), "London (GMT/BST)");
		assert.equal(formatTimezone("Mars/Base"), "Mars/Base");
	});

	it("exposes the full IANA timezone list with UTC included", () => {
		assert.ok(timezones.length > 100);
		assert.ok(timezones.some((tz) => tz.value === "UTC"));
		assert.ok(timezones.some((tz) => tz.value === "Pacific/Chatham"));
		assert.ok(timezones.some((tz) => tz.value === "America/Argentina/Ushuaia"));
	});

	it("estimates battery percentage, charging state, and remaining days", () => {
		assert.deepEqual(estimateBatteryLife(3.6, 1), {
			batteryPercentage: 0,
			remainingDays: 0,
			isCharging: false,
		});

		const charged = estimateBatteryLife(4.8, 24, 2500);
		assert.equal(charged.batteryPercentage, 100);
		assert.equal(charged.isCharging, true);
		assert.ok(charged.remainingDays > 0);

		const fallbackCapacity = estimateBatteryLife(3.9, 12, 0);
		assert.equal(fallbackCapacity.isCharging, false);
		assert.ok(fallbackCapacity.remainingDays > 0);
	});
});
