import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DeviceDisplayMode } from "@/lib/mixup/constants";
import type { Device, SystemLog } from "@/lib/types";

type PreviewFormat = "bmp" | "png" | "react";

const clientPageState = vi.hoisted(() => ({
	previewFormat: "png" as PreviewFormat,
	previewIsPortrait: false,
}));

vi.mock("next/link", () => ({
	default: ({
		href,
		children,
		...props
	}: {
		href: string;
		children?: React.ReactNode;
		[key: string]: unknown;
	}) => (
		<a href={href} {...props}>
			{children}
		</a>
	),
}));

vi.mock("next/image", () => ({
	default: ({
		src,
		alt,
		...props
	}: {
		src: string;
		alt?: string;
		[key: string]: unknown;
	}) => (
		<div
			data-testid="next-image"
			data-src={String(src)}
			data-alt={alt ?? ""}
			{...props}
		/>
	),
}));

vi.mock("@/components/common/device-frame", () => ({
	DeviceFrame: ({ children }: { children?: React.ReactNode }) => (
		<div data-testid="device-frame">{children}</div>
	),
}));

vi.mock("@/components/common/status-indicator", () => ({
	StatusIndicator: ({ status }: { status: "online" | "offline" }) => (
		<span data-status={status}>{status}</span>
	),
}));

vi.mock("@/components/preview/scaled-react-preview", () => ({
	ScaledReactPreview: () => (
		<div data-testid="react-preview">react preview</div>
	),
}));

vi.mock("@/components/preview/screen-preview-controls", () => ({
	useScreenPreviewControls: vi.fn(() => {
		const width = 800;
		const height = 480;

		return {
			format: clientPageState.previewFormat,
			setFormat: vi.fn(),
			sizeIndex: 0,
			setSizeIndex: vi.fn(),
			paletteIndex: 2,
			setPaletteIndex: vi.fn(),
			isPortrait: clientPageState.previewIsPortrait,
			setIsPortrait: vi.fn(),
			reactMode: "fit" as const,
			setReactMode: vi.fn(),
			sizePreset: {
				label: "800×480",
				width,
				height,
			},
			palette: { label: "16 gray" },
			width,
			height,
			grayscale: 16,
		};
	}),
	screenPreviewSummary: vi.fn(
		({ format, width, height }) => `${format} ${width}x${height}`,
	),
	ScreenPreviewControls: () => (
		<div data-testid="screen-preview-controls">controls</div>
	),
}));

type DashboardClientPageModule = typeof import("./client-page.tsx");
let moduleCache: DashboardClientPageModule | null = null;

async function getDashboardClientPage() {
	if (!moduleCache) {
		moduleCache = await import("./client-page.tsx");
	}
	return moduleCache.default;
}

function buildDevice(overrides: Partial<Device>): Device {
	return {
		id: 1,
		name: "Kitchen display",
		mac_address: "AA:BB:CC:DD:EE:FF",
		api_key: "api-key",
		friendly_id: "kitchen",
		screen: null,
		screen_id: null,
		screen_type: null,
		refresh_schedule: null,
		timezone: "UTC",
		last_update_time: null,
		next_expected_update: new Date(Date.now() + 60_000).toISOString(),
		last_refresh_duration: null,
		battery_voltage: null,
		firmware_version: null,
		rssi: null,
		created_at: null,
		updated_at: null,
		playlist_id: null,
		mixup_id: null,
		display_mode: DeviceDisplayMode.SCREEN,
		current_playlist_index: null,
		user_id: null,
		screen_width: null,
		screen_height: null,
		screen_orientation: null,
		grayscale: null,
		model: null,
		palette_id: null,
		...overrides,
	};
}

function buildLog(overrides: Partial<SystemLog>): SystemLog {
	return {
		id: "1",
		created_at: new Date().toISOString(),
		level: "info",
		message: "booted",
		source: "system",
		metadata: null,
		trace: null,
		...overrides,
	};
}

describe("Dashboard client page", () => {
	it("renders empty dashboards with fallback rows", async () => {
		const DashboardClientPage = await getDashboardClientPage();
		clientPageState.previewFormat = "png";
		clientPageState.previewIsPortrait = false;

		const html = renderToStaticMarkup(
			<DashboardClientPage devices={[]} systemLogs={[]} />,
		);

		assert.match(html, /No devices online/);
		assert.match(html, /No devices offline/);
		assert.match(html, /No system logs to show/);
	});

	it("renders populated device and log rows", async () => {
		const DashboardClientPage = await getDashboardClientPage();
		clientPageState.previewFormat = "png";
		clientPageState.previewIsPortrait = false;

		const html = renderToStaticMarkup(
			<DashboardClientPage
				devices={[
					buildDevice({
						id: 8,
						name: "Office screen",
						friendly_id: "office",
						next_expected_update: new Date(Date.now() + 60_000).toISOString(),
					}),
				]}
				systemLogs={[
					buildLog({
						id: "log-1",
						message: "Initial render complete",
					}),
				]}
			/>,
		);

		assert.match(html, /Office screen/);
		assert.match(html, /Initial render complete/);
		assert.doesNotMatch(html, /No system logs to show/);
	});

	it("shows mixup fallback when react preview is unavailable", async () => {
		const DashboardClientPage = await getDashboardClientPage();
		clientPageState.previewFormat = "png";
		clientPageState.previewIsPortrait = false;

		const html = renderToStaticMarkup(
			<DashboardClientPage
				devices={[
					buildDevice({
						display_mode: DeviceDisplayMode.MIXUP,
						mixup_id: "mixup-id",
						next_expected_update: new Date(Date.now() + 60_000).toISOString(),
					}),
				]}
				systemLogs={[]}
			/>,
		);

		assert.match(html, /preview is not available for mixups yet/);
	});

	it("renders react preview branch when format is react", async () => {
		const DashboardClientPage = await getDashboardClientPage();
		clientPageState.previewFormat = "react";
		clientPageState.previewIsPortrait = false;

		const html = renderToStaticMarkup(
			<DashboardClientPage
				devices={[
					buildDevice({
						id: 11,
						name: "Hall screen",
						next_expected_update: new Date(Date.now() + 60_000).toISOString(),
					}),
				]}
				systemLogs={[]}
			/>,
		);

		assert.match(html, /react preview/);
	});

	it("renders bitmap previews for mixups when BMP format is selected", async () => {
		const DashboardClientPage = await getDashboardClientPage();
		clientPageState.previewFormat = "bmp";
		clientPageState.previewIsPortrait = false;

		const html = renderToStaticMarkup(
			<DashboardClientPage
				devices={[
					buildDevice({
						name: "Split display",
						display_mode: DeviceDisplayMode.MIXUP,
						mixup_id: "mixup-42",
						next_expected_update: new Date(Date.now() + 60_000).toISOString(),
					}),
				]}
				systemLogs={[]}
			/>,
		);

		expect(html).toContain(
			"/api/bitmap/mixup/mixup-42.bmp?width=800&amp;height=480&amp;grayscale=16",
		);
		expect(html).not.toContain("preview is not available for mixups yet");
	});

	it("swaps preview dimensions when portrait mode is enabled", async () => {
		const DashboardClientPage = await getDashboardClientPage();
		clientPageState.previewFormat = "png";
		clientPageState.previewIsPortrait = true;

		const html = renderToStaticMarkup(
			<DashboardClientPage
				devices={[
					buildDevice({
						name: "Portrait display",
						screen_id: "named-screen",
						screen_type: "screen",
						screen_orientation: "portrait",
						next_expected_update: new Date(Date.now() + 60_000).toISOString(),
					}),
				]}
				systemLogs={[]}
			/>,
		);

		expect(html).toContain(
			"/api/png/screen/named-screen?width=480&amp;height=800",
		);
	});
});
