"use client";

import {
	AlertTriangle,
	BatteryCharging,
	Clock,
	Coffee,
	Cpu,
	FileCode,
	Filter,
	HardDrive,
	RefreshCw,
	Search,
	Timer,
	Wifi,
	WifiOff,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { fetchDeviceLogsWithFilters } from "@/app/actions/device";
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
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import type { Log } from "@/lib/types";
import { formatDate, getLogType } from "@/utils/helpers";

const ITEMS_PER_PAGE = 15;

interface DeviceLogsViewerProps {
	friendlyId?: string;
	paramPrefix?: string;
}

export default function DeviceLogsViewer({
	friendlyId,
	paramPrefix = "",
}: DeviceLogsViewerProps) {
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
	} = useLogsUrlState({ paramPrefix, preserveActiveTab: true });
	const typeFilter = searchParams?.get(`${paramPrefix}type`) || "all";

	// State
	const [logs, setLogs] = useState<(Log & { type?: string })[]>([]);
	const [totalLogs, setTotalLogs] = useState(0);
	const [isLoading, setIsLoading] = useState(true);
	const [logTypes, setLogTypes] = useState<string[]>([]);
	const [activeTab, setActiveTab] = useState<string>("all");

	// Handle type filter change
	const handleTypeChange = (value: string) => {
		const queryString = createQueryString({
			type: value === "all" ? null : value,
			page: 1, // Reset to page 1 on filter change
		});
		router.push(`${pathname}?${queryString}`, { scroll: false });
	};

	// Fetch logs data
	useEffect(() => {
		const loadLogs = async () => {
			setIsLoading(true);
			try {
				const { logs, total, uniqueTypes } = await fetchDeviceLogsWithFilters({
					page,
					perPage: ITEMS_PER_PAGE,
					search: typeFilter !== "all" ? typeFilter : searchQuery,
					friendlyId,
				});

				setLogs(logs);
				setTotalLogs(total);
				setLogTypes(uniqueTypes);

				// Set active tab based on type filter
				setActiveTab(typeFilter !== "all" ? typeFilter : "all");
			} catch (error) {
				console.error("Failed to fetch logs:", error);
			} finally {
				setIsLoading(false);
			}
		};

		loadLogs();
	}, [page, searchQuery, typeFilter, friendlyId]);

	useScrollIntoViewAfterLoad(scrollRef, isLoading);

	// Check if any filters are active
	const hasActiveFilters = searchQuery || typeFilter !== "all";

	// Get log type color class
	const getLogTypeColorClass = (type: string | undefined) => {
		switch (type) {
			case "error":
				return "bg-red-100 text-red-800 border-red-200";
			case "warning":
				return "bg-amber-100 text-amber-800 border-amber-200";
			default:
				return "bg-blue-100 text-blue-800 border-blue-200";
		}
	};

	const getGridColsClass = (count: number) => {
		const gridColsMap: Record<number, string> = {
			1: "grid-cols-1",
			2: "grid-cols-2",
			3: "grid-cols-3",
			4: "grid-cols-4",
			5: "grid-cols-5",
			6: "grid-cols-6",
			7: "grid-cols-7",
			8: "grid-cols-8",
			9: "grid-cols-9",
			10: "grid-cols-10",
		};
		return gridColsMap[count] || "grid-cols-3";
	};

	return (
		<div ref={scrollRef} className="space-y-4">
			{/* Search and filters */}
			<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<div className="relative flex-1">
					<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
					<Input
						ref={searchInputRef}
						placeholder="Search logs by content..."
						defaultValue={searchQuery}
						onChange={handleSearchChange}
						className="pl-9"
					/>
				</div>

				{hasActiveFilters && (
					<Button
						variant="outline"
						size="sm"
						onClick={clearFilters}
						className="h-10"
					>
						<X className="mr-2 h-4 w-4" />
						Clear Filters
					</Button>
				)}
			</div>

			{/* Active filters display */}
			{hasActiveFilters && (
				<div className="flex flex-wrap items-center gap-2">
					<span className="text-sm text-muted-foreground flex items-center">
						<Filter className="mr-1 h-3 w-3" /> Active filters:
					</span>

					{searchQuery && (
						<Badge variant="secondary" className="text-xs">
							Search: {searchQuery}
						</Badge>
					)}

					{typeFilter !== "all" && (
						<Badge variant="secondary" className="text-xs">
							Type: {typeFilter}
						</Badge>
					)}
				</div>
			)}

			<LogsLevelTabs
				value={activeTab}
				onValueChange={handleTypeChange}
				listClassName={`grid ${getGridColsClass(1 + (logTypes?.length || 3))}`}
				availableLevels={logTypes}
			/>

			{/* Logs table */}
			<Card className="overflow-hidden p-0">
				<Table>
					<LogsTableHeader headers={["Time", "Type", "Message"]} />
					<TableBody>
						{isLoading ? (
							<LogsTableSkeleton cellWidths={["w-24", "w-16", "w-full"]} />
						) : logs.length === 0 ? (
							<EmptyLogsTableRow colSpan={4} />
						) : (
							logs.map((log, index) => {
								const prevLog = index > 0 ? logs[index - 1] : null;
								const logType = getLogType(log);
								const shouldTimeBeShown = shouldShowGroupedLogValue({
									index,
									current: log,
									previous: prevLog,
									thresholdSeconds: 10,
									getCreatedAt: (currentLog) => currentLog.created_at,
								});
								const shouldTypeBeShown = shouldShowGroupedLogValue({
									index,
									current: log,
									previous: prevLog,
									thresholdSeconds: 10,
									getCreatedAt: (currentLog) => currentLog.created_at,
									getValue: getLogType,
								});
								const typeColorClass = getLogTypeColorClass(logType);

								return (
									<TableRow key={log.id}>
										<TableCell className="px-4 py-3 text-sm">
											{shouldTimeBeShown ? formatDate(log.created_at) : ""}
										</TableCell>
										<TableCell className="px-4 py-3">
											{shouldTypeBeShown ? (
												<Badge variant="outline" className={typeColorClass}>
													{logType}
												</Badge>
											) : (
												""
											)}
										</TableCell>
										<TableCell className="px-4 py-3 text-sm">
											{(() => {
												interface subLogType {
													creation_timestamp: number;
													device_status_stamp: {
														wifi_rssi_level: number;
														wifi_status: string;
														refresh_rate: number;
														time_since_last_sleep_start: number;
														current_fw_version: string;
														special_function: string;
														battery_voltage: number;
														wakeup_reason: string;
														free_heap_size: number;
													};
													log_id: number;
													log_message: string;
													log_codeline: number;
													log_sourcefile: string;
													additional_info?: {
														retry_attempt: number;
													};
													timestamp: string;
												}
												interface subLogTypeII {
													logs_array: subLogType[];
												}
												try {
													const logData: subLogType | subLogTypeII = JSON.parse(
														log.log_data,
													);

													// Define DeviceStatusStamp component
													const DeviceStatusStamp = ({
														deviceStatusStamp,
														logMessage,
														logCodeline,
														logSourcefile,
														timestamp,
													}: {
														deviceStatusStamp:
															| subLogType["device_status_stamp"]
															| undefined;
														logMessage: string;
														logCodeline: number;
														logSourcefile: string;
														timestamp: string;
													}) => {
														// Add null check before destructuring
														if (!deviceStatusStamp) {
															// Return a simplified version when device status is not available
															return (
																<div className="flex flex-col gap-2 py-1">
																	{/* Log Message with Prefix */}
																	<div className="flex items-start gap-2 pl-1 text-xs font-mono">
																		{/* Source Info Prefix */}
																		<FileCode className="h-3.5 w-3.5" />
																		<span>
																			[{logSourcefile}:{logCodeline}]
																		</span>
																		<Clock className="h-3.5 w-3.5 ml-1" />
																		<span>
																			{
																				new Date(timestamp)
																					.toISOString()
																					.split("T")[1]
																					.split(".")[0]
																			}
																		</span>
																		{/* Log Message */}
																		<span className="break-words flex items-center gap-1">
																			{logMessage
																				.toLowerCase()
																				.includes("error") && (
																				<AlertTriangle className="inline h-3.5 w-3.5 text-red-500 mr-1" />
																			)}
																			{logMessage}
																		</span>
																	</div>
																</div>
															);
														}

														const {
															wifi_rssi_level,
															wifi_status,
															battery_voltage,
															refresh_rate,
															free_heap_size,
															current_fw_version,
															wakeup_reason,
															time_since_last_sleep_start,
														} = deviceStatusStamp;

														// Determine log type for prefix color
														const logType = logMessage
															.toLowerCase()
															.includes("error")
															? "error"
															: logMessage.toLowerCase().includes("warn")
																? "warning"
																: "info";

														return (
															<div className="flex flex-col gap-2 py-1">
																{/* Status Icons Row */}
																<div className="flex flex-wrap items-center gap-3 text-xs">
																	{/* WiFi Signal */}
																	<div
																		className="flex items-center gap-1 bg-blue-400/10 px-2 py-1 rounded-md"
																		title="WiFi Signal"
																	>
																		{wifi_status === "connected" && (
																			<Wifi className="h-3.5 w-3.5 text-primary" />
																		)}
																		{wifi_status === "disconnected" && (
																			<WifiOff className="h-3.5 w-3.5 text-red-500" />
																		)}
																		<span>{wifi_rssi_level || "N/A"} dBm</span>
																	</div>

																	{/* Battery */}
																	<div
																		className="flex items-center gap-1 bg-green-400/10 px-2 py-1 rounded-md"
																		title="Battery Voltage"
																	>
																		<BatteryCharging className="h-3.5 w-3.5 text-green-500" />
																		<span>
																			{battery_voltage
																				? battery_voltage.toFixed(2)
																				: "N/A"}{" "}
																			V
																		</span>
																	</div>

																	{/* Refresh Rate */}
																	{refresh_rate !== undefined && (
																		<div
																			className="flex items-center gap-1 bg-purple-400/10 px-2 py-1 rounded-md"
																			title="Refresh Rate"
																		>
																			<RefreshCw className="h-3.5 w-3.5 text-purple-500" />
																			<span>{refresh_rate} s</span>
																		</div>
																	)}

																	{/* Free Heap Size */}
																	{free_heap_size !== undefined && (
																		<div
																			className="flex items-center gap-1 bg-cyan-400/10 px-2 py-1 rounded-md"
																			title="Free Heap Size"
																		>
																			<Cpu className="h-3.5 w-3.5 text-cyan-500" />
																			<span>{free_heap_size} B</span>
																		</div>
																	)}

																	{/* Firmware Version */}
																	{current_fw_version && (
																		<div
																			className="flex items-center gap-1 bg-gray-400/10 px-2 py-1 rounded-md"
																			title="Firmware Version"
																		>
																			<HardDrive className="h-3.5 w-3.5 text-gray-500" />
																			<span>v{current_fw_version}</span>
																		</div>
																	)}

																	{/* Wakeup Reason */}
																	{wakeup_reason && (
																		<div
																			className="flex items-center gap-1 bg-amber-400/10 px-2 py-1 rounded-md"
																			title="Wakeup Reason"
																		>
																			<Coffee className="h-3.5 w-3.5 text-amber-500" />
																			<span>{wakeup_reason}</span>
																		</div>
																	)}

																	{/* Time Since Last Sleep */}
																	{time_since_last_sleep_start !==
																		undefined && (
																		<div
																			className="flex items-center gap-1 bg-indigo-400/10 px-2 py-1 rounded-md"
																			title="Time Since Last Sleep"
																		>
																			<Timer className="h-3.5 w-3.5 text-indigo-500" />
																			<span>
																				{time_since_last_sleep_start}s
																			</span>
																		</div>
																	)}
																</div>

																{/* Log Message with Prefix */}
																<div className="flex items-start gap-2 pl-1 text-xs font-mono ">
																	{/* Source Info Prefix */}
																	<FileCode className="h-3.5 w-3.5" />
																	<span>
																		[{logSourcefile}:{logCodeline}]
																	</span>
																	<Clock className="h-3.5 w-3.5 ml-1" />
																	<span>
																		{
																			new Date(timestamp)
																				.toISOString()
																				.split("T")[1]
																				.split(".")[0]
																		}
																	</span>
																	{/* Log Message */}
																	<span className="break-words flex items-center gap-1">
																		{logType === "error" && (
																			<AlertTriangle className="inline h-3.5 w-3.5 text-red-500 mr-1" />
																		)}
																		{logMessage}
																	</span>
																</div>
															</div>
														);
													};

													// Check if it's a single log or an array of logs
													if (Array.isArray(logData)) {
														return logData.map(
															(subLog: subLogType, subIndex: number) => (
																<DeviceStatusStamp
																	key={`${log.id}-${subIndex}`}
																	deviceStatusStamp={
																		subLog?.device_status_stamp
																	}
																	logMessage={
																		subLog?.log_message || "No message"
																	}
																	logCodeline={subLog?.log_codeline || 0}
																	logSourcefile={
																		subLog?.log_sourcefile || "unknown"
																	}
																	timestamp={
																		subLog?.timestamp ||
																		new Date().toISOString()
																	}
																/>
															),
														);
													}
													if (
														"logs_array" in logData &&
														Array.isArray(logData.logs_array)
													) {
														return logData.logs_array.map(
															(subLog: subLogType, subIndex: number) => (
																<DeviceStatusStamp
																	key={`${log.id}-${subIndex}`}
																	deviceStatusStamp={
																		subLog?.device_status_stamp
																	}
																	logMessage={
																		subLog?.log_message || "No message"
																	}
																	logCodeline={subLog?.log_codeline || 0}
																	logSourcefile={
																		subLog?.log_sourcefile || "unknown"
																	}
																	timestamp={
																		subLog?.timestamp ||
																		new Date().toISOString()
																	}
																/>
															),
														);
													}
													if ("log_message" in logData) {
														// Handle case where logData is a single log entry but not in an array
														return (
															<DeviceStatusStamp
																deviceStatusStamp={logData?.device_status_stamp}
																logMessage={
																	logData?.log_message || "No message"
																}
																logCodeline={logData?.log_codeline || 0}
																logSourcefile={
																	logData?.log_sourcefile || "unknown"
																}
																timestamp={
																	logData?.timestamp || new Date().toISOString()
																}
															/>
														);
													}
													// If we can't determine the structure, just show the raw data
													return (
														<div className="max-w-[500px] truncate">
															{log.log_data}
														</div>
													);
												} catch (error) {
													console.log(
														"Failed to parse log data as JSON, fallback to plain string",
														error,
													);
													return (
														<div className="max-w-[500px] truncate">
															{log.log_data}
														</div>
													);
												}
											})()}
										</TableCell>
									</TableRow>
								);
							})
						)}
					</TableBody>
				</Table>
			</Card>

			{/* Pagination */}
			{!isLoading && logs.length > 0 && (
				<LogsPagination
					page={page}
					perPage={ITEMS_PER_PAGE}
					totalLogs={totalLogs}
					onPageChange={handlePageChange}
				/>
			)}
		</div>
	);
}
