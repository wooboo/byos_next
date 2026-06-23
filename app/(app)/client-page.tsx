"use client";

import { AlertTriangle, ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { DeviceFrame } from "@/components/common/device-frame";
import { StatusIndicator } from "@/components/common/status-indicator";
import { ScaledReactPreview } from "@/components/preview/scaled-react-preview";
import {
	ScreenPreviewControls,
	screenPreviewSummary,
	useScreenPreviewControls,
} from "@/components/preview/screen-preview-controls";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { resolveRenderableContentType } from "@/lib/content-ref";
import { DeviceDisplayMode } from "@/lib/mixup/constants";
import { playlistFrameBmpUrl, playlistFramePngUrl } from "@/lib/playlist-url";
import type { Device, SystemLog } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatDate, getDeviceStatus } from "@/utils/helpers";

interface DashboardClientPageProps {
	devices: Device[];
	systemLogs: SystemLog[];
}

type ProcessedDevice = Device & { status: "online" | "offline" };

export default function DashboardClientPage({
	devices,
	systemLogs,
}: DashboardClientPageProps) {
	const fleet = getFleetSummary(devices);

	return (
		<div className="space-y-4">
			<div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
				<LatestScreenPanel device={fleet.lastUpdatedDevice} />
				<FleetPanel fleet={fleet} />
			</div>

			<SystemLogsPanel systemLogs={systemLogs} />
		</div>
	);
}

function getFleetSummary(devices: Device[]) {
	const processedDevices = devices.map((device) => ({
		...device,
		status: getDeviceStatus(device),
	}));

	return {
		processedDevices,
		onlineDevices: processedDevices.filter((d) => d.status === "online"),
		offlineDevices: processedDevices.filter((d) => d.status === "offline"),
		lastUpdatedDevice: getLastUpdatedDevice(processedDevices),
	};
}

function getLastUpdatedDevice(devices: ProcessedDevice[]) {
	return devices.length > 0
		? [...devices].sort(
				(a, b) =>
					new Date(b.last_update_time || "").getTime() -
					new Date(a.last_update_time || "").getTime(),
			)[0]
		: null;
}

function LatestScreenPanel({ device }: { device: ProcessedDevice | null }) {
	const previewModel = useLatestScreenPreview(device);

	return (
		<section className="flex flex-col overflow-hidden rounded-2xl border bg-card">
			<LatestScreenHeader device={device} />
			{device && <LatestScreenControls previewModel={previewModel} />}
			<LatestScreenBody device={device} previewModel={previewModel} />
			<LatestScreenFooter device={device} previewModel={previewModel} />
		</section>
	);
}

function useLatestScreenPreview(device: ProcessedDevice | null) {
	const sourcePortrait = device?.screen_orientation === "portrait";
	const preview = useScreenPreviewControls({
		defaultPortrait: sourcePortrait,
		defaultPaletteIndex:
			device?.palette_id === "color-6a"
				? 3
				: device?.grayscale === 2
					? 0
					: device?.grayscale === 4
						? 1
						: 2,
	});
	const isPortrait = preview.isPortrait;
	const { height, width } = getPreviewDimensions(
		preview.sizePreset,
		isPortrait,
	);
	const rawPreviewId = getRawPreviewId(device);
	const previewType = resolveRenderableContentType(
		device?.screen_type,
		rawPreviewId,
	);
	const previewId = getPreviewId(device, previewType, rawPreviewId);
	const mixupId = getMixupId(device);

	return {
		preview,
		isPortrait,
		width,
		height,
		isMixup: Boolean(mixupId),
		bitmapSrc: getBitmapSrc({
			grayscale: preview.grayscale,
			height,
			mixupId,
			paletteId: preview.paletteId,
			previewId,
			previewType,
			width,
		}),
		pngSrc: playlistFramePngUrl(previewId, previewType, width, height),
		reactSrc: `/preview/${previewType}/${previewId}?width=${width}&height=${height}`,
	};
}

function getPreviewDimensions(
	sizePreset: ReturnType<typeof useScreenPreviewControls>["sizePreset"],
	isPortrait: boolean,
) {
	return {
		width: isPortrait ? sizePreset.height : sizePreset.width,
		height: isPortrait ? sizePreset.width : sizePreset.height,
	};
}

function getRawPreviewId(device: ProcessedDevice | null) {
	const previewIds = [device?.screen_id, device?.screen, "simple-text"];

	return previewIds.find(Boolean) ?? "simple-text";
}

function getPreviewId(
	device: ProcessedDevice | null,
	previewType: ReturnType<typeof resolveRenderableContentType>,
	rawPreviewId: string,
) {
	return previewType === "screen" ? rawPreviewId : getRawPreviewId(device);
}

function getMixupId(device: ProcessedDevice | null) {
	if (device?.display_mode !== DeviceDisplayMode.MIXUP) {
		return null;
	}

	return device.mixup_id || null;
}

function getBitmapSrc({
	grayscale,
	height,
	mixupId,
	paletteId,
	previewId,
	previewType,
	width,
}: {
	grayscale: number;
	height: number;
	mixupId: string | null;
	paletteId?: string;
	previewId: string;
	previewType: ReturnType<typeof resolveRenderableContentType>;
	width: number;
}) {
	const paletteParam = paletteId
		? `&palette=${encodeURIComponent(paletteId)}`
		: "";
	return mixupId
		? `/api/bitmap/mixup/${mixupId}.bmp?width=${width}&height=${height}&grayscale=${grayscale}${paletteParam}`
		: playlistFrameBmpUrl(
				previewId || "simple-text",
				previewType,
				width,
				height,
				grayscale,
				paletteId,
			);
}

function LatestScreenHeader({ device }: { device: ProcessedDevice | null }) {
	return (
		<header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2">
			<div className="flex items-center gap-2">
				<h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
					Latest screen
				</h3>
			</div>
			{device && (
				<div
					className="truncate text-xs text-muted-foreground"
					suppressHydrationWarning
				>
					<Link
						href={`/device/${device.friendly_id}`}
						className="font-medium text-foreground hover:text-primary"
					>
						{device.name}
					</Link>{" "}
					· {formatDate(device.last_update_time)}
				</div>
			)}
		</header>
	);
}

function LatestScreenControls({
	previewModel,
}: {
	previewModel: ReturnType<typeof useLatestScreenPreview>;
}) {
	const { preview, isPortrait } = previewModel;

	return (
		<ScreenPreviewControls
			format={preview.format}
			onFormatChange={preview.setFormat}
			sizeIndex={preview.sizeIndex}
			onSizeIndexChange={preview.setSizeIndex}
			paletteIndex={preview.paletteIndex}
			onPaletteIndexChange={preview.setPaletteIndex}
			isPortrait={isPortrait}
			onPortraitChange={preview.setIsPortrait}
			reactMode={preview.reactMode}
			onReactModeChange={preview.setReactMode}
		/>
	);
}

function LatestScreenBody({
	device,
	previewModel,
}: {
	device: ProcessedDevice | null;
	previewModel: ReturnType<typeof useLatestScreenPreview>;
}) {
	return (
		<div className="flex flex-1 items-center justify-center bg-[radial-gradient(circle_at_50%_0%,theme(colors.muted/40),transparent_70%)] p-6">
			{device ? (
				<LatestScreenDeviceFrame device={device} previewModel={previewModel} />
			) : (
				<Skeleton className="aspect-[5/3] w-full max-w-[520px] rounded-xl" />
			)}
		</div>
	);
}

function LatestScreenDeviceFrame({
	device,
	previewModel,
}: {
	device: ProcessedDevice;
	previewModel: ReturnType<typeof useLatestScreenPreview>;
}) {
	const { height, isPortrait, width } = previewModel;

	return (
		<div
			className={cn("w-full", isPortrait ? "max-w-[260px]" : "max-w-[520px]")}
		>
			<DeviceFrame
				size="lg"
				portrait={isPortrait}
				screenWidth={width}
				screenHeight={height}
			>
				<LatestScreenPreview device={device} previewModel={previewModel} />
			</DeviceFrame>
		</div>
	);
}

function LatestScreenPreview({
	device,
	previewModel,
}: {
	device: ProcessedDevice;
	previewModel: ReturnType<typeof useLatestScreenPreview>;
}) {
	const { height, preview, reactSrc, width } = previewModel;

	if (shouldShowMixupUnavailable(previewModel)) {
		return (
			<div className="absolute inset-0 flex items-center justify-center bg-background px-4 text-center text-sm text-muted-foreground">
				{preview.format.toUpperCase()} preview is not available for mixups yet.
			</div>
		);
	}

	if (preview.format === "react") {
		return (
			<ScaledReactPreview
				title={`${device.name} React preview`}
				src={reactSrc}
				width={width}
				height={height}
				mode={preview.reactMode}
			/>
		);
	}

	return (
		<Image
			src={getPreviewImageSrc(previewModel)}
			alt={`${device.name} screen`}
			fill
			className="absolute inset-0 h-full w-full object-cover"
			style={{ imageRendering: "pixelated" }}
			unoptimized
		/>
	);
}

function shouldShowMixupUnavailable(
	previewModel: ReturnType<typeof useLatestScreenPreview>,
) {
	return previewModel.isMixup && previewModel.preview.format !== "bmp";
}

function getPreviewImageSrc(
	previewModel: ReturnType<typeof useLatestScreenPreview>,
) {
	if (previewModel.preview.format === "png") {
		return previewModel.pngSrc;
	}

	return previewModel.bitmapSrc;
}

function LatestScreenFooter({
	device,
	previewModel,
}: {
	device: ProcessedDevice | null;
	previewModel: ReturnType<typeof useLatestScreenPreview>;
}) {
	return (
		<footer className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/20 px-4 py-2 text-[11px] text-muted-foreground">
			<span className="inline-flex items-center gap-2">
				<AlertTriangle className="h-3.5 w-3.5 shrink-0" />
				Passive device — this preview may be newer than what&apos;s currently on
				the screen.
			</span>
			{device && <LatestScreenPipeline previewModel={previewModel} />}
		</footer>
	);
}

function LatestScreenPipeline({
	previewModel,
}: {
	previewModel: ReturnType<typeof useLatestScreenPreview>;
}) {
	const { height, preview, width } = previewModel;

	return (
		<span className="tabular-nums">
			{preview.format.toUpperCase()} pipeline ·{" "}
			{screenPreviewSummary({
				format: preview.format,
				width,
				height,
				grayscale: preview.grayscale,
				paletteLabel: preview.paletteLabel,
				reactMode: preview.reactMode,
			})}
		</span>
	);
}

function FleetPanel({ fleet }: { fleet: ReturnType<typeof getFleetSummary> }) {
	const { offlineDevices, onlineDevices, processedDevices } = fleet;

	return (
		<section className="flex flex-col overflow-hidden rounded-2xl border bg-card">
			<header className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
				<h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
					Fleet
				</h3>
				<span className="rounded-full border px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
					{processedDevices.length}
				</span>
			</header>

			<div className="grid grid-cols-3 divide-x border-b">
				<Stat label="Total" value={processedDevices.length} />
				<Stat label="Online" value={onlineDevices.length} accent="online" />
				<Stat label="Offline" value={offlineDevices.length} accent="offline" />
			</div>

			<div className="grid flex-1 grid-cols-2 divide-x">
				<DeviceColumn
					title="Online"
					emptyLabel="No devices online"
					devices={onlineDevices}
				/>
				<DeviceColumn
					title="Offline"
					emptyLabel="No devices offline"
					devices={offlineDevices}
				/>
			</div>
		</section>
	);
}

function SystemLogsPanel({ systemLogs }: { systemLogs: SystemLog[] }) {
	return (
		<section className="overflow-hidden rounded-2xl border bg-card">
			<SystemLogsHeader logCount={systemLogs.length} />
			<div className="overflow-x-auto">
				<Table>
					<SystemLogsTableHeader />
					<TableBody>
						{systemLogs.length > 0 ? (
							systemLogs.map((log, index) => (
								<SystemLogRow
									key={log.id}
									log={log}
									prevLog={getPreviousLog(systemLogs, index)}
									isFirst={index === 0}
								/>
							))
						) : (
							<EmptySystemLogsRow />
						)}
					</TableBody>
				</Table>
			</div>
		</section>
	);
}

function SystemLogsHeader({ logCount }: { logCount: number }) {
	return (
		<header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2">
			<div className="flex items-center gap-2">
				<h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
					Recent system logs
				</h3>
				<span className="rounded-full border px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
					{logCount}
				</span>
			</div>
			<Link
				href="/system-logs"
				className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
			>
				See all
				<ArrowRight className="h-3.5 w-3.5" />
			</Link>
		</header>
	);
}

function SystemLogsTableHeader() {
	return (
		<TableHeader>
			<TableRow>
				<TableHead className="w-[80px]">Time</TableHead>
				<TableHead className="w-[80px]">Level</TableHead>
				<TableHead>Source</TableHead>
				<TableHead>Message</TableHead>
				<TableHead className="max-w-[220px]">Metadata</TableHead>
			</TableRow>
		</TableHeader>
	);
}

function SystemLogRow({
	log,
	prevLog,
	isFirst,
}: {
	log: SystemLog;
	prevLog: SystemLog | null;
	isFirst: boolean;
}) {
	const { showLevel, showTime } = getSystemLogVisibility(log, prevLog, isFirst);

	return (
		<TableRow>
			<TableCell
				className="text-xs tabular-nums text-muted-foreground"
				suppressHydrationWarning
			>
				{showTime ? formatDate(log.created_at) : ""}
			</TableCell>
			<TableCell>{showLevel ? <LevelBadge level={log.level} /> : ""}</TableCell>
			<TableCell className="text-xs text-muted-foreground">
				{log.source || "—"}
			</TableCell>
			<TableCell className="text-sm">{log.message}</TableCell>
			<TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
				{log.metadata}
			</TableCell>
		</TableRow>
	);
}

function getPreviousLog(systemLogs: SystemLog[], index: number) {
	return index > 0 ? systemLogs[index - 1] : null;
}

function getSystemLogVisibility(
	log: SystemLog,
	prevLog: SystemLog | null,
	isFirst: boolean,
) {
	if (isFirst) {
		return { showLevel: true, showTime: true };
	}

	const hasTimeGap = hasLogTimeGap(log, prevLog);
	if (hasTimeGap) {
		return { showLevel: true, showTime: true };
	}

	return {
		showLevel: prevLog?.level !== log.level,
		showTime: false,
	};
}

function hasLogTimeGap(log: SystemLog, prevLog: SystemLog | null) {
	const diffSec = getLogDiffSeconds(log, prevLog);

	return Boolean(diffSec && diffSec >= 3);
}

function getLogDiffSeconds(log: SystemLog, prevLog: SystemLog | null) {
	return prevLog
		? Math.abs(
				new Date(log.created_at || "").getTime() -
					new Date(prevLog.created_at || "").getTime(),
			) / 1000
		: null;
}

function EmptySystemLogsRow() {
	return (
		<TableRow>
			<TableCell
				colSpan={5}
				className="h-32 text-center text-sm text-muted-foreground"
			>
				No system logs to show
			</TableCell>
		</TableRow>
	);
}

function Stat({
	label,
	value,
	accent,
}: {
	label: string;
	value: number;
	accent?: "online" | "offline";
}) {
	const accentClassName = getStatAccentClassName(accent);

	return (
		<div className="flex flex-col gap-0.5 px-4 py-3">
			<span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
				{label}
			</span>
			<div className="flex items-baseline gap-2">
				<span
					className={cn(
						"text-2xl font-bold tabular-nums tracking-tight",
						accentClassName,
					)}
				>
					{value}
				</span>
				{accent && (
					<StatusIndicator
						status={accent === "online" ? "online" : "offline"}
						size="sm"
					/>
				)}
			</div>
		</div>
	);
}

function getStatAccentClassName(accent?: "online" | "offline") {
	const styles = {
		online: "text-green-600 dark:text-green-400",
		offline: "text-muted-foreground",
	};

	return accent ? styles[accent] : undefined;
}

function DeviceColumn({
	title,
	emptyLabel,
	devices,
}: {
	title: string;
	emptyLabel: string;
	devices: Array<Device & { status: "online" | "offline" }>;
}) {
	return (
		<div className="flex flex-col gap-1 p-3">
			<div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
				{title}
			</div>
			<div
				className="space-y-1 overflow-y-auto"
				style={{ scrollbarWidth: "thin", maxHeight: 140 }}
			>
				{devices.length > 0 ? (
					devices.map((device) => (
						<Link
							key={device.id}
							href={`/device/${device.friendly_id}`}
							className="group flex items-center justify-between gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50"
						>
							<div className="flex min-w-0 items-center gap-2">
								<StatusIndicator status={device.status} size="sm" />
								<span className="truncate text-sm group-hover:text-primary">
									{device.name}
								</span>
							</div>
							<span
								className="shrink-0 text-[10px] tabular-nums text-muted-foreground"
								suppressHydrationWarning
							>
								{formatDate(device.last_update_time)}
							</span>
						</Link>
					))
				) : (
					<div className="px-2 py-1.5 text-xs text-muted-foreground">
						{emptyLabel}
					</div>
				)}
			</div>
		</div>
	);
}

function LevelBadge({ level }: { level: SystemLog["level"] }) {
	const styles: Record<NonNullable<SystemLog["level"]>, string> = {
		error: "bg-destructive/10 text-destructive border-destructive/20",
		warning:
			"bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400",
		info: "bg-primary/10 text-primary border-primary/20",
		debug: "bg-muted text-muted-foreground border-border",
	};
	if (!level) return null;
	return (
		<Badge
			variant="outline"
			className={cn("text-[10px] uppercase tracking-wider", styles[level])}
		>
			{level}
		</Badge>
	);
}
