"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { DeviceFrame } from "@/components/common/device-frame";
import { ScaledReactPreview } from "@/components/preview/scaled-react-preview";
import {
	SCREEN_PREVIEW_PALETTES,
	SCREEN_PREVIEW_SIZE_PRESETS,
	ScreenPreviewControls,
	type ScreenPreviewFormat,
	screenPreviewSummary,
} from "@/components/preview/screen-preview-controls";
import {
	BmpPreview,
	ImageEndpointPreview,
} from "@/components/recipes/bmp-preview";
import { SCREEN_PARAMS_SAVED_EVENT } from "@/components/recipes/preview-refresh-events";
import { cn } from "@/lib/utils";

interface RecipePreviewStageProps {
	slug: string;
	isPortrait: boolean;
	basePath?: string;
	bitmapUrl?: string;
	pngUrl?: string;
	bmpNode?: ReactNode;
	pngNode?: ReactNode;
	reactNode?: ReactNode;
	reactPreviewSrc?: string;
	bmpPipeline?: ReactNode;
	pngPipeline?: ReactNode;
	reactPipeline?: ReactNode;
	defaultFormat?: ScreenPreviewFormat;
	reactLabel?: string;
}

export function appendPreviewRefreshParam(
	url: string,
	refreshRevision: number,
) {
	if (refreshRevision <= 0) return url;
	const separator = url.includes("?") ? "&" : "?";
	return `${url}${separator}preview_refresh=${refreshRevision}`;
}

function appendPreviewDimensions(url: string, width: number, height: number) {
	const separator = url.includes("?") ? "&" : "?";
	const params = new URLSearchParams({
		width: String(width),
		height: String(height),
	});
	return `${url}${separator}${params}`;
}

export function RecipePreviewStage({
	slug,
	isPortrait,
	basePath,
	bitmapUrl,
	pngUrl,
	bmpNode,
	pngNode,
	reactNode,
	reactPreviewSrc,
	bmpPipeline,
	pngPipeline,
	reactPipeline,
	defaultFormat = "react",
	reactLabel,
}: RecipePreviewStageProps) {
	const router = useRouter();
	const [format, setFormat] = useState<ScreenPreviewFormat>(defaultFormat);
	const [presetIdx, setPresetIdx] = useState(0);
	const [paletteIdx, setPaletteIdx] = useState(2);
	const [reactMode, setReactMode] = useState<"fit" | "scroll">("fit");
	const [previewRefreshRevision, setPreviewRefreshRevision] = useState(0);

	const preset =
		SCREEN_PREVIEW_SIZE_PRESETS[presetIdx] || SCREEN_PREVIEW_SIZE_PRESETS[0];
	const palette =
		SCREEN_PREVIEW_PALETTES[paletteIdx] || SCREEN_PREVIEW_PALETTES[2];
	const portraitW = isPortrait ? preset.height : preset.width;
	const portraitH = isPortrait ? preset.width : preset.height;
	const refreshedBitmapUrl = appendPreviewRefreshParam(
		bitmapUrl ?? `/api/bitmap/${slug}/default.bmp`,
		previewRefreshRevision,
	);
	const refreshedPngUrl = appendPreviewRefreshParam(
		pngUrl ?? `/api/png/${slug}/default.png`,
		previewRefreshRevision,
	);
	const refreshedReactPreviewSrc =
		reactPreviewSrc !== undefined
			? appendPreviewRefreshParam(reactPreviewSrc, previewRefreshRevision)
			: undefined;
	const resolvedReactNode =
		refreshedReactPreviewSrc !== undefined ? (
			<ScaledReactPreview
				src={appendPreviewDimensions(
					refreshedReactPreviewSrc,
					portraitW,
					portraitH,
				)}
				title={`${slug} React preview`}
				width={portraitW}
				height={portraitH}
				mode={reactMode}
			/>
		) : (
			reactNode
		);

	const formats: {
		key: ScreenPreviewFormat;
		node: ReactNode;
		pipeline: ReactNode;
	}[] = [
		{
			key: "bmp",
			node: bmpNode ?? (
				<BmpPreview
					slug={slug}
					width={portraitW}
					height={portraitH}
					bpp={palette.grayscale}
					bitmapUrl={refreshedBitmapUrl}
					paletteId={"paletteId" in palette ? palette.paletteId : undefined}
				/>
			),
			pipeline: bmpPipeline,
		},
		{
			key: "png",
			node: pngNode ?? (
				<ImageEndpointPreview
					alt="PNG preview"
					requestUrl={appendPreviewDimensions(
						refreshedPngUrl,
						portraitW,
						portraitH,
					)}
					width={portraitW}
					height={portraitH}
				/>
			),
			pipeline: pngPipeline,
		},
		{ key: "react", node: resolvedReactNode, pipeline: reactPipeline },
	].filter((f) => f.node !== undefined) as typeof formats;

	const active = formats.find((f) => f.key === format) || formats[0];
	const activeFormat = active?.key ?? format;

	useEffect(() => {
		if (active && active.key !== format) setFormat(active.key);
	}, [active, format]);

	useEffect(() => {
		const refreshPreview = () => {
			setPreviewRefreshRevision((revision) => revision + 1);
		};
		window.addEventListener(SCREEN_PARAMS_SAVED_EVENT, refreshPreview);
		return () =>
			window.removeEventListener(SCREEN_PARAMS_SAVED_EVENT, refreshPreview);
	}, []);

	const handleOrientationChange = (nextPortrait: boolean) => {
		if (nextPortrait === isPortrait) return;
		router.push(
			nextPortrait
				? `${basePath ?? `/recipes/${slug}`}?format=portrait`
				: (basePath ?? `/recipes/${slug}`),
		);
	};

	return (
		<div className="overflow-hidden rounded-2xl border bg-card">
			{/* Toolbar */}
			<ScreenPreviewControls
				format={activeFormat}
				onFormatChange={setFormat}
				sizeIndex={presetIdx}
				onSizeIndexChange={setPresetIdx}
				paletteIndex={paletteIdx}
				onPaletteIndexChange={setPaletteIdx}
				isPortrait={isPortrait}
				onPortraitChange={handleOrientationChange}
				reactMode={reactMode}
				onReactModeChange={setReactMode}
				formats={formats.map((item) => item.key)}
				reactLabel={reactLabel}
				className="bg-muted/30 px-3"
			/>

			{/* Stage */}
			<div className="flex items-center justify-center bg-[radial-gradient(circle_at_50%_0%,theme(colors.muted/40),transparent_70%)] px-6 py-8">
				<div
					className={cn(
						"w-full",
						isPortrait ? "max-w-[360px]" : "max-w-[720px]",
					)}
				>
					<DeviceFrame
						size="lg"
						portrait={isPortrait}
						screenWidth={portraitW}
						screenHeight={portraitH}
					>
						<div className="absolute inset-0">{active?.node}</div>
					</DeviceFrame>
				</div>
			</div>

			{/* Info bar */}
			<div className="border-t bg-muted/20 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
				<span className="tabular-nums">
					{screenPreviewSummary({
						format: activeFormat,
						width: portraitW,
						height: portraitH,
						grayscale: palette.grayscale,
						paletteLabel: palette.label,
						reactMode,
					})}
				</span>
				{active?.pipeline && (
					<span className="[&_a]:text-primary [&_a]:hover:underline">
						{active.pipeline}
					</span>
				)}
			</div>
		</div>
	);
}
