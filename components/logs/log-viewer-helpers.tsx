"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type React from "react";
import { useCallback, useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchWithDebounce } from "@/hooks/useSearchWithDebounce";

type UseLogsUrlStateOptions = {
	paramPrefix: string;
	preserveActiveTab?: boolean;
};

export function useLogsUrlState({
	paramPrefix,
	preserveActiveTab = false,
}: UseLogsUrlStateOptions) {
	const router = useRouter();
	const pathname = usePathname() ?? "/";
	const searchParams = useSearchParams();
	const scrollRef = useRef<HTMLDivElement>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const page = Number(searchParams?.get(`${paramPrefix}page`) || "1");
	const searchQuery = searchParams?.get(`${paramPrefix}search`) || "";

	const createQueryString = useCallback(
		(params: Record<string, string | number | null>) => {
			const newSearchParams = new URLSearchParams(searchParams?.toString());
			const activeTab = preserveActiveTab
				? newSearchParams.get("activeTab")
				: null;

			for (const [key, value] of Object.entries(params)) {
				const prefixedKey = key === "activeTab" ? key : `${paramPrefix}${key}`;

				if (value === null) {
					newSearchParams.delete(prefixedKey);
				} else {
					newSearchParams.set(prefixedKey, String(value));
				}
			}

			if (activeTab) {
				newSearchParams.set("activeTab", activeTab);
			}

			return newSearchParams.toString();
		},
		[searchParams, paramPrefix, preserveActiveTab],
	);

	const debouncedSearch = useSearchWithDebounce(
		searchQuery,
		page,
		createQueryString,
		pathname,
		router,
	);

	const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		debouncedSearch(e.target.value);
	};

	const handlePageChange = (newPage: number) => {
		const queryString = createQueryString({ page: newPage });
		router.push(`${pathname}?${queryString}`, { scroll: false });
	};

	const clearFilters = () => {
		router.push(pathname, { scroll: false });
		if (searchInputRef.current) {
			searchInputRef.current.value = "";
		}
	};

	return {
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
	};
}

export function useScrollIntoViewAfterLoad(
	scrollRef: React.RefObject<HTMLDivElement | null>,
	isLoading: boolean,
) {
	useEffect(() => {
		if (scrollRef.current && !isLoading) {
			scrollRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
		}
	}, [scrollRef, isLoading]);
}

function secondsBetween(
	currentDate: string | null | undefined,
	previousDate: string | null | undefined,
) {
	return (
		Math.abs(
			new Date(currentDate || "").getTime() -
				new Date(previousDate || "").getTime(),
		) / 1000
	);
}

type GroupedValueOptions<T> = {
	index: number;
	current: T;
	previous: T | null;
	thresholdSeconds: number;
	getCreatedAt: (log: T) => string | null | undefined;
	getValue?: (log: T) => string | undefined;
};

export function shouldShowGroupedLogValue<T>({
	index,
	current,
	previous,
	thresholdSeconds,
	getCreatedAt,
	getValue,
}: GroupedValueOptions<T>) {
	if (index === 0) return true;
	if (!previous) return false;
	if (getValue && getValue(previous) !== getValue(current)) return true;

	return (
		secondsBetween(getCreatedAt(current), getCreatedAt(previous)) >=
		thresholdSeconds
	);
}

type LogsTableSkeletonProps = {
	cellWidths: string[];
};

export function LogsTableSkeleton({ cellWidths }: LogsTableSkeletonProps) {
	return Array.from({ length: 5 }).map((_, i) => (
		<TableRow key={i}>
			{cellWidths.map((width, cellIndex) => (
				<TableCell key={`${i}-${cellIndex}`} className="px-4 py-3">
					<Skeleton className={`h-4 ${width}`} />
				</TableCell>
			))}
		</TableRow>
	));
}

export function EmptyLogsTableRow({ colSpan }: { colSpan: number }) {
	return (
		<TableRow>
			<TableCell
				colSpan={colSpan}
				className="px-4 py-8 text-center text-muted-foreground"
			>
				No logs found matching your criteria
			</TableCell>
		</TableRow>
	);
}

const LOG_LEVEL_TABS = [
	{ value: "all", label: "All" },
	{ value: "error", label: "Error", className: "text-red-500" },
	{ value: "warning", label: "Warning", className: "text-amber-500" },
	{ value: "info", label: "Info", className: "text-primary" },
	{ value: "debug", label: "Debug", className: "text-gray-500" },
];

type LogsLevelTabsProps = {
	value: string;
	onValueChange: (value: string) => void;
	listClassName: string;
	availableLevels?: string[];
	includeDebug?: boolean;
};

export function LogsLevelTabs({
	value,
	onValueChange,
	listClassName,
	availableLevels,
	includeDebug = false,
}: LogsLevelTabsProps) {
	const tabs = LOG_LEVEL_TABS.filter((tab) => {
		if (tab.value === "all") return true;
		if (tab.value === "debug") return includeDebug;
		return availableLevels ? availableLevels.includes(tab.value) : true;
	});

	return (
		<Tabs value={value} onValueChange={onValueChange}>
			<TabsList className={listClassName}>
				{tabs.map((tab) => (
					<TabsTrigger
						key={tab.value}
						value={tab.value}
						className={tab.className}
					>
						{tab.label}
					</TabsTrigger>
				))}
			</TabsList>
		</Tabs>
	);
}

export function LogsTableHeader({ headers }: { headers: string[] }) {
	return (
		<TableHeader>
			<TableRow className="bg-muted/50">
				{headers.map((header) => (
					<TableHead key={header} className="px-4 py-3">
						{header}
					</TableHead>
				))}
			</TableRow>
		</TableHeader>
	);
}
