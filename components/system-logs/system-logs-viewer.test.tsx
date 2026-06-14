import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";
import type { SystemLog } from "@/lib/types";

const state = vi.hoisted(() => ({
	pathname: "/system-logs",
	search: "",
	pushCalls: [] as Array<{ href: string; options?: { scroll: boolean } }>,
	buttonClicks: [] as Array<React.MouseEventHandler<HTMLButtonElement>>,
}));

vi.mock("next/navigation", () => ({
	usePathname: () => state.pathname,
	useRouter: () => ({
		push: (href: string, options?: { scroll: boolean }) => {
			state.pushCalls.push({ href, options });
		},
	}),
	useSearchParams: () => new URLSearchParams(state.search),
}));

vi.mock("@/hooks/useSearchWithDebounce", () => ({
	useSearchWithDebounce: () => () => undefined,
}));

vi.mock("@/app/actions/system", () => ({
	fetchSystemLogs: vi.fn(),
}));

vi.mock("@/components/ui/button", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/components/ui/button")>();

	return {
		...actual,
		Button: ({
			children,
			onClick,
			...props
		}: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
			if (onClick) {
				state.buttonClicks.push(onClick);
			}
			return (
				<button type="button" {...props}>
					{children}
				</button>
			);
		},
	};
});

const logs: SystemLog[] = [
	{
		id: "log-1",
		level: "error",
		source: "device-agent",
		message: "Disk full",
		metadata: '{"path":"/var"}',
		trace: null,
		created_at: "2026-06-13T10:00:00.000Z",
	},
	{
		id: "log-2",
		level: "warning",
		source: "scheduler",
		message: "Retry queued",
		metadata: null,
		trace: null,
		created_at: "2026-06-13T10:00:05.000Z",
	},
];

type SystemLogsViewerModule = typeof import("./system-logs-viewer");
let moduleCache: SystemLogsViewerModule | null = null;

async function getSystemLogsViewer() {
	if (!moduleCache) {
		moduleCache = await import("./system-logs-viewer");
	}
	return moduleCache.default;
}

describe("SystemLogsViewer", () => {
	it("renders initial logs, metadata, and pagination without fetching", async () => {
		state.search = "";
		const SystemLogsViewer = await getSystemLogsViewer();
		const html = renderToStaticMarkup(
			<SystemLogsViewer
				initialData={{
					logs,
					total: 101,
					uniqueSources: ["device-agent", "scheduler"],
				}}
			/>,
		);

		assert.match(html, /Search logs by message or metadata/);
		assert.match(html, /grid grid-cols-5/);
		assert.match(html, />Error</);
		assert.match(html, />Warning</);
		assert.match(html, />Debug</);
		assert.match(html, /Disk full/);
		assert.match(html, /Retry queued/);
		assert.match(html, /Expand details/);
		assert.match(html, /text-muted-foreground"> - </);
		assert.match(
			html,
			/Showing <span class="font-medium">1<\/span> to <span class="font-medium">100<\/span> of <span class="font-medium">101<\/span> logs/,
		);
	});

	it("surfaces active filters from the query string", async () => {
		state.search = "search=disk&level=error&source=device-agent";
		const SystemLogsViewer = await getSystemLogsViewer();
		const html = renderToStaticMarkup(
			<SystemLogsViewer
				initialData={{
					logs,
					total: 2,
					uniqueSources: ["device-agent", "scheduler"],
				}}
			/>,
		);

		assert.match(html, /Clear Filters/);
		assert.match(html, /Search: disk/);
		assert.match(html, /Level: error/);
		assert.match(html, /Source: device-agent/);
	});

	it("renders filter and table subcomponents across loading, empty, and expanded branches", async () => {
		const {
			ActiveSystemLogFilters,
			applyExpandedLogToggle,
			buildSystemLogsFetchParams,
			buildSystemLogsFilterQuery,
			getNextExpandedLogs,
			hasActiveSystemLogFilters,
			loadSystemLogsData,
			runSystemLogsEffect,
			shouldSkipInitialSystemLogsFetch,
			SystemLogMetadata,
			SystemLogMetadataCell,
			SystemLogRow,
			SystemLogsFilters,
			SystemLogsTableBody,
		} = await import("./system-logs-viewer");

		const inactiveFilters = renderToStaticMarkup(
			<ActiveSystemLogFilters
				searchQuery=""
				levelFilter="all"
				sourceFilter="all"
				hasActiveFilters={false}
			/>,
		);
		const filterHtml = renderToStaticMarkup(
			<SystemLogsFilters
				searchInputRef={{ current: null }}
				searchQuery="disk"
				sourceFilter="device-agent"
				sources={["device-agent", "scheduler"]}
				hasActiveFilters
				onSearchChange={() => undefined}
				onSourceChange={() => undefined}
				onClearFilters={() => undefined}
			/>,
		);
		const loadingHtml = renderToStaticMarkup(
			<table>
				<SystemLogsTableBody
					isLoading
					logs={[]}
					expandedLogs={{}}
					onToggleExpanded={() => undefined}
				/>
			</table>,
		);
		const emptyHtml = renderToStaticMarkup(
			<table>
				<SystemLogsTableBody
					isLoading={false}
					logs={[]}
					expandedLogs={{}}
					onToggleExpanded={() => undefined}
				/>
			</table>,
		);
		const rowHtml = renderToStaticMarkup(
			<table>
				<tbody>
					<SystemLogRow
						log={logs[1]}
						previousLog={logs[0]}
						index={1}
						isExpanded
						onToggleExpanded={() => undefined}
					/>
				</tbody>
			</table>,
		);
		const metadataHtml = renderToStaticMarkup(
			<SystemLogMetadata metadata={logs[0].metadata ?? "{}"} isExpanded />,
		);
		const metadataCellHtml = renderToStaticMarkup(
			<table>
				<tbody>
					<tr>
						<SystemLogMetadataCell
							log={logs[0]}
							isExpanded={false}
							onToggleExpanded={() => undefined}
						/>
					</tr>
				</tbody>
			</table>,
		);

		assert.equal(inactiveFilters, "");
		assert.match(filterHtml, /role="combobox"/);
		assert.match(filterHtml, /Clear Filters/);
		assert.match(loadingHtml, /w-full/);
		assert.match(emptyHtml, /No logs found matching your criteria/);
		assert.match(rowHtml, /text-muted-foreground"> - </);
		assert.match(rowHtml, />warning</);
		assert.match(metadataHtml, /&quot;path&quot;: &quot;\/var&quot;/);
		assert.match(metadataCellHtml, /Expand details/);

		assert.equal(
			buildSystemLogsFilterQuery({
				createQueryString: (params) => {
					const searchParams = new URLSearchParams();
					for (const [key, value] of Object.entries(params)) {
						if (value === null) {
							continue;
						}
						searchParams.set(key, String(value));
					}
					return searchParams.toString();
				},
				filterKey: "level",
				value: "all",
			}),
			"page=1",
		);
		assert.deepEqual(getNextExpandedLogs({ "log-1": true }, "log-1"), {
			"log-1": false,
		});
		assert.equal(
			shouldSkipInitialSystemLogsFetch({
				initialData: {
					logs,
					total: 2,
					uniqueSources: ["device-agent", "scheduler"],
				},
				page: 1,
				searchQuery: "",
				levelFilter: "all",
				sourceFilter: "all",
			}),
			true,
		);
		assert.equal(
			hasActiveSystemLogFilters({
				searchQuery: "",
				levelFilter: "error",
				sourceFilter: "all",
			}),
			true,
		);
		assert.deepEqual(
			buildSystemLogsFetchParams({
				page: 2,
				perPage: 25,
				searchQuery: "disk",
				levelFilter: "warning",
				sourceFilter: "scheduler",
			}),
			{
				page: 2,
				perPage: 25,
				search: "disk",
				level: "warning",
				source: "scheduler",
			},
		);

		const toggledStates: Array<Record<string, boolean>> = [];
		applyExpandedLogToggle({
			id: "log-1",
			setExpandedLogs: (next) => {
				if (typeof next === "function") {
					toggledStates.push(next({ "log-1": false }));
					return;
				}
				toggledStates.push(next);
			},
		});
		assert.deepEqual(toggledStates, [{ "log-1": true }]);

		const loaderState = {
			isLoading: [] as boolean[],
			logs: [] as SystemLog[][],
			totals: [] as number[],
			sources: [] as string[][],
			activeTabs: [] as string[],
		};
		await loadSystemLogsData({
			page: 2,
			perPage: 25,
			searchQuery: "disk",
			levelFilter: "warning",
			sourceFilter: "scheduler",
			customFetchFunction: async () => ({
				logs,
				total: 2,
				uniqueSources: ["device-agent", "scheduler"],
			}),
			setIsLoading: (value) => loaderState.isLoading.push(value),
			setLogs: (nextLogs) => loaderState.logs.push(nextLogs),
			setTotalLogs: (total) => loaderState.totals.push(total),
			setSources: (nextSources) => loaderState.sources.push(nextSources),
			setActiveTab: (tab) => loaderState.activeTabs.push(tab),
		});
		assert.deepEqual(loaderState.isLoading, [true, false]);
		assert.deepEqual(loaderState.logs, [logs]);
		assert.deepEqual(loaderState.totals, [2]);
		assert.deepEqual(loaderState.sources, [["device-agent", "scheduler"]]);
		assert.deepEqual(loaderState.activeTabs, ["warning"]);

		const skipped = runSystemLogsEffect({
			initialData: {
				logs,
				total: 2,
				uniqueSources: ["device-agent", "scheduler"],
			},
			page: 1,
			perPage: 25,
			searchQuery: "",
			levelFilter: "all",
			sourceFilter: "all",
			setIsLoading: () => undefined,
			setLogs: () => undefined,
			setTotalLogs: () => undefined,
			setSources: () => undefined,
			setActiveTab: () => undefined,
		});
		assert.equal(skipped, false);

		const effectCalls: Array<Record<string, unknown>> = [];
		const ran = runSystemLogsEffect({
			page: 2,
			perPage: 25,
			searchQuery: "disk",
			levelFilter: "warning",
			sourceFilter: "scheduler",
			setIsLoading: () => undefined,
			setLogs: () => undefined,
			setTotalLogs: () => undefined,
			setSources: () => undefined,
			setActiveTab: () => undefined,
			loadLogsData: async (args) => {
				effectCalls.push(args);
			},
		});
		assert.equal(ran, true);
		assert.equal(effectCalls.length, 1);
	});

	it("invokes the metadata toggle handler from the rendered button callback", async () => {
		state.buttonClicks = [];
		const toggled: string[] = [];
		const { SystemLogMetadataCell } = await import("./system-logs-viewer");

		renderToStaticMarkup(
			<table>
				<tbody>
					<tr>
						<SystemLogMetadataCell
							log={logs[0]}
							isExpanded
							onToggleExpanded={(id) => toggled.push(id)}
						/>
					</tr>
				</tbody>
			</table>,
		);

		const toggleButton = state.buttonClicks.at(-1);
		toggleButton?.({} as React.MouseEvent<HTMLButtonElement>);

		assert.deepEqual(toggled, ["log-1"]);
	});
});
