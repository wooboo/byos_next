import type React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentConfig } from "@/components/sidebar-types";
import { DeviceDisplayMode } from "@/lib/mixup/constants";
import type { Device, RecipeSidebarItem } from "@/lib/types";

type MockSession = {
	user: {
		name: string;
		email: string;
		image: string;
		role: string;
	};
} | null;

type LayoutProps = {
	devices: Device[];
	dbStatus: {
		ready: boolean;
		error?: string;
		PostgresUrl?: string;
	};
	recipeSidebarItems: RecipeSidebarItem[];
	toolsComponents: [string, ComponentConfig][];
	user: {
		name: string;
		email: string;
		image?: string | null;
		role?: string;
	} | null;
	authEnabled: boolean;
	children: React.ReactNode;
};

const state = vi.hoisted(() => ({
	headersValue: new Headers([["x-test", "1"]]),
	initData: null as {
		devices: Device[];
		dbStatus: {
			ready: boolean;
			error?: string;
			PostgresUrl?: string;
		};
	} | null,
	recipes: [
		{ slug: "zebra", name: "Zebra" },
		{ slug: "alpha", name: "Alpha" },
	],
	session: {
		user: {
			name: "Ada",
			email: "ada@example.com",
			image: "https://example.com/ada.png",
			role: "admin",
		},
	} as MockSession,
	capturedProps: null as LayoutProps | null,
	getSessionCalls: [] as Array<{ headers: Headers }>,
	preloadDashboardCalls: 0,
	preloadDevicesCalls: 0,
	preloadSystemLogsCalls: 0,
	syncCalls: 0,
}));

function requireInitData() {
	if (!state.initData) {
		throw new Error("initData fixture was not initialized");
	}
	return state.initData;
}

vi.mock("next/headers", () => ({
	headers: vi.fn(async () => state.headersValue),
}));

vi.mock("@/app/(app)/tools/tools.json", () => ({
	default: {
		gamma: { title: "Gamma Tool", published: true },
		beta: { title: "Beta Tool", published: false },
		alpha: { title: "Alpha Tool", published: true },
	},
}));

vi.mock("@/app/actions/mixup", () => ({
	fetchRecipes: vi.fn(async () => state.recipes),
}));

vi.mock("@/components/client-main-layout", () => ({
	ClientMainLayout: (props: LayoutProps) => {
		state.capturedProps = props;
		return <div data-testid="client-main-layout">{props.children}</div>;
	},
}));

vi.mock("@/lib/auth/auth", () => ({
	auth: {
		api: {
			getSession: vi.fn(async ({ headers }: { headers: Headers }) => {
				state.getSessionCalls.push({ headers });
				return state.session;
			}),
		},
	},
}));

vi.mock("@/lib/getInitData", () => ({
	getInitData: vi.fn(async () => requireInitData()),
	preloadDashboard: vi.fn(() => {
		state.preloadDashboardCalls += 1;
	}),
	preloadDevices: vi.fn(() => {
		state.preloadDevicesCalls += 1;
	}),
	preloadSystemLogs: vi.fn(() => {
		state.preloadSystemLogsCalls += 1;
	}),
}));

vi.mock("@/lib/recipes/sync-react-recipes", () => ({
	syncReactRecipes: vi.fn(async () => {
		state.syncCalls += 1;
	}),
}));

async function importLayout() {
	vi.resetModules();
	return (await import("./main-layout-server")).default;
}

beforeEach(() => {
	state.initData = {
		devices: [
			{
				id: 1,
				name: "Kitchen",
				mac_address: "00:11:22:33:44:55",
				api_key: "api-key",
				friendly_id: "kitchen",
				screen: null,
				screen_id: null,
				screen_type: null,
				refresh_schedule: null,
				timezone: "UTC",
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
				screen_width: null,
				screen_height: null,
				screen_orientation: null,
				grayscale: null,
				model: null,
				palette_id: null,
			},
		],
		dbStatus: { ready: true, error: undefined },
	};
	state.capturedProps = null;
	state.getSessionCalls = [];
	state.preloadDashboardCalls = 0;
	state.preloadDevicesCalls = 0;
	state.preloadSystemLogsCalls = 0;
	state.syncCalls = 0;
	state.session = {
		user: {
			name: "Ada",
			email: "ada@example.com",
			image: "https://example.com/ada.png",
			role: "admin",
		},
	};
	state.recipes = [
		{ slug: "zebra", name: "Zebra" },
		{ slug: "alpha", name: "Alpha" },
	];
	vi.unstubAllEnvs();
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("main-layout-server", () => {
	it("passes sorted data, mapped user info, and preloads dependent data", async () => {
		vi.stubEnv("AUTH_ENABLED", "true");
		vi.stubEnv("NODE_ENV", "production");

		const MainLayout = await importLayout();
		const html = renderToStaticMarkup(
			await MainLayout({
				children: <section>Dashboard content</section>,
			}),
		);

		expect(html).toContain("Dashboard content");
		expect(state.capturedProps).not.toBeNull();
		const initData = requireInitData();

		expect(state.capturedProps?.devices).toEqual(initData.devices);
		expect(state.capturedProps?.dbStatus).toEqual(initData.dbStatus);
		expect(state.capturedProps?.recipeSidebarItems).toEqual([
			{ slug: "alpha", name: "Alpha" },
			{ slug: "zebra", name: "Zebra" },
		]);
		expect(state.capturedProps?.toolsComponents).toEqual([
			["alpha", { title: "Alpha Tool", published: true }],
			["gamma", { title: "Gamma Tool", published: true }],
		]);
		expect(state.capturedProps?.user).toEqual({
			name: "Ada",
			email: "ada@example.com",
			image: "https://example.com/ada.png",
			role: "admin",
		});
		expect(state.capturedProps?.authEnabled).toBe(true);
		expect(state.getSessionCalls).toHaveLength(1);
		expect(state.getSessionCalls[0]?.headers).toBe(state.headersValue);
		expect(state.preloadDashboardCalls).toBe(1);
		expect(state.preloadDevicesCalls).toBe(1);
		expect(state.preloadSystemLogsCalls).toBe(1);
		expect(state.syncCalls).toBe(1);
	});

	it("keeps all tools outside production and passes null user when no session exists", async () => {
		vi.stubEnv("AUTH_ENABLED", "false");
		vi.stubEnv("NODE_ENV", "test");
		state.session = null;

		const MainLayout = await importLayout();
		renderToStaticMarkup(
			await MainLayout({
				children: <div>Child content</div>,
			}),
		);

		expect(state.capturedProps?.authEnabled).toBe(false);
		expect(state.capturedProps?.user).toBeNull();
		expect(state.capturedProps?.toolsComponents).toEqual([
			["alpha", { title: "Alpha Tool", published: true }],
			["beta", { title: "Beta Tool", published: false }],
			["gamma", { title: "Gamma Tool", published: true }],
		]);
	});
});
