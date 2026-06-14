import { describe, expect, it, vi } from "vitest";
import { findDeviceByIdOrFriendlyId, toDeviceApiData } from "./devices-api";

describe("app/api/devices/devices-api", () => {
	it("maps device rows to the TRMNL device contract", () => {
		expect(
			toDeviceApiData({
				id: "7",
				name: "Kitchen",
				friendly_id: "kitchen-7",
				mac_address: "AA:BB:CC",
				battery_voltage: "3.6",
				rssi: -65,
			} as never),
		).toEqual({
			id: 7,
			name: "Kitchen",
			friendly_id: "kitchen-7",
			mac_address: "AA:BB:CC",
			battery_voltage: 3.6,
			rssi: -65,
			percent_charged: 50,
			wifi_strength: 50,
		});
	});

	it("returns null battery and wifi metrics when telemetry is missing or zero", () => {
		expect(
			toDeviceApiData({
				id: "8",
				name: "Porch",
				friendly_id: "porch-8",
				mac_address: "DD:EE:FF",
				battery_voltage: null,
				rssi: 0,
			} as never),
		).toEqual({
			id: 8,
			name: "Porch",
			friendly_id: "porch-8",
			mac_address: "DD:EE:FF",
			battery_voltage: null,
			rssi: 0,
			percent_charged: null,
			wifi_strength: null,
		});
	});

	it("clamps battery and wifi percentages to the supported range", () => {
		expect(
			toDeviceApiData({
				id: "9",
				name: "Garage",
				friendly_id: "garage-9",
				mac_address: "11:22:33",
				battery_voltage: "5.1",
				rssi: -150,
			} as never),
		).toEqual(
			expect.objectContaining({
				percent_charged: 100,
				wifi_strength: 0,
			}),
		);
	});

	it("looks up numeric ids before falling back to friendly ids", async () => {
		const executeTakeFirst = vi
			.fn()
			.mockResolvedValueOnce(undefined)
			.mockResolvedValueOnce({ id: "friendly-device" });
		const where = vi.fn(() => ({ executeTakeFirst }));
		const selectAll = vi.fn(() => ({ where }));
		const selectFrom = vi.fn(() => ({ selectAll }));

		const result = await findDeviceByIdOrFriendlyId(
			{ selectFrom } as never,
			"42",
		);

		expect(result).toEqual({ id: "friendly-device" });
		expect(where).toHaveBeenNthCalledWith(1, "id", "=", "42");
		expect(where).toHaveBeenNthCalledWith(2, "friendly_id", "=", "42");
	});

	it("returns the numeric id match without querying friendly ids again", async () => {
		const executeTakeFirst = vi.fn().mockResolvedValue({ id: "42" });
		const where = vi.fn(() => ({ executeTakeFirst }));
		const selectAll = vi.fn(() => ({ where }));
		const selectFrom = vi.fn(() => ({ selectAll }));

		const result = await findDeviceByIdOrFriendlyId(
			{ selectFrom } as never,
			"42",
		);

		expect(result).toEqual({ id: "42" });
		expect(where).toHaveBeenCalledTimes(1);
		expect(where).toHaveBeenCalledWith("id", "=", "42");
	});

	it("queries friendly ids directly when the identifier is not numeric", async () => {
		const executeTakeFirst = vi.fn().mockResolvedValue({ id: "friendly-only" });
		const where = vi.fn(() => ({ executeTakeFirst }));
		const selectAll = vi.fn(() => ({ where }));
		const selectFrom = vi.fn(() => ({ selectAll }));

		const result = await findDeviceByIdOrFriendlyId(
			{ selectFrom } as never,
			"desk-display",
		);

		expect(result).toEqual({ id: "friendly-only" });
		expect(where).toHaveBeenCalledTimes(1);
		expect(where).toHaveBeenCalledWith("friendly_id", "=", "desk-display");
	});
});
