import assert from "node:assert/strict";
import * as React from "react";
import { renderToReadableStream } from "react-dom/server";
import { describe, it, vi } from "vitest";

type CapturedClientProps = {
	perPage: number;
	initialData: {
		logs: Array<{ id: string }>;
		total: number;
		uniqueSources: string[];
	};
};

const systemLogsState = vi.hoisted(() => ({
	dbReady: true,
	dbError: null as string | null,
	logsResult: {
		logs: [{ id: "log-1" }],
		total: 1,
		uniqueSources: ["worker"],
	},
	clientProps: null as CapturedClientProps | null,
}));

vi.mock("react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react")>();
	return {
		...actual,
		Suspense: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	};
});

vi.mock("next/link", () => ({
	default: ({
		href,
		children,
	}: {
		href: string;
		children: React.ReactNode;
	}) => <a href={href}>{children}</a>,
}));

vi.mock("@/app/actions/system", () => ({
	fetchSystemLogs: vi.fn(async () => systemLogsState.logsResult),
}));

vi.mock("@/components/common/page-template", () => ({
	PageTemplate: ({
		title,
		subtitle,
		children,
	}: {
		title: string;
		subtitle: string;
		children: React.ReactNode;
	}) => (
		<div>
			<h1>{title}</h1>
			<p>{subtitle}</p>
			{children}
		</div>
	),
}));

vi.mock("@/components/system-logs/system-logs-viewer-skeleton", () => ({
	default: ({ className }: { className?: string }) => (
		<div>skeleton:{className ?? ""}</div>
	),
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({ children }: { children: React.ReactNode }) => (
		<button type="button">{children}</button>
	),
}));

vi.mock("@/lib/database/utils", () => ({
	getDbStatus: vi.fn(async () => ({
		ready: systemLogsState.dbReady,
		error: systemLogsState.dbError,
	})),
}));

vi.mock("./client-page", () => ({
	SystemLogsClientPage: (props: CapturedClientProps) => {
		systemLogsState.clientProps = props;
		return <div>system-logs-client:{JSON.stringify(props)}</div>;
	},
}));

type SystemLogsPageModule = typeof import("./page.tsx");
let moduleCache: SystemLogsPageModule | null = null;

async function getModule() {
	if (!moduleCache) {
		moduleCache = await import("./page.tsx");
	}
	return moduleCache;
}

async function renderAsync(element: React.ReactElement) {
	const stream = await renderToReadableStream(element);
	await stream.allReady;
	return (await new Response(stream).text()).replaceAll("<!-- -->", "");
}

describe("System logs page", () => {
	it("passes initial logs payload to the client page when db is ready", async () => {
		systemLogsState.dbReady = true;
		systemLogsState.clientProps = null;
		systemLogsState.logsResult = {
			logs: [{ id: "log-1" }],
			total: 1,
			uniqueSources: ["worker"],
		};

		const module = await getModule();
		const html = await renderAsync(<module.default />);

		assert.deepEqual(systemLogsState.clientProps, {
			perPage: 15,
			initialData: systemLogsState.logsResult,
		});
		assert.match(html, /system-logs-client/);
	});

	it("renders the db error shell when the database is unavailable", async () => {
		systemLogsState.dbReady = false;
		systemLogsState.dbError = "db down";
		systemLogsState.clientProps = null;

		const module = await getModule();
		const html = await renderAsync(<module.default />);

		assert.equal(systemLogsState.clientProps, null);
		assert.match(html, /Database Connection Error/);
		assert.match(html, /Go to Dashboard/);
		assert.match(html, /skeleton:filter blur/);
	});
});
