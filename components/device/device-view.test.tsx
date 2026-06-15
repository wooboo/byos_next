import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "vitest";
import { DeviceDisplayMode } from "@/lib/mixup/constants";
import type { Device } from "@/lib/types";
import DeviceView, {
	calculateRefreshPerDay,
	getDevicePreviewModel,
	getSignalQuality,
} from "./device-view";

const baseDevice: Device & { status?: string; type?: string } = {
	id: 1,
	name: "Kitchen display",
	mac_address: "AA:BB:CC:DD:EE:FF",
	api_key: "apikey123",
	friendly_id: "ABC123",
	screen: "weather",
	screen_id: "weather",
	screen_type: "recipe",
	refresh_schedule: {
		default_refresh_rate: 300,
		time_ranges: [],
	},
	timezone: "Europe/Warsaw",
	last_update_time: null,
	next_expected_update: null,
	last_refresh_duration: 12,
	battery_voltage: 4.05,
	firmware_version: "1.0.0",
	rssi: -58,
	created_at: null,
	updated_at: null,
	playlist_id: "playlist-1",
	mixup_id: null,
	display_mode: DeviceDisplayMode.PLAYLIST,
	current_playlist_index: 0,
	user_id: null,
	screen_width: 800,
	screen_height: 480,
	screen_orientation: "landscape",
	grayscale: 16,
	model: null,
	palette_id: null,
	status: "online",
	type: "trmnl",
};

describe("DeviceView", () => {
	it("derives signal quality, refresh schedules, and preview sources", () => {
		assert.equal(getSignalQuality(-49), "Excellent");
		assert.equal(getSignalQuality(-55), "Good");
		assert.equal(getSignalQuality(-65), "Fair");
		assert.equal(getSignalQuality(-75), "Poor");
		assert.equal(getSignalQuality(-85), "Very Poor");

		assert.equal(
			calculateRefreshPerDay({
				...baseDevice,
				refresh_schedule: null,
			} as Device & { status?: string; type?: string }),
			0,
		);
		assert.equal(
			calculateRefreshPerDay({
				...baseDevice,
				refresh_schedule: {
					default_refresh_rate: 600,
					time_ranges: [
						{
							start_time: "09:00",
							end_time: "11:00",
							refresh_rate: 300,
						},
					],
				},
			}),
			156,
		);

		assert.deepEqual(
			getDevicePreviewModel({
				device: {
					...baseDevice,
					display_mode: DeviceDisplayMode.MIXUP,
					mixup_id: "mixup-9",
				},
				playlistScreens: [],
				deviceWidth: 800,
				deviceHeight: 480,
				grayscaleLevels: 4,
			}),
			{
				isPlaylist: false,
				heroFrameId: "mixup-9",
				heroContentType: "mixup",
				bmpSrc:
					"/api/bitmap/mixup/mixup-9.bmp?width=800&height=480&grayscale=4",
				pngSrc: "/api/png/mixup/mixup-9.png?width=800&height=480",
				reactSrc: "/preview/mixup/mixup-9?width=800&height=480",
			},
		);
	});

	it("renders playlist preview panels, battery estimate, and rotation frames", () => {
		const html = renderToStaticMarkup(
			<DeviceView
				device={baseDevice}
				playlistScreens={[
					{ screen: "weather", screen_type: "recipe", duration: 30 },
					{ screen: "calendar", screen_type: "recipe", duration: 45 },
				]}
			/>,
		);

		assert.match(html, /Preview/);
		assert.match(html, /Identity/);
		assert.match(html, /Health/);
		assert.match(html, /Display/);
		assert.match(html, /Rotation/);
		assert.match(html, /2 screens/);
		assert.match(html, /Europe\/Warsaw/);
		assert.match(html, /-58 dBm · Good/);
		assert.match(html, /75%/);
		assert.match(html, /288 refreshes\/day/);
		assert.match(html, /Rotating screens from the selected playlist\./);
		assert.match(
			html,
			/\/api\/bitmap\/weather\.bmp\?width=800&amp;height=480&amp;grayscale=16/,
		);
	});

	it("renders single-screen mode without the rotation strip", () => {
		const html = renderToStaticMarkup(
			<DeviceView
				device={{
					...baseDevice,
					display_mode: DeviceDisplayMode.SCREEN,
					playlist_id: null,
					rssi: null,
					battery_voltage: null,
				}}
				playlistScreens={[]}
			/>,
		);

		assert.match(html, /Single screen rendering the selected component\./);
		assert.match(html, /Unknown/);
		assert.doesNotMatch(html, /Rotation/);
	});

	it("renders the mixup display description", () => {
		const html = renderToStaticMarkup(
			<DeviceView
				device={{
					...baseDevice,
					display_mode: DeviceDisplayMode.MIXUP,
					mixup_id: "mixup-1",
					playlist_id: null,
				}}
				playlistScreens={[]}
			/>,
		);

		assert.match(html, /Split-screen layout combining multiple recipes\./);
	});
});
