"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type ScreenPreviewFormat = "bmp" | "png" | "react";

export const SCREEN_PREVIEW_FORMATS: {
	value: ScreenPreviewFormat;
	label: string;
}[] = [
	{ value: "bmp", label: "BMP" },
	{ value: "png", label: "PNG" },
	{ value: "react", label: "React" },
];

export const SCREEN_PREVIEW_SIZE_PRESETS = [
	{ label: "800×480", width: 800, height: 480 },
	{ label: "1872×1404", width: 1872, height: 1404 },
	{ label: "2048×1536", width: 2048, height: 1536 },
] as const;

export const SCREEN_PREVIEW_PALETTES = [
	{ label: "BW", grayscale: 2, swatches: ["#111827", "#f8fafc"] },
	{
		label: "4 gray",
		grayscale: 4,
		swatches: ["#111827", "#64748b", "#cbd5e1"],
	},
	{
		label: "16 gray",
		grayscale: 16,
		swatches: ["#020617", "#475569", "#94a3b8", "#f8fafc"],
	},
] as const;

export function useScreenPreviewControls({
	defaultFormat = "bmp",
	defaultPortrait = false,
	defaultSizeIndex = 0,
	defaultPaletteIndex = 2,
}: {
	defaultFormat?: ScreenPreviewFormat;
	defaultPortrait?: boolean;
	defaultSizeIndex?: number;
	defaultPaletteIndex?: number;
} = {}) {
	const [format, setFormat] = useState<ScreenPreviewFormat>(defaultFormat);
	const [sizeIndex, setSizeIndex] = useState(defaultSizeIndex);
	const [paletteIndex, setPaletteIndex] = useState(defaultPaletteIndex);
	const [isPortrait, setIsPortrait] = useState(defaultPortrait);

	const sizePreset =
		SCREEN_PREVIEW_SIZE_PRESETS[sizeIndex] || SCREEN_PREVIEW_SIZE_PRESETS[0];
	const palette =
		SCREEN_PREVIEW_PALETTES[paletteIndex] || SCREEN_PREVIEW_PALETTES[2];
	const width = isPortrait ? sizePreset.height : sizePreset.width;
	const height = isPortrait ? sizePreset.width : sizePreset.height;

	return useMemo(
		() => ({
			format,
			setFormat,
			sizeIndex,
			setSizeIndex,
			paletteIndex,
			setPaletteIndex,
			isPortrait,
			setIsPortrait,
			sizePreset,
			palette,
			width,
			height,
			grayscale: palette.grayscale,
		}),
		[
			format,
			sizeIndex,
			paletteIndex,
			isPortrait,
			sizePreset,
			palette,
			width,
			height,
		],
	);
}

export function ScreenPreviewControls({
	format,
	onFormatChange,
	sizeIndex,
	onSizeIndexChange,
	paletteIndex,
	onPaletteIndexChange,
	isPortrait,
	onPortraitChange,
	formats = ["bmp", "png", "react"],
	showFormats = true,
	showSizes = true,
	showOrientation = true,
	showPalette = true,
	className,
}: {
	format: ScreenPreviewFormat;
	onFormatChange: (format: ScreenPreviewFormat) => void;
	sizeIndex: number;
	onSizeIndexChange: (index: number) => void;
	paletteIndex: number;
	onPaletteIndexChange: (index: number) => void;
	isPortrait: boolean;
	onPortraitChange: (isPortrait: boolean) => void;
	formats?: ScreenPreviewFormat[];
	showFormats?: boolean;
	showSizes?: boolean;
	showOrientation?: boolean;
	showPalette?: boolean;
	className?: string;
}) {
	const allowedFormats = SCREEN_PREVIEW_FORMATS.filter((item) =>
		formats.includes(item.value),
	);
	const canConfigureSize = format === "bmp" || format === "png";
	const canConfigurePalette = format === "bmp";

	return (
		<div
			className={cn(
				"flex flex-wrap items-center gap-1.5 border-b bg-muted/20 px-4 py-2",
				className,
			)}
		>
			{showFormats && allowedFormats.length > 0 && (
				<div className="inline-flex rounded-lg border bg-background p-0.5">
					{allowedFormats.map((item) => (
						<button
							key={item.value}
							type="button"
							onClick={() => onFormatChange(item.value)}
							className={cn(
								"rounded-md px-2 py-1 text-xs font-semibold uppercase",
								format === item.value
									? "bg-primary text-primary-foreground"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{item.label}
						</button>
					))}
				</div>
			)}

			{showSizes && canConfigureSize && (
				<div className="inline-flex rounded-lg border bg-background p-0.5">
					{SCREEN_PREVIEW_SIZE_PRESETS.map((preset, index) => (
						<button
							key={preset.label}
							type="button"
							onClick={() => onSizeIndexChange(index)}
							className={cn(
								"rounded-md px-2 py-1 text-xs font-medium",
								sizeIndex === index
									? "bg-foreground text-background"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{preset.label}
						</button>
					))}
				</div>
			)}

			{showOrientation && (
				<div className="inline-flex rounded-lg border bg-background p-0.5">
					<button
						type="button"
						onClick={() => onPortraitChange(false)}
						className={cn(
							"rounded-md px-2 py-1 text-xs font-medium",
							!isPortrait
								? "bg-foreground text-background"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						Landscape
					</button>
					<button
						type="button"
						onClick={() => onPortraitChange(true)}
						className={cn(
							"rounded-md px-2 py-1 text-xs font-medium",
							isPortrait
								? "bg-foreground text-background"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						Portrait
					</button>
				</div>
			)}

			{showPalette && canConfigurePalette && (
				<div className="inline-flex rounded-lg border bg-background p-0.5">
					{SCREEN_PREVIEW_PALETTES.map((palette, index) => (
						<button
							key={palette.label}
							type="button"
							onClick={() => onPaletteIndexChange(index)}
							className={cn(
								"inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium",
								paletteIndex === index
									? "bg-foreground text-background"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							<span className="flex overflow-hidden rounded-sm border">
								{palette.swatches.map((color) => (
									<span
										key={color}
										className="h-3 w-2"
										style={{ backgroundColor: color }}
									/>
								))}
							</span>
							{palette.label}
						</button>
					))}
				</div>
			)}
		</div>
	);
}

export function screenPreviewSummary({
	format,
	width,
	height,
	grayscale,
}: {
	format: ScreenPreviewFormat;
	width: number;
	height: number;
	grayscale: number;
}) {
	if (format === "react") return "React preview";
	if (format === "png") return `${width}×${height}px · PNG`;
	return `${width}×${height}px · ${grayscale} gray levels · BMP`;
}
