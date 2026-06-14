import assert from "node:assert/strict";
import type * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	pathname: "/devices/kitchen/logs",
	search: "",
	useStateValues: undefined as unknown[] | undefined,
	useStateIndex: 0,
}));

vi.mock("react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react")>();

	return {
		...actual,
		useEffect: () => undefined,
		useState: <T,>(initial: T) => {
			const values = state.useStateValues;
			const next =
				values && state.useStateIndex < values.length
					? (values[state.useStateIndex] as T)
					: initial;
			state.useStateIndex += 1;
			return [next, vi.fn()] as [T, React.Dispatch<React.SetStateAction<T>>];
		},
	};
});

vi.mock("@/app/actions/device", () => ({
	fetchDeviceLogsWithFilters: vi.fn(),
}));

vi.mock("@/components/logs/log-viewer-helpers", () => ({
	EmptyLogsTableRow: ({ colSpan }: { colSpan: number }) => (
		<tr>
			<td colSpan={colSpan}>No logs</td>
		</tr>
	),
	LogsLevelTabs: ({
		value,
		listClassName,
		availableLevels,
	}: {
		value: string;
		listClassName: string;
		availableLevels: string[];
	}) => (
		<div
			data-active-tab={value}
			data-list-class={listClassName}
			data-levels={availableLevels.join(",")}
		>
			log-level-tabs
		</div>
	),
	LogsTableHeader: ({ headers }: { headers: string[] }) => (
		<thead>
			<tr>
				{headers.map((header) => (
					<th key={header}>{header}</th>
				))}
			</tr>
		</thead>
	),
	LogsTableSkeleton: () => (
		<tr>
			<td>Loading skeleton</td>
		</tr>
	),
	shouldShowGroupedLogValue: () => true,
	useLogsUrlState: ({ paramPrefix }: { paramPrefix?: string }) => ({
		router: { push: () => undefined },
		pathname: state.pathname,
		searchParams: new URLSearchParams(state.search),
		scrollRef: null,
		searchInputRef: null,
		page: 1,
		searchQuery:
			new URLSearchParams(state.search).get(`${paramPrefix ?? ""}search`) ?? "",
		createQueryString: () => "page=1",
		handleSearchChange: () => undefined,
		handlePageChange: () => undefined,
		clearFilters: () => undefined,
	}),
	useScrollIntoViewAfterLoad: () => undefined,
}));

vi.mock("@/components/logs/logs-pagination", () => ({
	LogsPagination: () => <div>pagination</div>,
}));

vi.mock("@/components/ui/badge", () => ({
	Badge: ({
		children,
		className,
	}: {
		children: React.ReactNode;
		className?: string;
	}) => <span data-class-name={className ?? ""}>{children}</span>,
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({ children }: { children: React.ReactNode }) => (
		<button type="button">{children}</button>
	),
}));

vi.mock("@/components/ui/card", () => ({
	Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/input", () => ({
	Input: ({
		placeholder,
		defaultValue,
	}: {
		placeholder?: string;
		defaultValue?: string;
	}) => <input placeholder={placeholder} defaultValue={defaultValue} />,
}));

vi.mock("@/components/ui/table", () => ({
	Table: ({ children }: { children: React.ReactNode }) => (
		<table>{children}</table>
	),
	TableBody: ({ children }: { children: React.ReactNode }) => (
		<tbody>{children}</tbody>
	),
	TableCell: ({ children }: { children: React.ReactNode }) => (
		<td>{children}</td>
	),
	TableRow: ({ children }: { children: React.ReactNode }) => (
		<tr>{children}</tr>
	),
}));

type DeviceLogsViewerModule = typeof import("./device-logs-viewer");
let moduleCache: DeviceLogsViewerModule | null = null;

async function getDeviceLogsViewer() {
	if (!moduleCache) {
		moduleCache = await import("./device-logs-viewer");
	}
	return moduleCache.default;
}

describe("DeviceLogsViewer", () => {
	beforeEach(() => {
		state.search = "";
		state.useStateValues = undefined;
		state.useStateIndex = 0;
		moduleCache = null;
	});

	it("renders the initial loading state with search input and fallback tab grid", async () => {
		const DeviceLogsViewer = await getDeviceLogsViewer();
		const html = renderToStaticMarkup(
			<DeviceLogsViewer friendlyId="kitchen-1" paramPrefix="device_" />,
		);

		assert.match(html, /Search logs by content/);
		assert.match(html, /data-list-class="grid grid-cols-4"/);
		assert.match(html, /data-active-tab="all"/);
		assert.match(html, /Loading skeleton/);
		assert.doesNotMatch(html, /Clear Filters/);
		assert.doesNotMatch(html, /pagination/);
	});

	it("surfaces active search and type filters from the URL state", async () => {
		state.search = "device_search=wifi&device_type=error";
		const DeviceLogsViewer = await getDeviceLogsViewer();
		const html = renderToStaticMarkup(
			<DeviceLogsViewer friendlyId="kitchen-1" paramPrefix="device_" />,
		);

		assert.match(html, /Clear Filters/);
		assert.match(html, /Search: wifi/);
		assert.match(html, /Type: error/);
	});

	it("renders parsed log_data entries from arrays, logs_array, and single-log fallbacks", async () => {
		state.useStateValues = [
			[
				{
					id: 1,
					friendly_id: "kitchen-1",
					created_at: "2026-06-13T10:00:00.000Z",
					log_data: JSON.stringify([
						{
							log_message: "warn: wifi dropped",
							log_codeline: 12,
							log_sourcefile: "wifi.cpp",
							timestamp: "2026-06-13T10:00:05.000Z",
							device_status_stamp: {
								wifi_rssi_level: -67,
								wifi_status: "disconnected",
								refresh_rate: 60,
								time_since_last_sleep_start: 15,
								current_fw_version: "1.2.3",
								special_function: "",
								battery_voltage: 3.71,
								wakeup_reason: "timer",
								free_heap_size: 2048,
							},
							log_id: 10,
							creation_timestamp: 1,
						},
					]),
				},
				{
					id: 2,
					friendly_id: "kitchen-1",
					created_at: "2026-06-13T10:00:10.000Z",
					log_data: JSON.stringify({
						logs_array: [
							{
								log_message: "info: boot complete",
								log_codeline: 9,
								log_sourcefile: "boot.cpp",
								timestamp: "2026-06-13T10:00:09.000Z",
								device_status_stamp: undefined,
								log_id: 11,
								creation_timestamp: 2,
							},
						],
					}),
				},
				{
					id: 3,
					friendly_id: "kitchen-1",
					created_at: "2026-06-13T10:00:20.000Z",
					log_data: JSON.stringify({
						log_message: "Error while reading sensor",
						log_codeline: 99,
						log_sourcefile: "sensor.cpp",
						timestamp: "2026-06-13T10:00:20.000Z",
					}),
				},
			],
			3,
			false,
			["warning", "info", "error"],
			"all",
		];
		const DeviceLogsViewer = await getDeviceLogsViewer();
		const html = renderToStaticMarkup(
			<DeviceLogsViewer friendlyId="kitchen-1" paramPrefix="device_" />,
		);

		assert.match(html, /-67 dBm/);
		assert.match(html, /3\.71 V/);
		assert.match(html, /60 s/);
		assert.match(html, /2048 B/);
		assert.match(html, /v1\.2\.3/);
		assert.match(html, /timer/);
		assert.match(html, /15s/);
		assert.match(html, /\[wifi\.cpp:12\]/);
		assert.match(html, /warn: wifi dropped/);
		assert.match(html, /\[boot\.cpp:9\]/);
		assert.match(html, /info: boot complete/);
		assert.match(html, /\[sensor\.cpp:99\]/);
		assert.match(html, /Error while reading sensor/);
		assert.match(html, /pagination/);
		assert.match(html, /data-levels="warning,info,error"/);
	});

	it("falls back to raw log_data for unknown JSON shapes and invalid JSON", async () => {
		state.useStateValues = [
			[
				{
					id: 4,
					friendly_id: "kitchen-1",
					created_at: "2026-06-13T10:00:30.000Z",
					log_data: JSON.stringify({ metadata: { source: "device" } }),
				},
				{
					id: 5,
					friendly_id: "kitchen-1",
					created_at: "2026-06-13T10:00:40.000Z",
					log_data: "{not-json",
				},
			],
			2,
			false,
			[],
			"all",
		];
		const DeviceLogsViewer = await getDeviceLogsViewer();
		const html = renderToStaticMarkup(
			<DeviceLogsViewer friendlyId="kitchen-1" paramPrefix="device_" />,
		);

		assert.match(
			html,
			/{&quot;metadata&quot;:{&quot;source&quot;:&quot;device&quot;}}/,
		);
		assert.match(html, /{not-json/);
	});

	it("shows the empty table row when loading has finished without logs", async () => {
		state.useStateValues = [[], 0, false, [], "all"];
		const DeviceLogsViewer = await getDeviceLogsViewer();
		const html = renderToStaticMarkup(
			<DeviceLogsViewer friendlyId="kitchen-1" paramPrefix="device_" />,
		);

		assert.match(html, /No logs/);
		assert.doesNotMatch(html, /pagination/);
	});
});
