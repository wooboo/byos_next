import * as React from "react";
import { renderToReadableStream } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

type InitData = {
	devices: Array<{ id: string }>;
	systemLogs: Array<{ id: string }>;
	dbStatus: {
		ready: boolean;
		error?: string | null;
		PostgresUrl?: string | null;
	};
};

const dashboardState = vi.hoisted(() => ({
	hour: 9,
	initData: {
		devices: [],
		systemLogs: [],
		dbStatus: {
			ready: true,
			error: null,
			PostgresUrl: null,
		},
	} as InitData,
	clientPageProps: null as {
		devices: InitData["devices"];
		systemLogs: InitData["systemLogs"];
	} | null,
	dbInitializerUrl: null as string | null | undefined,
	lastHeaderName: null as string | null,
}));

vi.mock("react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react")>();
	return {
		...actual,
		Suspense: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	};
});

vi.mock("next/headers", () => ({
	headers: vi.fn(async () => ({
		get: (name: string) => {
			dashboardState.lastHeaderName = name;
			return "vitest";
		},
	})),
}));

vi.mock("next/server", () => ({
	connection: vi.fn(async () => undefined),
}));

vi.mock("@/lib/getInitData", () => ({
	getInitData: vi.fn(async () => dashboardState.initData),
}));

vi.mock("@/components/common/page-template", () => ({
	PageTemplate: ({
		title,
		children,
	}: {
		title: React.ReactNode;
		children: React.ReactNode;
	}) => (
		<div>
			<div data-testid="title">{title}</div>
			{children}
		</div>
	),
}));

vi.mock("@/components/dashboard/dashboard-skeleton", () => ({
	DashboardSkeleton: ({ className }: { className?: string }) => (
		<div data-testid="dashboard-skeleton" data-class-name={className ?? ""} />
	),
}));

vi.mock("@/components/dashboard/db-initializer", () => ({
	DbInitializer: ({ connectionUrl }: { connectionUrl?: string | null }) => {
		dashboardState.dbInitializerUrl = connectionUrl;
		return <div>db-initializer:{connectionUrl ?? "none"}</div>;
	},
}));

vi.mock("@/components/ui/badge", () => ({
	Badge: ({ children }: { children: React.ReactNode }) => (
		<span>{children}</span>
	),
}));

vi.mock("./client-page", () => ({
	default: (props: {
		devices: InitData["devices"];
		systemLogs: InitData["systemLogs"];
	}) => {
		dashboardState.clientPageProps = props;
		return (
			<div>
				dashboard-client:{props.devices.length}:{props.systemLogs.length}
			</div>
		);
	},
}));

type DashboardPageModule = typeof import("./page.tsx");
let pageCache: DashboardPageModule | null = null;

async function getPage() {
	if (!pageCache) {
		pageCache = await import("./page.tsx");
	}
	return pageCache.default;
}

async function renderAsync(element: React.ReactElement) {
	const stream = await renderToReadableStream(element);
	await stream.allReady;
	return (await new Response(stream).text()).replaceAll("<!-- -->", "");
}

describe("Dashboard page", () => {
	it("renders the morning greeting and passes ready data to the client page", async () => {
		dashboardState.hour = 9;
		dashboardState.initData = {
			devices: [{ id: "device-1" }],
			systemLogs: [{ id: "log-1" }],
			dbStatus: { ready: true, error: null, PostgresUrl: null },
		};
		dashboardState.clientPageProps = null;
		dashboardState.lastHeaderName = null;

		const realDate = Date;
		class MockDate extends Date {
			constructor(...args: [] | [string | number | Date]) {
				if (args.length === 0) {
					super("2026-06-13T09:00:00.000Z");
				} else {
					super(...args);
				}
			}
			getHours() {
				return dashboardState.hour;
			}
		}
		// @ts-expect-error test override
		globalThis.Date = MockDate;

		try {
			const DashboardPage = await getPage();
			const html = await renderAsync(await DashboardPage());

			expect(html).toContain("Good morning");
			expect(html).toContain("dashboard-client:1:1");
			expect(html).not.toContain("noDB mode");
			expect(dashboardState.clientPageProps).toEqual({
				devices: [{ id: "device-1" }],
				systemLogs: [{ id: "log-1" }],
			});
			expect(dashboardState.lastHeaderName).toBe("user-agent");
		} finally {
			globalThis.Date = realDate;
		}
	});

	it("renders noDB guidance when the database URL is missing", async () => {
		dashboardState.hour = 14;
		dashboardState.initData = {
			devices: [],
			systemLogs: [],
			dbStatus: {
				ready: false,
				error: "ERROR_ENV_VAR_DATABASE_URL_NOT_SET",
				PostgresUrl: "postgres://db",
			},
		};
		dashboardState.dbInitializerUrl = null;

		const realDate = Date;
		class MockDate extends Date {
			constructor(...args: [] | [string | number | Date]) {
				if (args.length === 0) {
					super("2026-06-13T14:00:00.000Z");
				} else {
					super(...args);
				}
			}
			getHours() {
				return dashboardState.hour;
			}
		}
		// @ts-expect-error test override
		globalThis.Date = MockDate;

		try {
			const DashboardPage = await getPage();
			const html = await renderAsync(await DashboardPage());

			expect(html).toContain("Good afternoon");
			expect(html).toContain("noDB mode");
			expect(html).toContain("Database not configured");
			expect(html).toContain("DATABASE_URL");
			expect(html).toContain("db-initializer:postgres://db");
			expect(dashboardState.dbInitializerUrl).toBe("postgres://db");
		} finally {
			globalThis.Date = realDate;
		}
	});

	it("renders missing-table guidance for incomplete schemas", async () => {
		dashboardState.hour = 20;
		dashboardState.initData = {
			devices: [],
			systemLogs: [],
			dbStatus: {
				ready: false,
				error: "Missing required tables: devices, logs",
				PostgresUrl: null,
			},
		};

		const realDate = Date;
		class MockDate extends Date {
			constructor(...args: [] | [string | number | Date]) {
				if (args.length === 0) {
					super("2026-06-13T20:00:00.000Z");
				} else {
					super(...args);
				}
			}
			getHours() {
				return dashboardState.hour;
			}
		}
		// @ts-expect-error test override
		globalThis.Date = MockDate;

		try {
			const DashboardPage = await getPage();
			const html = await renderAsync(await DashboardPage());

			expect(html).toContain("Good evening");
			expect(html).toContain("Database schema incomplete");
			expect(html).toContain("devices, logs");
		} finally {
			globalThis.Date = realDate;
		}
	});
});
