"use client";

import { ChevronDown, ChevronUp, Filter, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchSystemLogs } from "@/app/actions/system";
import {
	EmptyLogsTableRow,
	LogsLevelTabs,
	LogsTableHeader,
	LogsTableSkeleton,
	shouldShowGroupedLogValue,
	useLogsUrlState,
	useScrollIntoViewAfterLoad,
} from "@/components/logs/log-viewer-helpers";
import { LogsPagination } from "@/components/logs/logs-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import type { SystemLog } from "@/lib/types";
import { formatDate } from "@/utils/helpers";

const DEFAULT_ITEMS_PER_PAGE = 100;
const SYSTEM_LOG_HEADERS = ["Time", "Level", "Source", "Message", "Metadata"];
const SYSTEM_LOG_SKELETON_WIDTHS = ["w-24", "w-16", "w-20", "w-full", "w-20"];
const LOG_LEVEL_BADGE_CLASSES: Record<string, string> = {
	error: "bg-red-100 text-red-800 border-red-200",
	warning: "bg-amber-100 text-amber-800 border-amber-200",
	info: "bg-blue-100 text-blue-800 border-blue-200",
	debug: "bg-gray-100 text-gray-800 border-gray-200",
};

// Define the type for the fetch function parameters
export type SystemLogsFetchParams = {
	page: number;
	perPage: number;
	search?: string;
	level?: string;
	source?: string;
};

// Define the type for the fetch function result
export type SystemLogsFetchResult = {
	logs: SystemLog[];
	total: number;
	uniqueSources: string[];
};

interface SystemLogsViewerProps {
	customFetchFunction?: (
		params: SystemLogsFetchParams,
	) => Promise<SystemLogsFetchResult>;
	paramPrefix?: string;
	perPage?: number;
	initialData?: {
		logs: SystemLog[];
		total: number;
		uniqueSources: string[];
	};
}

export default function SystemLogsViewer({
	customFetchFunction,
	paramPrefix = "",
	perPage = DEFAULT_ITEMS_PER_PAGE,
	initialData,
}: SystemLogsViewerProps) {
	const {
		router,
		pathname,
		searchParams,
		scrollRef,
		searchInputRef,
		page,
		searchQuery,
		createQueryString,
		handleSearchChange,
		handlePageChange,
		clearFilters,
	} = useLogsUrlState({ paramPrefix });
	const levelFilter = searchParams?.get(`${paramPrefix}level`) || "all";
	const sourceFilter = searchParams?.get(`${paramPrefix}source`) || "all";

	// State
	const [logs, setLogs] = useState<SystemLog[]>(initialData?.logs || []);
	const [totalLogs, setTotalLogs] = useState(initialData?.total || 0);
	const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});
	const [isLoading, setIsLoading] = useState(!initialData);
	const [sources, setSources] = useState<string[]>(
		initialData?.uniqueSources || [],
	);
	const [activeTab, setActiveTab] = useState<string>("all");

	// Handle level filter change
	const handleLevelChange = (value: string) => {
		const queryString = createQueryString({
			level: value === "all" ? null : value,
			page: 1, // Reset to page 1 on filter change
		});
		router.push(`${pathname}?${queryString}`, { scroll: false });
	};

	// Handle source filter change
	const handleSourceChange = (value: string) => {
		const queryString = createQueryString({
			source: value === "all" ? null : value,
			page: 1, // Reset to page 1 on filter change
		});
		router.push(`${pathname}?${queryString}`, { scroll: false });
	};

	// Toggle expanded state for a log
	const toggleExpanded = (id: string) => {
		setExpandedLogs((prev) => ({
			...prev,
			[id]: !prev[id],
		}));
	};

	// Fetch logs data
	useEffect(() => {
		// Skip initial fetch if we have initialData and no filters are applied
		if (
			initialData &&
			page === 1 &&
			!searchQuery &&
			levelFilter === "all" &&
			sourceFilter === "all"
		) {
			return;
		}

		const loadLogs = async () => {
			setIsLoading(true);
			try {
				const fetchParams = {
					page,
					perPage: perPage,
					search: searchQuery,
					level: levelFilter !== "all" ? levelFilter : undefined,
					source: sourceFilter !== "all" ? sourceFilter : undefined,
				};

				// Use the custom fetch function if provided, otherwise use the default
				const { logs, total, uniqueSources } = customFetchFunction
					? await customFetchFunction(fetchParams)
					: await fetchSystemLogs(fetchParams);

				setLogs(logs);
				setTotalLogs(total);
				setSources(uniqueSources);

				// Set active tab based on level filter
				setActiveTab(levelFilter !== "all" ? levelFilter : "all");
			} catch (error) {
				console.error("Failed to fetch logs:", error);
			} finally {
				setIsLoading(false);
			}
		};

		loadLogs();
	}, [
		page,
		searchQuery,
		levelFilter,
		sourceFilter,
		customFetchFunction,
		initialData,
		perPage,
	]);

	useScrollIntoViewAfterLoad(scrollRef, isLoading);

	// Check if any filters are active
	const hasActiveFilters =
		searchQuery || levelFilter !== "all" || sourceFilter !== "all";

	return (
		<div ref={scrollRef} className="space-y-4">
			<SystemLogsFilters
				searchInputRef={searchInputRef}
				searchQuery={searchQuery}
				sourceFilter={sourceFilter}
				sources={sources}
				hasActiveFilters={Boolean(hasActiveFilters)}
				onSearchChange={handleSearchChange}
				onSourceChange={handleSourceChange}
				onClearFilters={clearFilters}
			/>

			<ActiveSystemLogFilters
				searchQuery={searchQuery}
				levelFilter={levelFilter}
				sourceFilter={sourceFilter}
				hasActiveFilters={Boolean(hasActiveFilters)}
			/>

			<LogsLevelTabs
				value={activeTab}
				onValueChange={handleLevelChange}
				listClassName="grid grid-cols-5"
				includeDebug
			/>

			{/* Logs table */}
			<Card className="overflow-hidden p-0">
				<Table>
					<LogsTableHeader headers={SYSTEM_LOG_HEADERS} />
					<SystemLogsTableBody
						isLoading={isLoading}
						logs={logs}
						expandedLogs={expandedLogs}
						onToggleExpanded={toggleExpanded}
					/>
				</Table>
			</Card>

			{/* Pagination */}
			{!isLoading && logs.length > 0 && (
				<LogsPagination
					page={page}
					perPage={perPage}
					totalLogs={totalLogs}
					onPageChange={handlePageChange}
				/>
			)}
		</div>
	);
}

type SystemLogsFiltersProps = {
	searchInputRef: React.RefObject<HTMLInputElement | null>;
	searchQuery: string;
	sourceFilter: string;
	sources: string[];
	hasActiveFilters: boolean;
	onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onSourceChange: (value: string) => void;
	onClearFilters: () => void;
};

function SystemLogsFilters({
	searchInputRef,
	searchQuery,
	sourceFilter,
	sources,
	hasActiveFilters,
	onSearchChange,
	onSourceChange,
	onClearFilters,
}: SystemLogsFiltersProps) {
	return (
		<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
			<div className="relative flex-1">
				<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
				<Input
					ref={searchInputRef}
					placeholder="Search logs by message or metadata..."
					defaultValue={searchQuery}
					onChange={onSearchChange}
					className="pl-9"
				/>
			</div>

			<div className="flex flex-wrap items-center gap-2">
				<Select value={sourceFilter} onValueChange={onSourceChange}>
					<SelectTrigger className="w-[100px]">
						<SelectValue placeholder="Filter by source" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Sources</SelectItem>
						{sources.map((source) => (
							<SelectItem key={source} value={source}>
								{source}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				{hasActiveFilters && (
					<Button
						variant="outline"
						size="sm"
						onClick={onClearFilters}
						className="h-10"
					>
						<X className="mr-2 h-4 w-4" />
						Clear Filters
					</Button>
				)}
			</div>
		</div>
	);
}

type ActiveSystemLogFiltersProps = {
	searchQuery: string;
	levelFilter: string;
	sourceFilter: string;
	hasActiveFilters: boolean;
};

function ActiveSystemLogFilters({
	searchQuery,
	levelFilter,
	sourceFilter,
	hasActiveFilters,
}: ActiveSystemLogFiltersProps) {
	if (!hasActiveFilters) return null;

	return (
		<div className="flex flex-wrap items-center gap-2">
			<span className="text-sm text-muted-foreground flex items-center">
				<Filter className="mr-1 h-3 w-3" /> Active filters:
			</span>

			{searchQuery && (
				<Badge variant="secondary" className="text-xs">
					Search: {searchQuery}
				</Badge>
			)}

			{levelFilter !== "all" && (
				<Badge variant="secondary" className="text-xs">
					Level: {levelFilter}
				</Badge>
			)}

			{sourceFilter !== "all" && (
				<Badge variant="secondary" className="text-xs">
					Source: {sourceFilter}
				</Badge>
			)}
		</div>
	);
}

type SystemLogsTableBodyProps = {
	isLoading: boolean;
	logs: SystemLog[];
	expandedLogs: Record<string, boolean>;
	onToggleExpanded: (id: string) => void;
};

function SystemLogsTableBody({
	isLoading,
	logs,
	expandedLogs,
	onToggleExpanded,
}: SystemLogsTableBodyProps) {
	if (isLoading) {
		return (
			<TableBody>
				<LogsTableSkeleton cellWidths={SYSTEM_LOG_SKELETON_WIDTHS} />
			</TableBody>
		);
	}

	if (logs.length === 0) {
		return (
			<TableBody>
				<EmptyLogsTableRow colSpan={6} />
			</TableBody>
		);
	}

	return (
		<TableBody>
			{logs.map((log, index) => (
				<SystemLogRow
					key={log.id}
					log={log}
					previousLog={index > 0 ? logs[index - 1] : null}
					index={index}
					isExpanded={Boolean(expandedLogs[log.id])}
					onToggleExpanded={onToggleExpanded}
				/>
			))}
		</TableBody>
	);
}

type SystemLogRowProps = {
	log: SystemLog;
	previousLog: SystemLog | null;
	index: number;
	isExpanded: boolean;
	onToggleExpanded: (id: string) => void;
};

function SystemLogRow({
	log,
	previousLog,
	index,
	isExpanded,
	onToggleExpanded,
}: SystemLogRowProps) {
	const shouldTimeBeShown = shouldShowGroupedLogValue({
		index,
		current: log,
		previous: previousLog,
		thresholdSeconds: 3,
		getCreatedAt: (currentLog) => currentLog.created_at,
	});
	const shouldLevelBeShown = shouldShowGroupedLogValue({
		index,
		current: log,
		previous: previousLog,
		thresholdSeconds: 3,
		getCreatedAt: (currentLog) => currentLog.created_at,
		getValue: (currentLog) => currentLog.level,
	});

	return (
		<TableRow>
			<TableCell className="px-4 py-3 text-sm">
				{shouldTimeBeShown ? formatDate(log.created_at) : ""}
			</TableCell>
			<TableCell className="px-4 py-3">
				{shouldLevelBeShown ? <SystemLogLevelBadge level={log.level} /> : ""}
			</TableCell>
			<TableCell className="px-4 py-3 text-sm max-w-[120px] truncate">
				{log.source}
			</TableCell>
			<TableCell className="px-4 py-3 text-sm max-w-[200px] md:max-w-[250px] lg:max-w-[300px] truncate">
				{log.message}
			</TableCell>
			<SystemLogMetadataCell
				log={log}
				isExpanded={isExpanded}
				onToggleExpanded={onToggleExpanded}
			/>
		</TableRow>
	);
}

function SystemLogLevelBadge({ level }: { level: string }) {
	return (
		<Badge variant="outline" className={LOG_LEVEL_BADGE_CLASSES[level] || ""}>
			{level}
		</Badge>
	);
}

type SystemLogMetadataCellProps = {
	log: SystemLog;
	isExpanded: boolean;
	onToggleExpanded: (id: string) => void;
};

function SystemLogMetadataCell({
	log,
	isExpanded,
	onToggleExpanded,
}: SystemLogMetadataCellProps) {
	if (!log.metadata) {
		return (
			<TableCell className="px-4 py-3 text-sm">
				<span className="text-muted-foreground"> - </span>
			</TableCell>
		);
	}

	return (
		<TableCell className="px-4 py-3 text-sm">
			<div className="flex items-start gap-1 justify-between">
				<div className="font-mono text-xs w-full max-w-[120px] md:max-w-[200px] lg:max-w-[400px]">
					<SystemLogMetadata metadata={log.metadata} isExpanded={isExpanded} />
				</div>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => onToggleExpanded(log.id)}
					aria-label={isExpanded ? "Collapse details" : "Expand details"}
					className="bg-transparent"
				>
					{isExpanded ? (
						<ChevronUp className="h-4 w-4" />
					) : (
						<ChevronDown className="h-4 w-4" />
					)}
				</Button>
			</div>
		</TableCell>
	);
}

function SystemLogMetadata({
	metadata,
	isExpanded,
}: {
	metadata: string;
	isExpanded: boolean;
}) {
	if (!isExpanded) {
		return <div className="pt-2 h-8 truncate">{metadata}</div>;
	}

	return (
		<div className="pt-2 h-[200px] w-full overflow-auto">
			<pre className="whitespace-pre-wrap break-words">
				{JSON.stringify(JSON.parse(metadata), null, 2)}
			</pre>
		</div>
	);
}
