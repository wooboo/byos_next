"use client";

import { ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DeviceFrame } from "@/components/common/device-frame";
import { StatusIndicator } from "@/components/common/status-indicator";
import { ScaledReactPreview } from "@/components/preview/scaled-react-preview";
import {
	ScreenPreviewControls,
	screenPreviewSummary,
	useScreenPreviewControls,
} from "@/components/preview/screen-preview-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { resolveRenderableContentType } from "@/lib/content-ref";
import { DeviceDisplayMode } from "@/lib/mixup/constants";
import { playlistFrameBmpUrl } from "@/lib/playlist-url";
import {
	DEFAULT_IMAGE_HEIGHT,
	DEFAULT_IMAGE_WIDTH,
} from "@/lib/recipes/constants";
import type { Device } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
	compareVersions,
	estimateBatteryLife,
	formatDate,
	formatTimezone,
} from "@/utils/helpers";

interface FirmwareInfo {
	version: string;
	isUpdateAvailable: boolean;
}

export const getSignalQuality = (rssi: number): string => {
	if (rssi >= -50) return "Excellent";
	if (rssi >= -60) return "Good";
	if (rssi >= -70) return "Fair";
	if (rssi >= -80) return "Poor";
	return "Very Poor";
};

export const calculateRefreshPerDay = (
	deviceData: Device & { status?: string; type?: string },
): number => {
	if (!deviceData?.refresh_schedule) return 0;
	const defaultRefreshRate =
		deviceData.refresh_schedule.default_refresh_rate || 300;
	let refreshesPerDay = (24 * 60 * 60) / defaultRefreshRate;
	if (
		deviceData.refresh_schedule.time_ranges &&
		deviceData.refresh_schedule.time_ranges.length > 0
	) {
		for (const range of deviceData.refresh_schedule.time_ranges) {
			const [startHour, startMinute] = range.start_time.split(":").map(Number);
			const [endHour, endMinute] = range.end_time.split(":").map(Number);
			const startTimeInMinutes = startHour * 60 + startMinute;
			const endTimeInMinutes = endHour * 60 + endMinute;
			const durationInHours = (endTimeInMinutes - startTimeInMinutes) / 60;
			const rangeRefreshes = (durationInHours * 60 * 60) / range.refresh_rate;
			refreshesPerDay =
				refreshesPerDay -
				(durationInHours * 60 * 60) / defaultRefreshRate +
				rangeRefreshes;
		}
	}
	return Math.max(0, refreshesPerDay);
};

interface DeviceViewProps {
	device: Device & { status?: string; type?: string };
	playlistScreens: PlaylistScreen[];
}

type PlaylistScreen = {
	screen: string;
	screen_type?: string | null;
	duration: number;
};

type DeviceViewData = Device & { status?: string; type?: string };

type DevicePreviewModel = {
	isPlaylist: boolean;
	heroFrameId: string;
	heroContentType: string;
	bmpSrc: string;
	pngSrc: string;
	reactSrc: string;
};

export function getDevicePreviewModel({
	device,
	playlistScreens,
	deviceWidth,
	deviceHeight,
	grayscaleLevels,
}: {
	device: DeviceViewData;
	playlistScreens: PlaylistScreen[];
	deviceWidth: number;
	deviceHeight: number;
	grayscaleLevels: number;
}): DevicePreviewModel {
	const isPlaylist =
		device.display_mode === DeviceDisplayMode.PLAYLIST &&
		Boolean(device.playlist_id) &&
		playlistScreens.length > 0;
	const isMixup =
		device.display_mode === DeviceDisplayMode.MIXUP && Boolean(device.mixup_id);
	const singleScreenId = device.screen_id || device.screen || "simple-text";
	const singleScreenType = resolveRenderableContentType(
		device.screen_type,
		singleScreenId,
	);
	const heroFrameId = isPlaylist
		? playlistScreens[0].screen || "simple-text"
		: isMixup
			? device.mixup_id || "simple-text"
			: singleScreenId;
	const heroFrameType = isPlaylist
		? playlistScreens[0].screen_type || "recipe"
		: isMixup
			? "mixup"
			: singleScreenType;
	const heroContentType =
		heroFrameType === "mixup"
			? "mixup"
			: resolveRenderableContentType(heroFrameType, heroFrameId);

	return {
		isPlaylist,
		heroFrameId,
		heroContentType,
		bmpSrc:
			heroContentType === "mixup"
				? `/api/bitmap/mixup/${heroFrameId}.bmp?width=${deviceWidth}&height=${deviceHeight}&grayscale=${grayscaleLevels}`
				: playlistFrameBmpUrl(
						heroFrameId || "simple-text",
						heroContentType,
						deviceWidth,
						deviceHeight,
						grayscaleLevels,
					),
		pngSrc: `/api/png/${heroContentType}/${heroFrameId}?width=${deviceWidth}&height=${deviceHeight}`,
		reactSrc: `/preview/${heroContentType}/${heroFrameId}?width=${deviceWidth}&height=${deviceHeight}`,
	};
}

function PanelHeader({
	label,
	right,
}: {
	label: string;
	right?: React.ReactNode;
}) {
	return (
		<div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2">
			<h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
				{label}
			</h3>
			{right}
		</div>
	);
}

function MetaPair({
	label,
	children,
	mono,
}: {
	label: string;
	children: React.ReactNode;
	mono?: boolean;
}) {
	return (
		<div className="flex flex-col gap-0.5">
			<span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
				{label}
			</span>
			<span className={cn("text-sm", mono && "font-mono")}>{children}</span>
		</div>
	);
}

function DevicePreviewPanel({
	device,
	playlistScreens,
	preview,
	previewModel,
	deviceWidth,
	deviceHeight,
	grayscaleLevels,
}: {
	device: DeviceViewData;
	playlistScreens: PlaylistScreen[];
	preview: ReturnType<typeof useScreenPreviewControls>;
	previewModel: DevicePreviewModel;
	deviceWidth: number;
	deviceHeight: number;
	grayscaleLevels: number;
}) {
	const isPortrait = preview.isPortrait;

	return (
		<section className="flex flex-col overflow-hidden rounded-2xl border bg-card">
			<PanelHeader
				label="Preview"
				right={
					<span className="text-[11px] tabular-nums text-muted-foreground">
						<span className="capitalize">
							{isPortrait ? "portrait" : "landscape"}
						</span>
					</span>
				}
			/>
			<ScreenPreviewControls
				format={preview.format}
				onFormatChange={preview.setFormat}
				sizeIndex={preview.sizeIndex}
				onSizeIndexChange={preview.setSizeIndex}
				paletteIndex={preview.paletteIndex}
				onPaletteIndexChange={preview.setPaletteIndex}
				isPortrait={preview.isPortrait}
				onPortraitChange={preview.setIsPortrait}
				reactMode={preview.reactMode}
				onReactModeChange={preview.setReactMode}
				className="border-b bg-muted/20"
			/>
			<div className="flex flex-1 items-center justify-center bg-[radial-gradient(circle_at_50%_0%,theme(colors.muted/40),transparent_70%)] p-6">
				<div
					className={cn(
						"w-full",
						isPortrait ? "max-w-[260px]" : "max-w-[520px]",
					)}
				>
					<DeviceFrame
						size="lg"
						portrait={isPortrait}
						screenWidth={deviceWidth}
						screenHeight={deviceHeight}
					>
						{previewModel.heroContentType === "mixup" &&
						preview.format !== "bmp" ? (
							<div className="absolute inset-0 flex items-center justify-center bg-background px-4 text-center text-sm text-muted-foreground">
								{preview.format.toUpperCase()} preview is not available for
								mixups yet.
							</div>
						) : preview.format === "react" ? (
							<ScaledReactPreview
								title={`${device.name} React preview`}
								src={previewModel.reactSrc}
								width={deviceWidth}
								height={deviceHeight}
								mode={preview.reactMode}
							/>
						) : (
							<Image
								src={
									preview.format === "png"
										? previewModel.pngSrc
										: previewModel.bmpSrc
								}
								alt="Device screen"
								fill
								className="absolute inset-0 h-full w-full object-cover"
								style={{ imageRendering: "pixelated" }}
								unoptimized
							/>
						)}
					</DeviceFrame>
				</div>
			</div>
			{previewModel.isPlaylist && (
				<PlaylistRotation
					playlistScreens={playlistScreens}
					isPortrait={isPortrait}
					deviceWidth={deviceWidth}
					deviceHeight={deviceHeight}
					grayscaleLevels={grayscaleLevels}
				/>
			)}
			<footer className="flex items-center gap-2 border-t bg-muted/20 px-4 py-2 text-[11px] text-muted-foreground">
				<span>
					Passive device — this preview may be newer than what&apos;s currently
					on the screen.
				</span>
				<span className="ml-auto tabular-nums">
					{screenPreviewSummary({
						format: preview.format,
						width: deviceWidth,
						height: deviceHeight,
						grayscale: grayscaleLevels,
						reactMode: preview.reactMode,
					})}
				</span>
			</footer>
		</section>
	);
}

function PlaylistRotation({
	playlistScreens,
	isPortrait,
	deviceWidth,
	deviceHeight,
	grayscaleLevels,
}: {
	playlistScreens: PlaylistScreen[];
	isPortrait: boolean;
	deviceWidth: number;
	deviceHeight: number;
	grayscaleLevels: number;
}) {
	return (
		<div className="border-t bg-muted/20 px-4 py-3">
			<div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
				<span>Rotation</span>
				<span className="tabular-nums">
					{playlistScreens.length}{" "}
					{playlistScreens.length === 1 ? "screen" : "screens"}
				</span>
			</div>
			<div className="flex items-stretch gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
				{playlistScreens.map((screen, i) => (
					<div
						key={`${screen.screen_type || "recipe"}-${screen.screen}-${i}`}
						className="w-[110px] shrink-0 space-y-1"
					>
						<DeviceFrame size="sm" portrait={isPortrait} flat>
							<Image
								src={playlistFrameBmpUrl(
									screen.screen || "simple-text",
									screen.screen_type,
									deviceWidth,
									deviceHeight,
									grayscaleLevels,
								)}
								alt={`Frame ${i + 1}`}
								fill
								className="absolute inset-0 h-full w-full object-cover"
								style={{ imageRendering: "pixelated" }}
								unoptimized
							/>
						</DeviceFrame>
						<div className="flex items-center justify-between text-[10px] text-muted-foreground">
							<span className="tabular-nums">#{i + 1}</span>
							<span className="tabular-nums">{screen.duration}s</span>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

function DeviceDetailsPanels({
	device,
	status,
	firmwareInfo,
	refreshPerDay,
	batteryEstimate,
}: {
	device: DeviceViewData;
	status: "online" | "offline";
	firmwareInfo: FirmwareInfo | null;
	refreshPerDay: number;
	batteryEstimate: ReturnType<typeof estimateBatteryLife> | null;
}) {
	return (
		<div className="flex flex-col gap-4">
			<IdentityPanel
				device={device}
				status={status}
				firmwareInfo={firmwareInfo}
			/>
			<HealthPanel
				device={device}
				refreshPerDay={refreshPerDay}
				batteryEstimate={batteryEstimate}
			/>
			<DisplayPanel device={device} />
		</div>
	);
}

function IdentityPanel({
	device,
	status,
	firmwareInfo,
}: {
	device: DeviceViewData;
	status: "online" | "offline";
	firmwareInfo: FirmwareInfo | null;
}) {
	return (
		<section className="flex flex-col overflow-hidden rounded-2xl border bg-card">
			<PanelHeader
				label="Identity"
				right={
					<span
						className="text-[11px] text-muted-foreground tabular-nums"
						suppressHydrationWarning
					>
						{device.last_update_time
							? `Last seen ${formatDate(device.last_update_time)}`
							: "—"}
					</span>
				}
			/>
			<div className="grid gap-3 p-4 sm:grid-cols-2">
				<MetaPair label="Status">
					<span className="inline-flex items-center gap-1.5 capitalize">
						<StatusIndicator status={status} size="sm" />
						{device.status}
					</span>
				</MetaPair>
				<MetaPair label="Friendly ID" mono>
					{device.friendly_id}
				</MetaPair>
				<MetaPair label="MAC" mono>
					{device.mac_address}
				</MetaPair>
				<MetaPair label="Timezone">{formatTimezone(device.timezone)}</MetaPair>
			</div>
			<div className="border-t bg-muted/20 px-4 py-3">
				<div className="flex flex-wrap items-center gap-2 text-sm">
					<span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
						Firmware
					</span>
					<span className="font-mono">
						{device.firmware_version || "Unknown"}
					</span>
					{firmwareInfo?.isUpdateAvailable && (
						<>
							<Badge
								variant="outline"
								className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
							>
								Update available · v{firmwareInfo.version}
							</Badge>
							<Link
								href="https://usetrmnl.com/flash"
								target="_blank"
								rel="noopener noreferrer"
							>
								<Button
									variant="link"
									size="sm"
									className="h-auto gap-1 p-0 text-xs"
								>
									Flash
									<ExternalLink className="h-3 w-3" />
								</Button>
							</Link>
						</>
					)}
				</div>
			</div>
		</section>
	);
}

function HealthPanel({
	device,
	refreshPerDay,
	batteryEstimate,
}: {
	device: DeviceViewData;
	refreshPerDay: number;
	batteryEstimate: ReturnType<typeof estimateBatteryLife> | null;
}) {
	return (
		<section className="flex flex-col overflow-hidden rounded-2xl border bg-card">
			<PanelHeader label="Health" />
			<div className="space-y-3 p-4">
				<div className="flex items-center justify-between text-sm">
					<span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
						WiFi
					</span>
					<span className="tabular-nums">
						{device.rssi
							? `${device.rssi} dBm · ${getSignalQuality(device.rssi)}`
							: "Unknown"}
					</span>
				</div>
				{batteryEstimate && (
					<div className="space-y-2">
						<div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
							Battery
						</div>
						<div className="flex flex-wrap items-center gap-3 text-sm">
							<div className="flex items-center">
								<Progress
									value={batteryEstimate.batteryPercentage}
									className={cn(
										"h-5 w-12 rounded-sm border border-primary",
										batteryEstimate.batteryPercentage < 20 &&
											"[&>[data-slot=progress-indicator]]:bg-destructive",
										batteryEstimate.batteryPercentage >= 20 &&
											batteryEstimate.batteryPercentage < 50 &&
											"[&>[data-slot=progress-indicator]]:bg-amber-500",
									)}
								/>
								<div className="ml-[1px] h-2 w-0.5 rounded-r-sm bg-primary" />
							</div>
							<span className="font-medium tabular-nums">
								{batteryEstimate.isCharging
									? "Charging"
									: `${batteryEstimate.batteryPercentage}%`}
							</span>
							<span className="text-muted-foreground tabular-nums">
								{device.battery_voltage}V
							</span>
							<span className="text-xs text-muted-foreground">
								{batteryEstimate.isCharging
									? "Estimating while charging"
									: `~${batteryEstimate.remainingDays} days at ${refreshPerDay} refreshes/day`}
							</span>
						</div>
					</div>
				)}
			</div>
		</section>
	);
}

function DisplayPanel({ device }: { device: DeviceViewData }) {
	return (
		<section className="flex flex-col overflow-hidden rounded-2xl border bg-card">
			<PanelHeader
				label="Display"
				right={
					<span
						className="text-[11px] text-muted-foreground tabular-nums"
						suppressHydrationWarning
					>
						Next:{" "}
						{device.next_expected_update
							? formatDate(device.next_expected_update)
							: "—"}
					</span>
				}
			/>
			<div className="grid gap-3 p-4 sm:grid-cols-3">
				<MetaPair label="Mode">
					<span className="capitalize">{device.display_mode}</span>
				</MetaPair>
				<MetaPair label="Last refresh">
					{device.last_refresh_duration
						? `${device.last_refresh_duration}s`
						: "Unknown"}
				</MetaPair>
				<MetaPair label="Default refresh">
					{device?.refresh_schedule?.default_refresh_rate || 300}s
				</MetaPair>
			</div>
			<p className="border-t bg-muted/20 px-4 py-2 text-[11px] text-muted-foreground">
				{device.display_mode === DeviceDisplayMode.PLAYLIST
					? "Rotating screens from the selected playlist."
					: device.display_mode === DeviceDisplayMode.MIXUP
						? "Split-screen layout combining multiple recipes."
						: "Single screen rendering the selected component."}
			</p>
		</section>
	);
}

export default function DeviceView({
	device,
	playlistScreens,
}: DeviceViewProps) {
	const [firmwareInfo, setFirmwareInfo] = useState<FirmwareInfo | null>(null);
	const preview = useScreenPreviewControls({
		defaultPortrait: device.screen_orientation === "portrait",
		defaultPaletteIndex:
			device.grayscale === 2
				? 0
				: device.grayscale === 4
					? 1
					: device.grayscale === 256
						? 3
						: 2,
	});

	useEffect(() => {
		const fetchLatestFirmware = async () => {
			try {
				const response = await fetch(
					"https://api.github.com/repos/usetrmnl/trmnl-firmware/releases/latest",
					{ headers: { Accept: "application/vnd.github.v3+json" } },
				);
				if (!response.ok) return;
				const data = await response.json();
				const latestVersion = (data.tag_name || "").replace(/^v/i, "");
				if (latestVersion && device.firmware_version) {
					setFirmwareInfo({
						version: latestVersion,
						isUpdateAvailable:
							compareVersions(device.firmware_version, latestVersion) < 0,
					});
				}
			} catch (error) {
				console.error("Failed to fetch firmware info:", error);
			}
		};
		fetchLatestFirmware();
	}, [device.firmware_version]);

	const deviceWidth = preview.width || DEFAULT_IMAGE_WIDTH;
	const deviceHeight = preview.height || DEFAULT_IMAGE_HEIGHT;
	const grayscaleLevels = preview.grayscale;

	const status: "online" | "offline" =
		device.status === "online" ? "online" : "offline";
	const refreshPerDay = calculateRefreshPerDay(device);
	const batteryEstimate = device.battery_voltage
		? estimateBatteryLife(device.battery_voltage, refreshPerDay)
		: null;
	const previewModel = getDevicePreviewModel({
		device,
		playlistScreens,
		deviceWidth,
		deviceHeight,
		grayscaleLevels,
	});

	return (
		<div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
			<DevicePreviewPanel
				device={device}
				playlistScreens={playlistScreens}
				preview={preview}
				previewModel={previewModel}
				deviceWidth={deviceWidth}
				deviceHeight={deviceHeight}
				grayscaleLevels={grayscaleLevels}
			/>
			<DeviceDetailsPanels
				device={device}
				status={status}
				firmwareInfo={firmwareInfo}
				refreshPerDay={refreshPerDay}
				batteryEstimate={batteryEstimate}
			/>
		</div>
	);
}
