"use client";

import { RectangleHorizontal, RectangleVertical } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type ScreenPreviewFormat = "bmp" | "png" | "react";
export type ReactPreviewMode = "fit" | "scroll";

export const SCREEN_PREVIEW_FORMATS: {
	value: ScreenPreviewFormat;
	label: string;
}[] = [
	{ value: "react", label: "React" },
	{ value: "png", label: "PNG" },
	{ value: "bmp", label: "BMP" },
];

export const SCREEN_PREVIEW_SIZE_PRESETS = [
	{ label: "800×480", width: 800, height: 480 },
	{ label: "600×400", width: 600, height: 400 },
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
	{
		label: "256 colors",
		grayscale: 256,
		swatches: ["#ef4444", "#22c55e", "#3b82f6", "#f8fafc"],
	},
	{
		label: "6 color",
		grayscale: 2,
		paletteId: "color-6a",
		swatches: [
			"#ff0000",
			"#00ff00",
			"#0000ff",
			"#ffff00",
			"#000000",
			"#ffffff",
		],
	},
	{
		label: "PaperColor",
		grayscale: 2,
		paletteId: "m5papercolor-ed2208-m5gfx-v1",
		swatches: [
			"#46425f",
			"#b2c1b8",
			"#af9900",
			"#614148",
			"#13509b",
			"#246d28",
		],
	},
] as const;

export function useScreenPreviewControls({
	defaultFormat = "react",
	defaultPortrait = false,
	defaultSizeIndex = 0,
	defaultPaletteIndex = 2,
	defaultReactMode = "fit",
}: {
	defaultFormat?: ScreenPreviewFormat;
	defaultPortrait?: boolean;
	defaultSizeIndex?: number;
	defaultPaletteIndex?: number;
	defaultReactMode?: ReactPreviewMode;
} = {}) {
	const [format, setFormat] = useState<ScreenPreviewFormat>(defaultFormat);
	const [sizeIndex, setSizeIndex] = useState(defaultSizeIndex);
	const [paletteIndex, setPaletteIndex] = useState(defaultPaletteIndex);
	const [isPortrait, setIsPortrait] = useState(defaultPortrait);
	const [reactMode, setReactMode] =
		useState<ReactPreviewMode>(defaultReactMode);

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
			reactMode,
			setReactMode,
			sizePreset,
			palette,
			width,
			height,
			grayscale: palette.grayscale,
			paletteId: "paletteId" in palette ? palette.paletteId : undefined,
			paletteLabel: palette.label,
		}),
		[
			format,
			sizeIndex,
			paletteIndex,
			isPortrait,
			reactMode,
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
	reactMode = "fit",
	onReactModeChange,
	formats = ["bmp", "png", "react"],
	showFormats = true,
	showSizes = true,
	showOrientation = true,
	showPalette = true,
	className,
	reactLabel = "React",
}: {
	format: ScreenPreviewFormat;
	onFormatChange: (format: ScreenPreviewFormat) => void;
	sizeIndex: number;
	onSizeIndexChange: (index: number) => void;
	paletteIndex: number;
	onPaletteIndexChange: (index: number) => void;
	isPortrait: boolean;
	onPortraitChange: (isPortrait: boolean) => void;
	reactMode?: ReactPreviewMode;
	onReactModeChange?: (mode: ReactPreviewMode) => void;
	formats?: ScreenPreviewFormat[];
	showFormats?: boolean;
	showSizes?: boolean;
	showOrientation?: boolean;
	showPalette?: boolean;
	className?: string;
	reactLabel?: string;
}) {
	const allowedFormats = SCREEN_PREVIEW_FORMATS.filter((item) =>
		formats.includes(item.value),
	).map((item) =>
		item.value === "react" ? { ...item, label: reactLabel } : item,
	);
	const canConfigureSize =
		format === "bmp" || format === "png" || format === "react";
	const canConfigurePalette = format === "bmp";
	const canConfigureReactMode = format === "react" && onReactModeChange;

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
				<details className="group relative">
					<summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1 text-xs font-medium outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
						<span className="text-muted-foreground group-hover:text-accent-foreground">
							Size
						</span>
						<span>{SCREEN_PREVIEW_SIZE_PRESETS[sizeIndex]?.label}</span>
					</summary>
					<div className="absolute top-full left-0 z-20 mt-1 min-w-full rounded-lg border bg-popover p-1 text-popover-foreground shadow-md">
						{SCREEN_PREVIEW_SIZE_PRESETS.map((preset, index) => (
							<button
								key={preset.label}
								type="button"
								onClick={(event) => {
									onSizeIndexChange(index);
									event.currentTarget
										.closest("details")
										?.removeAttribute("open");
								}}
								className={cn(
									"block w-full rounded-md px-2 py-1 text-left text-xs font-medium whitespace-nowrap",
									sizeIndex === index
										? "bg-foreground text-background"
										: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
								)}
							>
								{preset.label}
							</button>
						))}
					</div>
				</details>
			)}

			{showOrientation && (
				<div className="inline-flex rounded-lg border bg-background p-0.5">
					<button
						type="button"
						onClick={() => onPortraitChange(false)}
						aria-label="Landscape"
						title="Landscape"
						className={cn(
							"inline-flex size-6 items-center justify-center rounded-md",
							!isPortrait
								? "bg-foreground text-background"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						<RectangleHorizontal className="size-4" aria-hidden="true" />
					</button>
					<button
						type="button"
						onClick={() => onPortraitChange(true)}
						aria-label="Portrait"
						title="Portrait"
						className={cn(
							"inline-flex size-6 items-center justify-center rounded-md",
							isPortrait
								? "bg-foreground text-background"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						<RectangleVertical className="size-4" aria-hidden="true" />
					</button>
				</div>
			)}

			{canConfigureReactMode && (
				<div className="inline-flex rounded-lg border bg-background p-0.5">
					<button
						type="button"
						onClick={() => onReactModeChange("fit")}
						className={cn(
							"rounded-md px-2 py-1 text-xs font-medium",
							reactMode === "fit"
								? "bg-foreground text-background"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						Fit
					</button>
					<button
						type="button"
						onClick={() => onReactModeChange("scroll")}
						className={cn(
							"rounded-md px-2 py-1 text-xs font-medium",
							reactMode === "scroll"
								? "bg-foreground text-background"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						Scroll
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
	paletteLabel,
	reactMode,
}: {
	format: ScreenPreviewFormat;
	width: number;
	height: number;
	grayscale: number;
	paletteLabel?: string;
	reactMode?: ReactPreviewMode;
}) {
	if (format === "react")
		return `${width}×${height}px · React ${reactMode ?? "fit"}`;
	if (format === "png") return `${width}×${height}px · PNG`;
	if (grayscale === 256) return `${width}×${height}px · 256 colors · BMP`;
	if (paletteLabel && !paletteLabel.includes("gray")) {
		return `${width}×${height}px · ${paletteLabel} · BMP`;
	}
	return `${width}×${height}px · ${grayscale} gray levels · BMP`;
}
