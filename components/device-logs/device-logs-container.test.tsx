import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, it, vi } from "vitest";
import { DeviceDisplayMode } from "@/lib/mixup/constants";
import type { Device } from "@/lib/types";

const state = vi.hoisted(() => ({
	pathname: "/devices/1" as string | undefined,
	search: "activeTab=system-logs" as string | null,
	pushCalls: [] as Array<{ href: string; options?: { scroll: boolean } }>,
	tabOnValueChange: undefined as ((value: string) => void) | undefined,
	systemCustomFetch: undefined as
		| ((params: Record<string, unknown>) => Promise<unknown>)
		| undefined,
}));

vi.mock("next/navigation", () => ({
	usePathname: () => state.pathname,
	useRouter: () => ({
		push: (href: string, options?: { scroll: boolean }) => {
			state.pushCalls.push({ href, options });
		},
	}),
	useSearchParams: () =>
		state.search === null ? null : new URLSearchParams(state.search),
}));

vi.mock("@/components/ui/tabs", () => ({
	Tabs: ({
		value,
		className,
		onValueChange,
		children,
	}: {
		value?: string;
		className?: string;
		onValueChange?: (value: string) => void;
		children: React.ReactNode;
	}) => {
		state.tabOnValueChange = onValueChange;
		return (
			<div data-tabs-value={value ?? ""} data-class-name={className ?? ""}>
				{children}
			</div>
		);
	},
	TabsList: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	TabsTrigger: ({
		value,
		children,
	}: {
		value: string;
		children: React.ReactNode;
	}) => (
		<button type="button" data-value={value}>
			{children}
		</button>
	),
	TabsContent: ({
		value,
		children,
	}: {
		value: string;
		children: React.ReactNode;
	}) => <section data-content={value}>{children}</section>,
}));

vi.mock("./device-logs-viewer", () => ({
	default: ({
		friendlyId,
		paramPrefix,
	}: {
		friendlyId?: string;
		paramPrefix?: string;
	}) => <div>{`device-logs:${friendlyId}:${paramPrefix}`}</div>,
}));

vi.mock("@/components/system-logs/system-logs-viewer", () => ({
	default: ({
		paramPrefix,
		customFetchFunction,
	}: {
		paramPrefix?: string;
		customFetchFunction?: (params: Record<string, unknown>) => Promise<unknown>;
	}) => {
		state.systemCustomFetch = customFetchFunction;
		return (
			<div
				data-system-param-prefix={paramPrefix ?? ""}
				data-has-custom-fetch={customFetchFunction ? "yes" : "no"}
			>
				system-logs-viewer
			</div>
		);
	},
}));

vi.mock("@/app/actions/system", () => ({
	fetchDeviceSystemLogs: vi.fn(),
}));

type DeviceLogsContainerModule = typeof import("./device-logs-container");
let moduleCache: DeviceLogsContainerModule | null = null;

async function getDeviceLogsContainer() {
	if (!moduleCache) {
		moduleCache = await import("./device-logs-container");
	}
	return moduleCache.default;
}

const device: Device = {
	id: 1,
	name: "Kitchen",
	mac_address: "AA:BB:CC:DD:EE:FF",
	api_key: "api-key",
	friendly_id: "kitchen-1",
	screen: "weather",
	screen_id: "weather",
	screen_type: "recipe",
	refresh_schedule: { default_refresh_rate: 300, time_ranges: [] },
	timezone: "Europe/Warsaw",
	last_update_time: null,
	next_expected_update: null,
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
	screen_width: 800,
	screen_height: 480,
	screen_orientation: "landscape",
	grayscale: 16,
	model: null,
	palette_id: null,
};

describe("DeviceLogsContainer", () => {
	beforeEach(() => {
		state.pathname = "/devices/1";
		state.search = "activeTab=system-logs";
		state.pushCalls = [];
		state.tabOnValueChange = undefined;
		state.systemCustomFetch = undefined;
	});

	it("renders device and system log viewers with the device filter wiring", async () => {
		const DeviceLogsContainer = await getDeviceLogsContainer();
		const html = renderToStaticMarkup(<DeviceLogsContainer device={device} />);

		assert.match(html, /Device logs/);
		assert.match(html, /data-tabs-value="system-logs"/);
		assert.match(html, /device-logs:kitchen-1:device_/);
		assert.match(html, /Showing system logs related to device kitchen-1/);
		assert.match(html, /data-system-param-prefix="system_"/);
		assert.match(html, /data-has-custom-fetch="yes"/);
	});

	it("pushes the selected tab into the url without scroll", async () => {
		const DeviceLogsContainer = await getDeviceLogsContainer();
		renderToStaticMarkup(<DeviceLogsContainer device={device} />);

		assert.ok(state.tabOnValueChange);
		state.tabOnValueChange("device-logs");

		assert.deepEqual(state.pushCalls, [
			{
				href: "/devices/1?activeTab=device-logs",
				options: { scroll: false },
			},
		]);
	});

	it("merges device identifiers into the custom system log fetch", async () => {
		const { fetchDeviceSystemLogs } = await import("@/app/actions/system");
		vi.mocked(fetchDeviceSystemLogs).mockResolvedValue({
			logs: [],
			total: 0,
			uniqueSources: [],
		});

		const DeviceLogsContainer = await getDeviceLogsContainer();
		renderToStaticMarkup(<DeviceLogsContainer device={device} />);

		assert.ok(state.systemCustomFetch);
		await state.systemCustomFetch({
			page: 3,
			search: "wifi",
		});

		assert.deepEqual(vi.mocked(fetchDeviceSystemLogs).mock.calls[0]?.[0], {
			page: 3,
			search: "wifi",
			friendlyId: "kitchen-1",
			macAddress: "AA:BB:CC:DD:EE:FF",
			apiKey: "api-key",
		});
	});

	it("falls back to the root pathname and default tab when navigation state is missing", async () => {
		state.pathname = undefined;
		state.search = null;

		const DeviceLogsContainer = await getDeviceLogsContainer();
		const html = renderToStaticMarkup(<DeviceLogsContainer device={device} />);

		assert.match(html, /data-tabs-value="device-logs"/);
		assert.ok(state.tabOnValueChange);
		state.tabOnValueChange("system-logs");

		assert.deepEqual(state.pushCalls, [
			{
				href: "/?activeTab=system-logs",
				options: { scroll: false },
			},
		]);
	});
});
