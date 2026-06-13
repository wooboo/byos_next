"use client";

import {
	AlertCircle,
	Check,
	ChevronDown,
	Code,
	Copy,
	Loader2,
	Play,
	RefreshCw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import {
	executeSqlStatements,
	type SqlExecutionState,
	type SqlExecutionStatus,
} from "@/app/actions/execute-sql";
import { SQL_STATEMENTS } from "@/lib/database/sql-statements";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

type SqlStatementKey = keyof typeof SQL_STATEMENTS;
type SqlStatement = (typeof SQL_STATEMENTS)[SqlStatementKey];

const STATUS_COLORS: Record<SqlExecutionStatus, string> = {
	error: "text-destructive",
	idle: "text-muted-foreground",
	loading: "text-primary",
	success: "text-emerald-600 dark:text-emerald-400",
	warning: "text-amber-600 dark:text-amber-400",
};

function getStatusText(status: SqlExecutionStatus) {
	const statusTextByStatus: Partial<Record<SqlExecutionStatus, string>> = {
		loading: "running...",
		success: "succeeded!",
		warning: "warning!",
		error: "failed!",
	};

	return statusTextByStatus[status] ?? "";
}

function getTitleWithStatus(title: string, status: SqlExecutionStatus) {
	const statusText = getStatusText(status);

	return `-- ${title}${statusText ? ` (${statusText})` : ""}`;
}

function getStatusColor(status: SqlExecutionStatus) {
	return STATUS_COLORS[status];
}

function StatusIcon({ status }: { status: SqlExecutionStatus }) {
	const icons: Partial<Record<SqlExecutionStatus, ReactNode>> = {
		error: <AlertCircle className="h-3 w-3" />,
		loading: <Loader2 className="h-3 w-3 animate-spin" />,
		success: <Check className="h-3 w-3" />,
		warning: <AlertCircle className="h-3 w-3" />,
	};

	return icons[status] ?? null;
}

function getSqlStatuses(executionState: SqlExecutionState | null) {
	return executionState
		? Object.values(executionState).map((item) => item.status)
		: [];
}

function allStatementsSucceeded(executionState: SqlExecutionState | null) {
	const statuses = getSqlStatuses(executionState);
	const noLoading = !statuses.some((status) => status === "loading");

	return (
		statuses.length > 0 &&
		noLoading &&
		statuses.every((status) => status === "success" || status === "warning")
	);
}

function createInitialExecutionState() {
	return Object.keys(SQL_STATEMENTS).reduce((acc, key) => {
		acc[key as SqlStatementKey] = {
			status: "loading",
			result: [],
			notices: [],
		};
		return acc;
	}, {} as SqlExecutionState);
}

function formatJsonAsSqlComment(value: unknown) {
	return `-- ${JSON.stringify(value, null, 2).replace(/\n/g, "\n-- ")}\n`;
}

function getEmptyResultSql() {
	return "-- Empty result (query executed successfully but returned no data)\n";
}

function getResultRowsSql(
	execution: SqlExecutionState[SqlStatementKey] | undefined,
) {
	if (!execution?.result || execution.result.length === 0)
		return getEmptyResultSql();

	return formatJsonAsSqlComment(execution.result);
}

function getWarningSql(error: string) {
	return [
		`-- WARNING: ${error}`,
		"-- (This warning was non-fatal and execution continued)",
		"",
	].join("\n");
}

function getFinishedResultSql(
	status: SqlExecutionStatus,
	execution: SqlExecutionState[SqlStatementKey] | undefined,
) {
	if (execution?.error) {
		return status === "warning"
			? getWarningSql(execution.error)
			: `-- ERROR: ${execution.error}\n`;
	}

	return getResultRowsSql(execution);
}

function getExecutionResultSql(
	status: SqlExecutionStatus,
	execution: SqlExecutionState[SqlStatementKey] | undefined,
) {
	if (status === "loading") return "-- Executing...\n";

	return getFinishedResultSql(status, execution);
}

function getExecutionNoticesSql(
	execution: SqlExecutionState[SqlStatementKey] | undefined,
) {
	if (!execution?.notices || execution.notices.length === 0) return "";

	return `\n-- Database Notices:\n${formatJsonAsSqlComment(execution.notices)}`;
}

function getStatementBaseSql(item: SqlStatement, status: SqlExecutionStatus) {
	return `${getTitleWithStatus(item.title, status)}\n-- ${item.description}\n${item.sql}`;
}

function getExecutionTimeSql(
	execution: SqlExecutionState[SqlStatementKey] | undefined,
) {
	return execution?.executionTime ? `(${execution.executionTime}ms)` : "";
}

function getExecutionAppendixSql(
	status: SqlExecutionStatus,
	execution: SqlExecutionState[SqlStatementKey] | undefined,
) {
	if (status === "idle") return "";
	if (status === "loading") return "\n\n-- Executing...\n";

	const executionTime = getExecutionTimeSql(execution);
	const resultSql = getExecutionResultSql(status, execution);
	const noticesSql = getExecutionNoticesSql(execution);

	return `\n\n-- Result: ${executionTime}\n${resultSql}${noticesSql}`;
}

function generateCompleteSql(
	key: string,
	item: SqlStatement,
	executionState: SqlExecutionState | null,
) {
	const execution = executionState?.[key as SqlStatementKey];
	const status = execution?.status || "idle";

	return `${getStatementBaseSql(item, status)}${getExecutionAppendixSql(status, execution)}`;
}

function getAllSql(executionState: SqlExecutionState | null) {
	return Object.entries(SQL_STATEMENTS)
		.map(([key, item]) => generateCompleteSql(key, item, executionState))
		.join("\n\n");
}

async function writeClipboardFallback(text: string) {
	const textArea = document.createElement("textarea");
	textArea.value = text;
	textArea.style.position = "fixed"; // Avoid scrolling to bottom
	document.body.appendChild(textArea);
	textArea.focus();
	textArea.select();

	try {
		return document.execCommand("copy");
	} finally {
		document.body.removeChild(textArea);
	}
}

async function writeClipboardText(text: string) {
	if (navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(text);
		return true;
	}

	return writeClipboardFallback(text);
}

function getExecutionCounts(executionState: SqlExecutionState) {
	const statuses = getSqlStatuses(executionState);

	return {
		errorCount: statuses.filter((status) => status === "error").length,
		loadingCount: statuses.filter((status) => status === "loading").length,
		successCount: statuses.filter((status) => status === "success").length,
		warningCount: statuses.filter((status) => status === "warning").length,
	};
}

function LoadingExecutionSummary() {
	return (
		<div className="flex items-center gap-1 text-primary">
			<Loader2 className="h-3 w-3 animate-spin" />
			<span>Executing statements...</span>
		</div>
	);
}

function SummaryCountItems({
	errorCount,
	successCount,
	warningCount,
}: {
	errorCount: number;
	successCount: number;
	warningCount: number;
}) {
	return (
		<div className="flex items-center gap-3">
			{successCount > 0 && (
				<div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
					<Check className="h-3 w-3" />
					<span>{successCount} succeeded</span>
				</div>
			)}
			{warningCount > 0 && (
				<div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
					<AlertCircle className="h-3 w-3" />
					<span>{warningCount} warnings</span>
				</div>
			)}
			{errorCount > 0 && (
				<div className="flex items-center gap-1 text-destructive">
					<AlertCircle className="h-3 w-3" />
					<span>{errorCount} failed</span>
				</div>
			)}
		</div>
	);
}

function SummaryCompletionMessage({ allSucceeded }: { allSucceeded: boolean }) {
	return (
		<div
			className={`text-sm mt-1 ${allSucceeded ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}
		>
			{allSucceeded
				? "All database operations completed successfully. You can refresh the page to apply changes."
				: "Some operations failed. Please check the errors and try again."}
		</div>
	);
}

function ExecutionSummary({
	executionState,
}: {
	executionState: SqlExecutionState | null;
}) {
	if (!executionState) return null;

	const { errorCount, loadingCount, successCount, warningCount } =
		getExecutionCounts(executionState);

	if (loadingCount > 0) return <LoadingExecutionSummary />;

	if (successCount === 0 && errorCount === 0 && warningCount === 0) {
		return null;
	}

	const allSucceeded = allStatementsSucceeded(executionState);

	return (
		<div className="flex flex-col">
			<SummaryCountItems
				errorCount={errorCount}
				successCount={successCount}
				warningCount={warningCount}
			/>
			<SummaryCompletionMessage allSucceeded={allSucceeded} />
		</div>
	);
}

function JsonSqlCommentLines({ value }: { value: unknown }) {
	return JSON.stringify(value, null, 2)
		.split("\n")
		.map((line, i) => (
			<div key={i} className="text-foreground/70">{`-- ${line}`}</div>
		));
}

function WarningStatementResult({ error }: { error: string }) {
	return (
		<div>
			<div className="text-amber-600 dark:text-amber-400">{`-- WARNING: ${error}`}</div>
			<div className="text-amber-600 dark:text-amber-400">
				-- (This warning was non-fatal and execution continued)
			</div>
		</div>
	);
}

function ErrorStatementResult({ error }: { error: string }) {
	return <div className="text-destructive">{`-- ERROR: ${error}`}</div>;
}

function StatementRows({
	execution,
}: {
	execution: SqlExecutionState[SqlStatementKey] | undefined;
}) {
	if (execution?.result && execution.result.length > 0) {
		return <JsonSqlCommentLines value={execution.result} />;
	}

	return (
		<div className="text-foreground/70">
			-- Empty result (query executed successfully but returned no data)
		</div>
	);
}

function StatementResultBody({
	execution,
	status,
}: {
	status: SqlExecutionStatus;
	execution: SqlExecutionState[SqlStatementKey] | undefined;
}) {
	if (!execution?.error) return <StatementRows execution={execution} />;

	if (status === "warning")
		return <WarningStatementResult error={execution.error} />;

	return <ErrorStatementResult error={execution.error} />;
}

function StatementResult({
	status,
	execution,
}: {
	status: SqlExecutionStatus;
	execution: SqlExecutionState[SqlStatementKey] | undefined;
}) {
	if (status === "loading") return null;

	return (
		<div className="whitespace-pre-wrap">
			<StatementResultBody status={status} execution={execution} />
		</div>
	);
}

function StatementNotices({
	status,
	execution,
}: {
	status: SqlExecutionStatus;
	execution: SqlExecutionState[SqlStatementKey] | undefined;
}) {
	if (
		!execution?.notices ||
		execution.notices.length === 0 ||
		status === "loading"
	) {
		return null;
	}

	return (
		<div className="mt-2">
			<div>{"-- Database Notices:"}</div>
			<div className="whitespace-pre-wrap">
				<JsonSqlCommentLines value={execution.notices} />
			</div>
		</div>
	);
}

function StatementExecutionDetails({
	status,
	execution,
}: {
	status: SqlExecutionStatus;
	execution: SqlExecutionState[SqlStatementKey] | undefined;
}) {
	if (status === "idle") return null;

	return (
		<div className={`my-2 ${getStatusColor(status)}`}>
			<div className="flex items-center gap-1">
				<span>{`-- Result${
					execution?.executionTime && status === "success"
						? `: (${execution.executionTime}ms)`
						: status === "loading"
							? ": Executing..."
							: ":"
				}`}</span>
			</div>

			<StatementResult status={status} execution={execution} />
			<StatementNotices status={status} execution={execution} />
		</div>
	);
}

function CopyStatementButton({
	copied,
	copyAnimation,
	item,
	onCopy,
	statementSql,
	statementKey,
}: {
	copied: string | null;
	copyAnimation: string | null;
	item: SqlStatement;
	onCopy: (text: string, id: string) => void;
	statementSql: string;
	statementKey: string;
}) {
	return (
		<button
			type="button"
			onClick={() => onCopy(statementSql, statementKey)}
			className={`bg-secondary hover:bg-secondary/80 text-secondary-foreground border rounded px-2 py-1 text-xs flex items-center gap-1 touch-action-manipulation min-h-[28px] min-w-[60px] justify-center shadow-sm ${copyAnimation === statementKey ? "animate-pulse" : ""}`}
			aria-label={`Copy ${item.title} SQL statement`}
			tabIndex={0}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onCopy(statementSql, statementKey);
				}
			}}
		>
			{copied === statementKey ? (
				<Check className="h-3 w-3" />
			) : (
				<Copy className="h-3 w-3" />
			)}
			{copied === statementKey ? "Copied" : "Copy"}
		</button>
	);
}

function SqlStatementBlock({
	copied,
	copyAnimation,
	executionState,
	index,
	item,
	onCopy,
	statementKey,
	statementTotal,
}: {
	copied: string | null;
	copyAnimation: string | null;
	executionState: SqlExecutionState | null;
	index: number;
	item: SqlStatement;
	onCopy: (text: string, id: string) => void;
	statementKey: string;
	statementTotal: number;
}) {
	const execution = executionState?.[statementKey as SqlStatementKey];
	const status = execution?.status || "idle";
	const statementSql = generateCompleteSql(statementKey, item, executionState);

	return (
		<div key={statementKey} className="relative group">
			<div className="absolute right-0 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity">
				<CopyStatementButton
					copied={copied}
					copyAnimation={copyAnimation}
					item={item}
					onCopy={onCopy}
					statementSql={statementSql}
					statementKey={statementKey}
				/>
			</div>

			<div className={`flex items-center gap-1 ${getStatusColor(status)}`}>
				<StatusIcon status={status} />
				<span>{getTitleWithStatus(item.title, status)}</span>
			</div>

			<div className="text-muted-foreground">{`-- ${item.description}`}</div>
			<div className="my-2">{item.sql}</div>
			<StatementExecutionDetails status={status} execution={execution} />

			{index < statementTotal - 1 && <div className="border-b my-4" />}
		</div>
	);
}

function SqlStatementsList({
	copied,
	copyAnimation,
	executionState,
	onCopy,
}: {
	copied: string | null;
	copyAnimation: string | null;
	executionState: SqlExecutionState | null;
	onCopy: (text: string, id: string) => void;
}) {
	const statements = Object.entries(SQL_STATEMENTS);

	return statements.map(([key, item], index) => (
		<SqlStatementBlock
			key={key}
			copied={copied}
			copyAnimation={copyAnimation}
			executionState={executionState}
			index={index}
			item={item}
			onCopy={onCopy}
			statementKey={key}
			statementTotal={statements.length}
		/>
	));
}

function useClipboardCopy() {
	const [copied, setCopied] = useState<string | null>(null);
	const [copyError, setCopyError] = useState<string | null>(null);
	const [copyAnimation, setCopyAnimation] = useState<string | null>(null);

	const clearCopyFeedback = () => {
		setCopied(null);
		setCopyError(null);
	};

	const showCopySuccess = (id: string) => {
		setCopied(id);
		setCopyError(null);
		setCopyAnimation(id);
		setTimeout(() => setCopyAnimation(null), 500);
		setTimeout(() => setCopied(null), 2000);
	};

	const copyToClipboard = async (text: string, id: string) => {
		try {
			const successful = await writeClipboardText(text);
			if (successful) {
				showCopySuccess(id);
			} else {
				setCopyError("Failed to copy");
				setTimeout(clearCopyFeedback, 2000);
			}
		} catch (err) {
			console.error("Copy failed:", err);
			setCopyError("Copy failed");
			setTimeout(() => setCopyError(null), 2000);
		}
	};

	return {
		copied,
		copyAnimation,
		copyError,
		copyToClipboard,
	};
}

function InitializerActions({
	allSucceeded,
	connectionUrl,
	isPending,
	onExecute,
	onRefresh,
}: {
	allSucceeded: boolean;
	connectionUrl?: string;
	isPending: boolean;
	onExecute: () => void;
	onRefresh: () => void;
}) {
	if (!connectionUrl) return null;

	return (
		<div className="flex flex-wrap items-center gap-3 mb-4">
			<Button
				type="button"
				onClick={onExecute}
				disabled={isPending || allSucceeded}
				size="default"
			>
				{isPending ? (
					<Loader2 className="h-4 w-4 animate-spin" />
				) : (
					<Play className="h-4 w-4" />
				)}
				{isPending ? "Initializing…" : "Initialize database"}
			</Button>

			{allSucceeded && (
				<Button
					type="button"
					onClick={onRefresh}
					variant="outline"
					className="border-emerald-600/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-600/10"
				>
					<RefreshCw className="h-4 w-4 mr-1" />
					Refresh to apply
				</Button>
			)}
		</div>
	);
}

function CopyAllButton({
	allSql,
	copied,
	copyAnimation,
	onCopy,
}: {
	allSql: string;
	copied: string | null;
	copyAnimation: string | null;
	onCopy: (text: string, id: string) => void;
}) {
	const isCopied = copied === "all";

	return (
		<Button
			type="button"
			variant="secondary"
			size="sm"
			onClick={() => onCopy(allSql, "all")}
			className={`h-7 px-2 text-xs ${copyAnimation === "all" ? "animate-pulse" : ""}`}
			aria-label="Copy all SQL statements"
		>
			{isCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
			{isCopied ? "Copied" : "Copy all"}
		</Button>
	);
}

function SqlPanelHeader({
	allSql,
	connectionUrl,
	copied,
	copyAnimation,
	executionState,
	onCopy,
}: {
	allSql: string;
	connectionUrl?: string;
	copied: string | null;
	copyAnimation: string | null;
	executionState: SqlExecutionState | null;
	onCopy: (text: string, id: string) => void;
}) {
	return (
		<div className="flex items-center justify-between p-2 border-b bg-muted/60">
			<div className="flex items-center gap-2 px-2 py-1 rounded min-w-0 flex-1">
				<Code className="h-4 w-4 text-muted-foreground shrink-0" />
				<span className="font-medium min-w-0 flex-1">
					{connectionUrl ? (
						<Input
							className="w-full max-w-2xl font-mono text-xs"
							value={connectionUrl}
							readOnly
						/>
					) : (
						"Database initialization SQL"
					)}
				</span>
				<ExecutionSummary executionState={executionState} />
			</div>

			<div className="flex gap-2 shrink-0">
				<CopyAllButton
					allSql={allSql}
					copied={copied}
					copyAnimation={copyAnimation}
					onCopy={onCopy}
				/>
			</div>
		</div>
	);
}

function CopyErrorNotice({ copyError }: { copyError: string | null }) {
	if (!copyError) return null;

	return (
		<div className="bg-destructive/10 text-destructive text-xs p-2 flex items-center justify-center border-b border-destructive/20">
			<AlertCircle className="h-3 w-3 mr-1" />
			{copyError}
		</div>
	);
}

function SqlContent({
	copied,
	copyAnimation,
	executionState,
	isExpanded,
	onCopy,
}: {
	copied: string | null;
	copyAnimation: string | null;
	executionState: SqlExecutionState | null;
	isExpanded: boolean;
	onCopy: (text: string, id: string) => void;
}) {
	return (
		<div
			className={`sql-content-container ${isExpanded ? "expanded" : ""}`}
			style={{
				display: "grid",
				gridTemplateRows: isExpanded ? "1fr" : "0fr",
				transition: "grid-template-rows 0.3s ease-in-out",
				overflow: "hidden",
			}}
		>
			<div className="sql-content min-h-[200px] overflow-hidden transition-all duration-300 ease-in-out">
				<pre className="overflow-auto p-4">
					<code>
						<SqlStatementsList
							copied={copied}
							copyAnimation={copyAnimation}
							executionState={executionState}
							onCopy={onCopy}
						/>
					</code>
				</pre>
			</div>
		</div>
	);
}

function ExpandToggle({
	isExpanded,
	onToggle,
}: {
	isExpanded: boolean;
	onToggle: () => void;
}) {
	return (
		<div
			className={`${!isExpanded ? "absolute inset-0 mt-0 mb-0" : "relative mt-2 mb-2"} flex justify-center transition-all duration-300 ease-in-out`}
		>
			{!isExpanded && (
				<div className="w-full h-full bg-gradient-to-t from-muted/40 to-transparent pointer-events-none absolute" />
			)}
			<button
				type="button"
				onClick={onToggle}
				className={`${!isExpanded ? "absolute bottom-4 pointer-events-auto h-[1.5lh]" : ""} bg-background hover:bg-accent text-foreground border rounded-full px-4 py-1 text-xs flex items-center gap-1 shadow-sm`}
			>
				<ChevronDown
					className={`h-3 w-3 transform transition-transform ${isExpanded ? "rotate-180" : "rotate-0"}`}
				/>
				<span>{isExpanded ? "Show less" : "Show more"}</span>
			</button>
		</div>
	);
}

function SqlPanel({
	allSql,
	connectionUrl,
	copied,
	copyAnimation,
	copyError,
	executionState,
	isExpanded,
	onCopy,
	onToggleExpanded,
}: {
	allSql: string;
	connectionUrl?: string;
	copied: string | null;
	copyAnimation: string | null;
	copyError: string | null;
	executionState: SqlExecutionState | null;
	isExpanded: boolean;
	onCopy: (text: string, id: string) => void;
	onToggleExpanded: () => void;
}) {
	return (
		<div className="font-mono text-sm relative border rounded-md overflow-hidden bg-muted/30">
			<SqlPanelHeader
				allSql={allSql}
				connectionUrl={connectionUrl}
				copied={copied}
				copyAnimation={copyAnimation}
				executionState={executionState}
				onCopy={onCopy}
			/>
			<CopyErrorNotice copyError={copyError} />
			<SqlContent
				copied={copied}
				copyAnimation={copyAnimation}
				executionState={executionState}
				isExpanded={isExpanded}
				onCopy={onCopy}
			/>
			<ExpandToggle isExpanded={isExpanded} onToggle={onToggleExpanded} />
		</div>
	);
}

export function DbInitializer({ connectionUrl }: { connectionUrl?: string }) {
	const [isPending, startTransition] = useTransition();
	const [executionState, setExecutionState] =
		useState<SqlExecutionState | null>(null);
	const [isExpanded, setIsExpanded] = useState(false);
	const { copied, copyAnimation, copyError, copyToClipboard } =
		useClipboardCopy();
	const router = useRouter();

	const executeAll = () => {
		if (!connectionUrl) return;

		setExecutionState(createInitialExecutionState());
		setIsExpanded(true);

		startTransition(async () => {
			const result = await executeSqlStatements();
			setExecutionState(result);
		});
	};

	const allSucceeded = allStatementsSucceeded(executionState);
	const allSql = getAllSql(executionState);

	return (
		<div className="p-6">
			<InitializerActions
				allSucceeded={allSucceeded}
				connectionUrl={connectionUrl}
				isPending={isPending}
				onExecute={executeAll}
				onRefresh={() => router.refresh()}
			/>
			<SqlPanel
				allSql={allSql}
				connectionUrl={connectionUrl}
				copied={copied}
				copyAnimation={copyAnimation}
				copyError={copyError}
				executionState={executionState}
				isExpanded={isExpanded}
				onCopy={copyToClipboard}
				onToggleExpanded={() => setIsExpanded(!isExpanded)}
			/>
		</div>
	);
}
