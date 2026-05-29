"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { DeviceFrame } from "@/components/common/device-frame";
import {
	SCREEN_PREVIEW_PALETTES,
	SCREEN_PREVIEW_SIZE_PRESETS,
	ScreenPreviewControls,
	type ScreenPreviewFormat,
	screenPreviewSummary,
} from "@/components/preview/screen-preview-controls";
import { BmpPreview } from "@/components/recipes/bmp-preview";
import { cn } from "@/lib/utils";

interface RecipePreviewStageProps {
	slug: string;
	isPortrait: boolean;
	basePath?: string;
	bitmapUrl?: string;
	bmpNode?: ReactNode;
	pngNode?: ReactNode;
	reactNode?: ReactNode;
	bmpPipeline?: ReactNode;
	pngPipeline?: ReactNode;
	reactPipeline?: ReactNode;
	defaultFormat?: ScreenPreviewFormat;
}

export function RecipePreviewStage({
	slug,
	isPortrait,
	basePath,
	bitmapUrl,
	bmpNode,
	pngNode,
	reactNode,
	bmpPipeline,
	pngPipeline,
	reactPipeline,
	defaultFormat = "bmp",
}: RecipePreviewStageProps) {
	const router = useRouter();
	const [format, setFormat] = useState<ScreenPreviewFormat>(defaultFormat);
	const [presetIdx, setPresetIdx] = useState(0);
	const [paletteIdx, setPaletteIdx] = useState(2);

	const preset =
		SCREEN_PREVIEW_SIZE_PRESETS[presetIdx] || SCREEN_PREVIEW_SIZE_PRESETS[0];
	const palette =
		SCREEN_PREVIEW_PALETTES[paletteIdx] || SCREEN_PREVIEW_PALETTES[2];
	const portraitW = isPortrait ? preset.height : preset.width;
	const portraitH = isPortrait ? preset.width : preset.height;

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
					bitmapUrl={bitmapUrl}
				/>
			),
			pipeline: bmpPipeline,
		},
		{ key: "png", node: pngNode, pipeline: pngPipeline },
		{ key: "react", node: reactNode, pipeline: reactPipeline },
	].filter((f) => f.node !== undefined) as typeof formats;

	const active = formats.find((f) => f.key === format) || formats[0];

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
				format={format}
				onFormatChange={setFormat}
				sizeIndex={presetIdx}
				onSizeIndexChange={setPresetIdx}
				paletteIndex={paletteIdx}
				onPaletteIndexChange={setPaletteIdx}
				isPortrait={isPortrait}
				onPortraitChange={handleOrientationChange}
				formats={formats.map((item) => item.key)}
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
						format,
						width: portraitW,
						height: portraitH,
						grayscale: palette.grayscale,
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
