import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, it, vi } from "vitest";
import { DeviceDisplayMode } from "@/lib/mixup/constants";
import type { Device } from "@/lib/types";

type DevicePageProps = React.ComponentProps<
	typeof import("./client-page.tsx").default
>;

type StateEntry = {
	value: unknown;
	setter?: ReturnType<typeof vi.fn>;
};

type CapturedEditFormProps = {
	onAddTimeRange: () => void;
	onContentRefChange: (
		kind: "recipe" | "screen" | "playlist" | "mixup" | "none",
		id: string | null,
	) => Promise<void>;
	onCustomSizeChange: (field: "width" | "height", value: number) => void;
	onDeviceSizePresetChange: (
		preset: "800x480" | "600x400" | "1872x1404" | "2048x1536" | "custom",
	) => void;
	onNestedInputChange: (path: string, value: string) => void;
	onRegenerateApiKey: () => void;
	onRegenerateFriendlyId: () => void;
	onSubmit: (event?: { preventDefault?: () => void }) => Promise<void>;
};

const pageState = vi.hoisted(() => ({
	editFormProps: null as CapturedEditFormProps | null,
	viewProps: null as {
		device: Device & { status?: string; type?: string };
		playlistScreens: Array<{
			screen: string;
			screen_type?: string | null;
			duration: number;
		}>;
	} | null,
	logProps: null as {
		device: Device & { status?: string; type?: string };
	} | null,
}));

const toastMock = vi.hoisted(() => {
	const fn = vi.fn();
	return Object.assign(fn, {
		error: vi.fn(),
		success: vi.fn(),
	});
});

vi.mock("sonner", () => ({
	toast: toastMock,
}));

vi.mock("@/app/actions/device", () => ({
	fetchDeviceByFriendlyId: vi.fn(),
	updateDevice: vi.fn(),
}));

vi.mock("@/app/actions/screens", () => ({
	createScreenFromRecipe: vi.fn(),
}));

vi.mock("@/components/common/page-template", () => ({
	PageTemplate: ({
		title,
		left,
		children,
	}: {
		title: React.ReactNode;
		left?: React.ReactNode;
		children: React.ReactNode;
	}) => (
		<div>
			<div>{title}</div>
			<div>{left}</div>
			{children}
		</div>
	),
}));

vi.mock("@/components/common/status-indicator", () => ({
	StatusIndicator: ({ status }: { status: string }) => <span>{status}</span>,
}));

vi.mock("@/components/device/device-edit-form", () => ({
	default: (props: CapturedEditFormProps) => {
		pageState.editFormProps = props;
		return <div>device-edit-form</div>;
	},
}));

vi.mock("@/components/device/device-view", () => ({
	default: (props: {
		device: Device & { status?: string; type?: string };
		playlistScreens: Array<{
			screen: string;
			screen_type?: string | null;
			duration: number;
		}>;
	}) => {
		pageState.viewProps = props;
		return (
			<div>
				device-view:{props.device.name}:{props.playlistScreens.length}
			</div>
		);
	},
}));

vi.mock("@/components/device-logs/device-logs-container", () => ({
	default: (props: { device: Device & { status?: string; type?: string } }) => {
		pageState.logProps = props;
		return <div>device-logs:{props.device.id}</div>;
	},
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({
		children,
		onClick,
		disabled,
	}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button type="button" onClick={onClick} disabled={disabled}>
			{children}
		</button>
	),
}));

async function loadClientPage(
	stateEntries?: StateEntry[],
	options?: { runEffects?: boolean },
) {
	vi.resetModules();
	vi.doUnmock("react");

	if (stateEntries) {
		const entries = stateEntries;
		const runEffects = options?.runEffects ?? false;
		let callIndex = 0;

		vi.doMock("react", async (importOriginal) => {
			const actual = await importOriginal<typeof import("react")>();
			return {
				...actual,
				useEffect: (effect: React.EffectCallback) => {
					if (runEffects) {
						effect();
					}
				},
				useState: (initial: unknown) => {
					const resolvedInitial =
						typeof initial === "function"
							? (initial as () => unknown)()
							: initial;
					const entry = entries[callIndex++];
					if (!entry) {
						return [resolvedInitial, vi.fn()] as const;
					}
					return [entry.value, entry.setter ?? vi.fn()] as const;
				},
			};
		});
	}

	return (await import("./client-page.tsx")).default;
}

function buildDevice(
	overrides: Partial<Device & { status?: string; type?: string }> = {},
): Device & { status?: string; type?: string } {
	return {
		id: 1,
		name: "Kitchen panel",
		mac_address: "AA:BB:CC:DD:EE:FF",
		api_key: "VALIDKEY1234",
		friendly_id: "ABC123",
		screen: null,
		screen_id: null,
		screen_type: null,
		refresh_schedule: {
			default_refresh_rate: 300,
			time_ranges: [],
		},
		timezone: "Europe/Warsaw",
		last_update_time: null,
		next_expected_update: "2099-01-01T00:00:00.000Z",
		last_refresh_duration: null,
		battery_voltage: null,
		firmware_version: null,
		rssi: null,
		created_at: "2024-01-01T00:00:00.000Z",
		updated_at: "2024-01-02T00:00:00.000Z",
		playlist_id: null,
		mixup_id: null,
		display_mode: DeviceDisplayMode.SCREEN,
		current_playlist_index: null,
		user_id: null,
		screen_width: 800,
		screen_height: 480,
		screen_orientation: "landscape",
		grayscale: 0,
		model: null,
		palette_id: null,
		status: "online",
		type: "trmnl",
		...overrides,
	};
}

function buildProps(overrides: Partial<DevicePageProps> = {}): DevicePageProps {
	return {
		initialDevice: buildDevice(),
		availableScreens: [{ id: "screen-1", title: "Weather screen" }],
		availableRecipes: [{ id: "recipe-1", title: "Weather" }],
		availablePlaylists: [
			{
				id: "playlist-1",
				name: "Morning",
				created_at: null,
				updated_at: null,
			},
		],
		availableMixups: [
			{
				id: "mixup-1",
				name: "Split",
				layout_id: "quarters",
				created_at: null,
				updated_at: null,
			},
		],
		playlistItems: [
			{
				id: "item-2",
				playlist_id: "playlist-1",
				screen_id: "screen-2",
				screen_type: "screen",
				duration: 60,
				start_time: null,
				end_time: null,
				days_of_week: null,
				order_index: 2,
				created_at: null,
			},
			{
				id: "item-1",
				playlist_id: "playlist-1",
				screen_id: "screen-1",
				screen_type: "recipe",
				duration: 30,
				start_time: null,
				end_time: null,
				days_of_week: null,
				order_index: 0,
				created_at: null,
			},
		],
		...overrides,
	};
}

afterEach(() => {
	pageState.editFormProps = null;
	pageState.viewProps = null;
	pageState.logProps = null;
	toastMock.mockClear();
	toastMock.error.mockClear();
	toastMock.success.mockClear();
	vi.unstubAllGlobals();
});

describe("Device client page", () => {
	it("renders the read-only device view and logs", async () => {
		const DeviceClientPage = await loadClientPage();
		const html = renderToStaticMarkup(<DeviceClientPage {...buildProps()} />);

		assert.match(html, /Kitchen panel/);
		assert.match(html, /device-view:Kitchen panel:0/);
		assert.match(html, /device-logs:1/);
		assert.ok(pageState.viewProps);
		assert.ok(pageState.logProps);
		assert.equal(pageState.logProps?.device.id, 1);
	});

	it("hydrates playlist screens for the edit form when editing a playlist-backed device", async () => {
		const playlistScreensSetter = vi.fn();
		const editedDevice = buildDevice({
			playlist_id: "playlist-1",
			display_mode: DeviceDisplayMode.PLAYLIST,
		});
		const DeviceClientPage = await loadClientPage(
			[
				{ value: buildDevice() },
				{ value: true },
				{ value: editedDevice },
				{ value: [], setter: playlistScreensSetter },
				{ value: false },
				{ value: null },
				{ value: null },
				{ value: "800x480" },
			],
			{ runEffects: true },
		);

		const html = renderToStaticMarkup(<DeviceClientPage {...buildProps()} />);

		assert.match(html, /device-edit-form/);
		assert.ok(pageState.editFormProps);
		assert.deepEqual(playlistScreensSetter.mock.calls[0]?.[0], [
			{ screen: "screen-1", screen_type: "recipe", duration: 30 },
			{ screen: "screen-2", screen_type: "screen", duration: 60 },
		]);
	});

	it("blocks saving when the API key is invalid", async () => {
		const apiKeyErrorSetter = vi.fn();
		const updateDevice = vi.mocked(
			(await import("@/app/actions/device")).updateDevice,
		);
		const DeviceClientPage = await loadClientPage([
			{ value: buildDevice() },
			{ value: true },
			{ value: buildDevice({ api_key: "bad" }) },
			{ value: [] },
			{ value: false },
			{ value: null, setter: apiKeyErrorSetter },
			{ value: null },
			{ value: "800x480" },
		]);

		renderToStaticMarkup(<DeviceClientPage {...buildProps()} />);
		await pageState.editFormProps?.onSubmit();

		assert.equal(updateDevice.mock.calls.length, 0);
		assert.equal(
			apiKeyErrorSetter.mock.calls[0]?.[0],
			["API Key must be alphanumeric and between 8 to 60 characters long."][0],
		);
		assert.deepEqual(toastMock.error.mock.calls[0], [
			"Cannot save device",
			{
				description:
					"API Key must be alphanumeric and between 8 to 60 characters long.",
			},
		]);
	});

	it("creates a screen from a recipe and rewrites the edited device assignment", async () => {
		const editedDeviceSetter = vi.fn();
		const createScreenFromRecipe = vi.mocked(
			(await import("@/app/actions/screens")).createScreenFromRecipe,
		);
		createScreenFromRecipe.mockResolvedValue({
			success: true,
			screen: { id: "screen-99", name: "Weather board" },
		});
		vi.stubGlobal("window", {
			prompt: vi.fn(() => "Weather board"),
		});

		const baseEditedDevice = buildDevice({
			display_mode: DeviceDisplayMode.MIXUP,
			mixup_id: "mixup-1",
		});
		const DeviceClientPage = await loadClientPage([
			{ value: buildDevice() },
			{ value: true },
			{ value: baseEditedDevice, setter: editedDeviceSetter },
			{ value: [] },
			{ value: false },
			{ value: null },
			{ value: null },
			{ value: "800x480" },
		]);

		renderToStaticMarkup(<DeviceClientPage {...buildProps()} />);
		await pageState.editFormProps?.onContentRefChange("recipe", "recipe-1");

		assert.deepEqual(createScreenFromRecipe.mock.calls[0], [
			"recipe-1",
			"Weather board",
		]);
		assert.equal(toastMock.success.mock.calls[0]?.[0], "Screen created");
		const updater = editedDeviceSetter.mock.calls[0]?.[0] as (
			device: Device,
		) => Device;
		const next = updater(baseEditedDevice);
		assert.equal(next.display_mode, DeviceDisplayMode.SCREEN);
		assert.equal(next.screen_type, "screen");
		assert.equal(next.screen_id, "screen-99");
		assert.equal(next.playlist_id, null);
		assert.equal(next.mixup_id, null);
	});

	it("saves a valid device, refreshes it from the server, and exits edit mode", async () => {
		const deviceSetter = vi.fn();
		const editedDeviceSetter = vi.fn();
		const isSavingSetter = vi.fn();
		const isEditingSetter = vi.fn();
		const updateDevice = vi.mocked(
			(await import("@/app/actions/device")).updateDevice,
		);
		const fetchDeviceByFriendlyId = vi.mocked(
			(await import("@/app/actions/device")).fetchDeviceByFriendlyId,
		);
		updateDevice.mockResolvedValue({ success: true });
		fetchDeviceByFriendlyId.mockResolvedValue(
			buildDevice({
				name: "Kitchen panel v2",
				next_expected_update: "2099-02-02T00:00:00.000Z",
			}),
		);

		const editableDevice = buildDevice({
			screen: "recipe-1",
			screen_id: "screen-1",
			screen_type: "screen",
			playlist_id: null,
			mixup_id: null,
			display_mode: DeviceDisplayMode.SCREEN,
		});
		const DeviceClientPage = await loadClientPage([
			{ value: buildDevice(), setter: deviceSetter },
			{ value: true, setter: isEditingSetter },
			{ value: editableDevice, setter: editedDeviceSetter },
			{ value: [] },
			{ value: false, setter: isSavingSetter },
			{ value: null },
			{ value: null },
			{ value: "800x480" },
		]);

		renderToStaticMarkup(<DeviceClientPage {...buildProps()} />);
		await pageState.editFormProps?.onSubmit();

		assert.equal(updateDevice.mock.calls[0]?.[0].id, editableDevice.id);
		assert.deepEqual(fetchDeviceByFriendlyId.mock.calls[0], ["ABC123"]);
		assert.equal(deviceSetter.mock.calls[0]?.[0].name, "Kitchen panel v2");
		assert.equal(deviceSetter.mock.calls[0]?.[0].status, "online");
		assert.equal(
			editedDeviceSetter.mock.calls[0]?.[0].name,
			"Kitchen panel v2",
		);
		assert.deepEqual(toastMock.mock.calls[0], [
			"Device updated",
			{
				description: "The device has been successfully updated.",
			},
		]);
		assert.deepEqual(
			isSavingSetter.mock.calls.map((call) => call[0]),
			[true, false],
		);
		assert.equal(isEditingSetter.mock.calls.at(-1)?.[0], false);
	});

	it("updates nested schedule and device size helpers through the edit form callbacks", async () => {
		const editedDeviceSetter = vi.fn();
		const presetSetter = vi.fn();
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-14T12:34:56.000Z"));

		const editedDevice = buildDevice({
			refresh_schedule: {
				default_refresh_rate: 300,
				time_ranges: [],
			},
			screen_width: 800,
			screen_height: 480,
		});
		const DeviceClientPage = await loadClientPage([
			{ value: buildDevice() },
			{ value: true },
			{ value: editedDevice, setter: editedDeviceSetter },
			{ value: [] },
			{ value: false },
			{ value: null },
			{ value: null },
			{ value: "800x480", setter: presetSetter },
		]);

		renderToStaticMarkup(<DeviceClientPage {...buildProps()} />);
		pageState.editFormProps?.onNestedInputChange(
			"refresh_schedule.time_ranges.0.refresh_rate",
			"900",
		);
		pageState.editFormProps?.onDeviceSizePresetChange("1872x1404");
		pageState.editFormProps?.onCustomSizeChange("width", 901);
		pageState.editFormProps?.onAddTimeRange();
		pageState.editFormProps?.onRegenerateApiKey();
		pageState.editFormProps?.onRegenerateFriendlyId();

		assert.deepEqual(editedDeviceSetter.mock.calls[0]?.[0].refresh_schedule, {
			default_refresh_rate: 300,
			time_ranges: [
				{
					start_time: "",
					end_time: "",
					refresh_rate: 900,
				},
			],
		});
		assert.equal(presetSetter.mock.calls[0]?.[0], "1872x1404");
		assert.equal(editedDeviceSetter.mock.calls[1]?.[0].screen_width, 1872);
		assert.equal(editedDeviceSetter.mock.calls[1]?.[0].screen_height, 1404);
		assert.equal(presetSetter.mock.calls[1]?.[0], "custom");
		assert.equal(editedDeviceSetter.mock.calls[2]?.[0].screen_width, 901);
		assert.equal(
			editedDeviceSetter.mock.calls[3]?.[0].refresh_schedule.time_ranges.length,
			1,
		);
		assert.match(
			editedDeviceSetter.mock.calls[4]?.[0].api_key,
			/^[A-Za-z0-9]{22}$/,
		);
		assert.match(
			editedDeviceSetter.mock.calls[5]?.[0].friendly_id,
			/^[A-Z0-9]{6}$/,
		);
		vi.useRealTimers();
	});

	it("blocks saving when the friendly id is invalid", async () => {
		const friendlyIdErrorSetter = vi.fn();
		const updateDevice = vi.mocked(
			(await import("@/app/actions/device")).updateDevice,
		);
		updateDevice.mockClear();
		const DeviceClientPage = await loadClientPage([
			{ value: buildDevice() },
			{ value: true },
			{
				value: buildDevice({ friendly_id: "bad" }),
			},
			{ value: [] },
			{ value: false },
			{ value: null },
			{ value: null, setter: friendlyIdErrorSetter },
			{ value: "800x480" },
		]);

		renderToStaticMarkup(<DeviceClientPage {...buildProps()} />);
		await pageState.editFormProps?.onSubmit();

		assert.equal(updateDevice.mock.calls.length, 0);
		assert.equal(
			friendlyIdErrorSetter.mock.calls[0]?.[0],
			"Friendly ID must be exactly 6 uppercase alphanumeric characters.",
		);
		assert.deepEqual(toastMock.error.mock.calls[0], [
			"Cannot save device",
			{
				description:
					"Friendly ID must be exactly 6 uppercase alphanumeric characters.",
			},
		]);
	});

	it("reassigns the edited device directly for playlist and mixup content refs", async () => {
		const editedDeviceSetter = vi.fn();
		const baseEditedDevice = buildDevice({
			screen: "recipe-1",
			screen_id: "screen-1",
			screen_type: "screen",
		});
		const DeviceClientPage = await loadClientPage([
			{ value: buildDevice() },
			{ value: true },
			{ value: baseEditedDevice, setter: editedDeviceSetter },
			{ value: [] },
			{ value: false },
			{ value: null },
			{ value: null },
			{ value: "800x480" },
		]);

		renderToStaticMarkup(<DeviceClientPage {...buildProps()} />);
		await pageState.editFormProps?.onContentRefChange("playlist", "playlist-1");
		await pageState.editFormProps?.onContentRefChange("mixup", "mixup-1");

		const playlistUpdater = editedDeviceSetter.mock.calls[0]?.[0] as (
			device: Device,
		) => Device;
		const mixupUpdater = editedDeviceSetter.mock.calls[1]?.[0] as (
			device: Device,
		) => Device;

		const playlistDevice = playlistUpdater(baseEditedDevice);
		assert.equal(playlistDevice.display_mode, DeviceDisplayMode.PLAYLIST);
		assert.equal(playlistDevice.playlist_id, "playlist-1");
		assert.equal(playlistDevice.mixup_id, null);
		assert.equal(playlistDevice.screen_type, "recipe");
		assert.equal(playlistDevice.screen_id, null);

		const mixupDevice = mixupUpdater(baseEditedDevice);
		assert.equal(mixupDevice.display_mode, DeviceDisplayMode.MIXUP);
		assert.equal(mixupDevice.playlist_id, null);
		assert.equal(mixupDevice.mixup_id, "mixup-1");
		assert.equal(mixupDevice.screen_type, "recipe");
		assert.equal(mixupDevice.screen_id, null);
	});

	it("shows an update failure toast when the server rejects the save", async () => {
		const isSavingSetter = vi.fn();
		const isEditingSetter = vi.fn();
		const updateDevice = vi.mocked(
			(await import("@/app/actions/device")).updateDevice,
		);
		updateDevice.mockResolvedValue({
			success: false,
			error: "duplicate friendly id",
		});

		const editableDevice = buildDevice();
		const DeviceClientPage = await loadClientPage([
			{ value: buildDevice() },
			{ value: true, setter: isEditingSetter },
			{ value: editableDevice },
			{ value: [] },
			{ value: false, setter: isSavingSetter },
			{ value: null },
			{ value: null },
			{ value: "800x480" },
		]);

		renderToStaticMarkup(<DeviceClientPage {...buildProps()} />);
		await pageState.editFormProps?.onSubmit();

		assert.deepEqual(toastMock.error.mock.calls[0], [
			"Update failed",
			{ description: "duplicate friendly id" },
		]);
		assert.deepEqual(
			isSavingSetter.mock.calls.map((call) => call[0]),
			[true, false],
		);
		assert.equal(isEditingSetter.mock.calls.at(-1)?.[0], false);
	});
});
