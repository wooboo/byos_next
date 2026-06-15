import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";
import { DeviceDisplayMode } from "@/lib/mixup/constants";
import type { Device, Mixup, Playlist } from "@/lib/types";
import {
	getDeviceGrayscale,
	getPreviewSources,
	getSelectedContent,
} from "./device-edit-form";

const previewState = vi.hoisted(() => ({
	format: "bmp" as "bmp" | "png" | "react",
	isPortrait: false,
	width: 800,
	height: 480,
	grayscale: 16,
	reactMode: "fit" as "fit" | "scroll",
}));

vi.mock("next/image", () => ({
	default: ({ src, alt }: { src: string; alt: string }) => (
		<div data-image-src={src} data-image-alt={alt} />
	),
}));

vi.mock("@/components/common/device-frame", () => ({
	DeviceFrame: ({
		children,
		portrait,
		screenWidth,
		screenHeight,
	}: {
		children: React.ReactNode;
		portrait: boolean;
		screenWidth: number;
		screenHeight: number;
	}) => (
		<div
			data-device-frame={`${portrait ? "portrait" : "landscape"}:${screenWidth}x${screenHeight}`}
		>
			{children}
		</div>
	),
}));

vi.mock("@/components/preview/scaled-react-preview", () => ({
	ScaledReactPreview: ({ src, mode }: { src: string; mode: string }) => (
		<div data-react-preview={`${mode}:${src}`}>react-preview</div>
	),
}));

vi.mock("@/components/preview/screen-preview-controls", () => ({
	useScreenPreviewControls: ({
		defaultPortrait,
	}: {
		defaultPortrait?: boolean;
	}) => ({
		format: previewState.format,
		setFormat: () => undefined,
		sizeIndex: 0,
		setSizeIndex: () => undefined,
		paletteIndex: 2,
		setPaletteIndex: () => undefined,
		isPortrait: defaultPortrait ?? previewState.isPortrait,
		setIsPortrait: () => undefined,
		width: previewState.width,
		height: previewState.height,
		grayscale: previewState.grayscale,
		reactMode: previewState.reactMode,
		setReactMode: () => undefined,
	}),
	ScreenPreviewControls: ({
		format,
		isPortrait,
		className,
	}: {
		format: string;
		isPortrait: boolean;
		className?: string;
	}) => (
		<div
			data-preview-controls={`${format}:${isPortrait ? "portrait" : "landscape"}`}
			data-class-name={className ?? ""}
		/>
	),
	screenPreviewSummary: ({
		format,
		width,
		height,
		grayscale,
		reactMode,
	}: {
		format: string;
		width: number;
		height: number;
		grayscale: number;
		reactMode?: string;
	}) =>
		`${format}:${width}x${height}:${grayscale}${reactMode ? `:${reactMode}` : ""}`,
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({
		children,
		title,
		role,
		...props
	}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button type="button" title={title} role={role} {...props}>
			{children}
		</button>
	),
}));

vi.mock("@/components/ui/input", () => ({
	Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
		<input {...props} />
	),
}));

vi.mock("@/components/ui/label", () => ({
	Label: ({ children }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
		<div>{children}</div>
	),
}));

vi.mock("@/components/ui/popover", () => ({
	Popover: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	PopoverTrigger: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	PopoverContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock("@/components/ui/command", () => ({
	Command: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	CommandEmpty: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	CommandGroup: ({
		children,
		heading,
	}: {
		children: React.ReactNode;
		heading?: string;
	}) => (
		<section data-heading={heading ?? ""}>
			{heading}
			{children}
		</section>
	),
	CommandInput: ({ placeholder }: { placeholder?: string }) => (
		<input placeholder={placeholder} />
	),
	CommandItem: ({
		children,
		value,
	}: {
		children: React.ReactNode;
		value?: string;
	}) => <div data-command-value={value ?? ""}>{children}</div>,
	CommandList: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock("@/components/ui/scroll-area", () => ({
	ScrollArea: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock("@/components/ui/select", () => ({
	Select: ({
		children,
		value,
	}: {
		children: React.ReactNode;
		value?: string;
	}) => <div data-select-value={value ?? ""}>{children}</div>,
	SelectContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	SelectItem: ({
		children,
		value,
	}: {
		children: React.ReactNode;
		value: string;
	}) => <div data-select-item={value}>{children}</div>,
	SelectTrigger: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	SelectValue: ({ placeholder }: { placeholder?: string }) => (
		<span>{placeholder}</span>
	),
}));

vi.mock("@/components/ui/tabs", () => ({
	Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	TabsList: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	TabsTrigger: ({
		children,
		value,
	}: {
		children: React.ReactNode;
		value: string;
	}) => (
		<button type="button" data-tab-trigger={value}>
			{children}
		</button>
	),
	TabsContent: ({
		children,
		value,
	}: {
		children: React.ReactNode;
		value: string;
	}) => <section data-tab-content={value}>{children}</section>,
}));

vi.mock("@/components/ui/toggle-group", () => ({
	ToggleGroup: ({
		children,
		value,
	}: {
		children: React.ReactNode;
		value?: string;
	}) => <div data-toggle-group-value={value ?? ""}>{children}</div>,
	ToggleGroupItem: ({
		children,
		value,
	}: {
		children: React.ReactNode;
		value: string;
	}) => (
		<button type="button" data-toggle-item={value}>
			{children}
		</button>
	),
}));

type DeviceEditFormModule = typeof import("./device-edit-form");
let moduleCache: DeviceEditFormModule | null = null;

async function getDeviceEditForm() {
	if (!moduleCache) {
		moduleCache = await import("./device-edit-form");
	}
	return moduleCache.default;
}

const baseDevice: Device & { status?: string; type?: string } = {
	id: 1,
	name: "Kitchen display",
	mac_address: "AA:BB:CC:DD:EE:FF",
	api_key: "api-key",
	friendly_id: "kitchen-1",
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
	grayscale: 9,
	model: null,
	palette_id: null,
	status: "online",
	type: "trmnl",
};

const playlists: Playlist[] = [
	{ id: "playlist-1", name: "Lobby loop", created_at: null, updated_at: null },
];

const mixups: Mixup[] = [
	{
		id: "mixup-1",
		name: "Quarter board",
		layout_id: "quarters",
		created_at: null,
		updated_at: null,
	},
];

const noopProps = {
	onInputChange: () => undefined,
	onNestedInputChange: () => undefined,
	onSelectChange: () => undefined,
	onContentRefChange: () => undefined,
	onDeviceSizePresetChange: () => undefined,
	onCustomSizeChange: () => undefined,
	onRegenerateApiKey: () => undefined,
	onRegenerateFriendlyId: () => undefined,
	onAddTimeRange: () => undefined,
	onSubmit: () => undefined,
	onCancel: () => undefined,
};

describe("DeviceEditForm", () => {
	it("derives normalized grayscale, selected content, and preview sources", () => {
		assert.equal(getDeviceGrayscale(baseDevice), 16);
		assert.equal(
			getDeviceGrayscale({
				...baseDevice,
				grayscale: 4,
			}),
			4,
		);

		assert.deepEqual(
			getSelectedContent({
				editedDevice: {
					...baseDevice,
					screen: null,
					screen_id: null,
				},
				availableScreens: [],
				availableRecipes: [],
				availablePlaylists: playlists,
				availableMixups: mixups,
			}),
			{
				isPlaylist: false,
				isMixup: false,
				legacySingleScreenId: null,
				value: "none",
				label: "None (use default)",
			},
		);
		assert.deepEqual(
			getSelectedContent({
				editedDevice: {
					...baseDevice,
					display_mode: DeviceDisplayMode.PLAYLIST,
					playlist_id: "playlist-1",
				},
				availableScreens: [],
				availableRecipes: [],
				availablePlaylists: playlists,
				availableMixups: mixups,
			}),
			{
				isPlaylist: true,
				isMixup: false,
				legacySingleScreenId: "weather",
				value: "playlist:playlist-1",
				label: "Lobby loop",
			},
		);
		assert.deepEqual(
			getSelectedContent({
				editedDevice: {
					...baseDevice,
					display_mode: DeviceDisplayMode.MIXUP,
					mixup_id: "mixup-1",
				},
				availableScreens: [],
				availableRecipes: [],
				availablePlaylists: playlists,
				availableMixups: mixups,
			}),
			{
				isPlaylist: false,
				isMixup: true,
				legacySingleScreenId: "weather",
				value: "mixup:mixup-1",
				label: "Quarter board",
			},
		);
		assert.deepEqual(
			getPreviewSources({
				editedDevice: {
					...baseDevice,
					display_mode: DeviceDisplayMode.PLAYLIST,
					playlist_id: "playlist-1",
				},
				isMixup: false,
				isPlaylist: true,
				legacySingleScreenId: "weather",
				playlistScreens: [
					{ screen: "calendar", screen_type: "recipe", duration: 45 },
				],
				previewWidth: 800,
				previewHeight: 480,
				grayscale: 16,
			}),
			{
				playlistPreviewFrame: {
					screen: "calendar",
					screen_type: "recipe",
					duration: 45,
				},
				previewType: "recipe",
				heroSrc: "/api/bitmap/calendar.bmp?width=800&height=480&grayscale=16",
				pngSrc: "/api/png/calendar/default.png?width=800&height=480",
				reactSrc: "/preview/recipe/calendar?width=800&height=480",
			},
		);
		assert.deepEqual(
			getPreviewSources({
				editedDevice: {
					...baseDevice,
					display_mode: DeviceDisplayMode.MIXUP,
					mixup_id: "mixup-1",
				},
				isMixup: true,
				isPlaylist: false,
				legacySingleScreenId: "weather",
				playlistScreens: [],
				previewWidth: 1200,
				previewHeight: 825,
				grayscale: 2,
			}),
			{
				playlistPreviewFrame: null,
				previewType: "mixup",
				heroSrc:
					"/api/bitmap/mixup/mixup-1.bmp?width=1200&height=825&grayscale=2",
				pngSrc: "/api/png/mixup/mixup-1.png?width=1200&height=825",
				reactSrc: "/preview/mixup/mixup-1?width=1200&height=825",
			},
		);
	});

	it("renders playlist previews, selected content labels, and normalized grayscale controls", async () => {
		previewState.format = "bmp";
		const DeviceEditForm = await getDeviceEditForm();
		const html = renderToStaticMarkup(
			<DeviceEditForm
				editedDevice={{
					...baseDevice,
					display_mode: DeviceDisplayMode.PLAYLIST,
					playlist_id: "playlist-1",
				}}
				availableScreens={[{ id: "screen-1", title: "Screen one" }]}
				availableRecipes={[{ id: "weather", title: "Weather" }]}
				availablePlaylists={playlists}
				availableMixups={mixups}
				playlistScreens={[
					{ screen: "weather", screen_type: "recipe", duration: 30 },
				]}
				deviceSizePreset="custom"
				apiKeyError="Bad key"
				friendlyIdError="Bad id"
				isSaving={false}
				{...noopProps}
			/>,
		);

		assert.match(html, /data-preview-controls="bmp:landscape"/);
		assert.match(html, /Lobby loop/);
		assert.match(html, /Bad key/);
		assert.match(html, /Bad id/);
		assert.match(html, /value="800"/);
		assert.match(html, /value="480"/);
		assert.match(html, /data-toggle-group-value="16"/);
		assert.match(
			html,
			/\/api\/bitmap\/weather\.bmp\?width=800&amp;height=480&amp;grayscale=16/,
		);
		assert.match(html, /bmp:800x480:16:fit/);
	});

	it("shows an empty playlist message when there are no playlist frames", async () => {
		previewState.format = "bmp";
		const DeviceEditForm = await getDeviceEditForm();
		const html = renderToStaticMarkup(
			<DeviceEditForm
				editedDevice={{
					...baseDevice,
					display_mode: DeviceDisplayMode.PLAYLIST,
					playlist_id: "playlist-1",
				}}
				availableScreens={[]}
				availableRecipes={[]}
				availablePlaylists={playlists}
				availableMixups={mixups}
				playlistScreens={[]}
				deviceSizePreset="800x480"
				apiKeyError={null}
				friendlyIdError={null}
				isSaving={false}
				{...noopProps}
			/>,
		);

		assert.match(html, /This playlist does not have any frames yet\./);
	});

	it("shows the mixup format warning when non-BMP preview is selected", async () => {
		previewState.format = "png";
		const DeviceEditForm = await getDeviceEditForm();
		const html = renderToStaticMarkup(
			<DeviceEditForm
				editedDevice={{
					...baseDevice,
					display_mode: DeviceDisplayMode.MIXUP,
					mixup_id: "mixup-1",
				}}
				availableScreens={[]}
				availableRecipes={[]}
				availablePlaylists={playlists}
				availableMixups={mixups}
				playlistScreens={[]}
				deviceSizePreset="800x480"
				apiKeyError={null}
				friendlyIdError={null}
				isSaving={false}
				{...noopProps}
			/>,
		);

		assert.match(html, /PNG preview is not available for mixups yet\./);
		assert.match(html, /Quarter board/);
	});
});
