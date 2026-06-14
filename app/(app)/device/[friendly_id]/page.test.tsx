import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";
import { DeviceDisplayMode } from "@/lib/mixup/constants";
import type { Device, Mixup, Playlist, PlaylistItem } from "@/lib/types";

type ScreenRow = { id: string; name: string };
type RecipeRow = { id: string; name: string };

type InitData = {
	devices: Device[];
	playlists: Playlist[];
	playlistItems: PlaylistItem[];
	mixups: Mixup[];
};

type CapturedClientProps = {
	initialDevice: Device & { status?: string };
	availableScreens: Array<{ id: string; title: string }>;
	availableRecipes: Array<{ id: string; title: string }>;
	availablePlaylists: Playlist[];
	availableMixups: Mixup[];
	playlistItems: PlaylistItem[];
};

const pageState = vi.hoisted(() => ({
	initData: {
		devices: [] as Device[],
		playlists: [] as Playlist[],
		playlistItems: [] as PlaylistItem[],
		mixups: [] as Mixup[],
	} as InitData,
	recipes: [] as RecipeRow[],
	screens: [] as ScreenRow[],
	clientProps: null as CapturedClientProps | null,
	notFoundCount: 0,
}));

vi.mock("next/navigation", () => ({
	notFound: () => {
		pageState.notFoundCount += 1;
		throw new Error("NOT_FOUND");
	},
}));

vi.mock("@/app/actions/mixup", () => ({
	fetchRecipes: vi.fn(async () => pageState.recipes),
}));

vi.mock("@/app/actions/screens", () => ({
	listScreens: vi.fn(async () => pageState.screens),
}));

vi.mock("@/components/ui/skeleton", () => ({
	Skeleton: ({ className }: { className?: string }) => (
		<div data-skeleton={className ?? ""}>skeleton</div>
	),
}));

vi.mock("@/lib/getInitData", () => ({
	getInitData: vi.fn(async () => pageState.initData),
}));

vi.mock("@/utils/helpers", () => ({
	getDeviceStatus: vi.fn((device: Device) =>
		device.next_expected_update ? "online" : "offline",
	),
}));

vi.mock("./client-page", () => ({
	default: (props: CapturedClientProps) => {
		pageState.clientProps = props;
		return <div>device-client:{props.initialDevice.name}</div>;
	},
}));

type DevicePageModule = typeof import("./page.tsx");
let moduleCache: DevicePageModule | null = null;

function buildDevice(overrides: Partial<Device> = {}): Device {
	return {
		id: 1,
		name: "Hallway display",
		mac_address: "AA:BB:CC:DD:EE:FF",
		api_key: "ABCD1234EFGH5678",
		friendly_id: "ABC123",
		screen: null,
		screen_id: null,
		screen_type: null,
		refresh_schedule: null,
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
		...overrides,
	};
}

async function getPage() {
	if (!moduleCache) {
		moduleCache = await import("./page.tsx");
	}
	return moduleCache.default;
}

async function renderDeviceData(friendlyId: string) {
	const DevicePage = await getPage();
	const tree = await DevicePage({
		params: Promise.resolve({ friendly_id: friendlyId }),
	});
	const dataElement = tree.props.children;
	return await dataElement.type(dataElement.props);
}

describe("Device detail page", () => {
	it("renders the suspense fallback skeleton in static SSR", async () => {
		const DevicePage = await getPage();
		const html = renderToStaticMarkup(
			await DevicePage({
				params: Promise.resolve({ friendly_id: "ABC123" }),
			}),
		);

		assert.match(html, /skeleton/);
	});

	it("throws notFound when no matching device exists", async () => {
		pageState.initData = {
			devices: [],
			playlists: [],
			playlistItems: [],
			mixups: [],
		};
		pageState.recipes = [];
		pageState.screens = [];
		pageState.notFoundCount = 0;

		await assert.rejects(async () => {
			await renderDeviceData("MISSING");
		}, /NOT_FOUND/);
		assert.equal(pageState.notFoundCount, 1);
	});

	it("maps init data into client page props for the requested device", async () => {
		pageState.initData = {
			devices: [
				buildDevice({
					name: "Kitchen panel",
					friendly_id: "KIT123",
					playlist_id: "playlist-1",
				}),
				buildDevice({ id: 2, name: "Ignored", friendly_id: "IGN999" }),
			],
			playlists: [
				{
					id: "playlist-1",
					name: "Morning",
					created_at: null,
					updated_at: null,
				},
			],
			playlistItems: [
				{
					id: "item-1",
					playlist_id: "playlist-1",
					screen_id: "screen-1",
					screen_type: "screen",
					duration: 30,
					start_time: null,
					end_time: null,
					days_of_week: null,
					order_index: 0,
					created_at: null,
				},
			],
			mixups: [
				{
					id: "mixup-1",
					name: "Split",
					layout_id: "quarters",
					created_at: null,
					updated_at: null,
				},
			],
		};
		pageState.recipes = [{ id: "recipe-1", name: "Weather" }];
		pageState.screens = [{ id: "screen-1", name: "Kitchen screen" }];
		pageState.clientProps = null;

		const element = await renderDeviceData("KIT123");
		const html = renderToStaticMarkup(element);
		assert.ok(pageState.clientProps);
		const props = pageState.clientProps as CapturedClientProps;
		assert.equal(props.initialDevice.name, "Kitchen panel");
		assert.equal(props.initialDevice.status, "online");
		assert.deepEqual(props.availableRecipes, [
			{ id: "recipe-1", title: "Weather" },
		]);
		assert.deepEqual(props.availableScreens, [
			{ id: "screen-1", title: "Kitchen screen" },
		]);
		assert.equal(props.availablePlaylists, pageState.initData.playlists);
		assert.equal(props.availableMixups, pageState.initData.mixups);
		assert.equal(props.playlistItems, pageState.initData.playlistItems);
		assert.match(html, /device-client:Kitchen panel/);
	});
});
