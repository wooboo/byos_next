"use client";

import { Monitor, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { BmpPreview } from "@/components/recipes/bmp-preview";
import { DeviceFrame } from "@/components/common/device-frame";
import { cn } from "@/lib/utils";

type FormatKey = "bmp" | "png" | "react";

const FORMAT_LABELS: Record<FormatKey, string> = {
	bmp: "BMP",
	png: "PNG",
	react: "React",
};

const SIZE_PRESETS = [
	{ label: "Standard", w: 800, h: 480 },
	{ label: "TRMNL X", w: 1872, h: 1404 },
] as const;

const BPP_OPTIONS = [2, 4, 16] as const;

interface RecipePreviewStageProps {
	slug: string;
	isPortrait: boolean;
	bmpNode?: ReactNode;
	pngNode?: ReactNode;
	reactNode?: ReactNode;
	bmpPipeline?: ReactNode;
	pngPipeline?: ReactNode;
	reactPipeline?: ReactNode;
	defaultFormat?: FormatKey;
}

export function RecipePreviewStage({
	slug,
	isPortrait,
	bmpNode,
	pngNode,
	reactNode,
	bmpPipeline,
	pngPipeline,
	reactPipeline,
	defaultFormat = "bmp",
}: RecipePreviewStageProps) {
	const router = useRouter();
	const [format, setFormat] = useState<FormatKey>(defaultFormat);
	const [presetIdx, setPresetIdx] = useState(0);
	const [bpp, setBpp] = useState<number>(16);

	const preset = SIZE_PRESETS[presetIdx];
	const portraitW = isPortrait ? preset.h : preset.w;
	const portraitH = isPortrait ? preset.w : preset.h;

	const formats: { key: FormatKey; node: ReactNode; pipeline: ReactNode }[] = [
		{
			key: "bmp",
			node: (
				<BmpPreview
					slug={slug}
					width={portraitW}
					height={portraitH}
					bpp={bpp}
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
			nextPortrait ? `/recipes/${slug}?format=portrait` : `/recipes/${slug}`,
		);
	};

	return (
		<div className="overflow-hidden rounded-2xl border bg-card">
			{/* Toolbar */}
			<div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2">
				<div className="flex flex-wrap items-center gap-2">
					{/* Format toggle */}
					<div className="inline-flex items-center gap-0.5 rounded-lg border bg-background p-0.5">
						{formats.map((f) => (
							<button
								key={f.key}
								type="button"
								onClick={() => setFormat(f.key)}
								className={cn(
									"rounded-md px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors",
									format === f.key
										? "bg-primary text-primary-foreground"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								{FORMAT_LABELS[f.key]}
							</button>
						))}
					</div>

					{/* Size presets */}
					<div className="inline-flex items-center gap-0.5 rounded-lg border bg-background p-0.5">
						{SIZE_PRESETS.map((p, i) => (
							<button
								key={p.label}
								type="button"
								onClick={() => setPresetIdx(i)}
								className={cn(
									"rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
									presetIdx === i
										? "bg-foreground text-background"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								{p.label}
								<span className="ml-1 text-[10px] opacity-60">
									{p.w}×{p.h}
								</span>
							</button>
						))}
					</div>

					{/* BPP selector */}
					<div className="inline-flex items-center gap-0.5 rounded-lg border bg-background p-0.5">
						{BPP_OPTIONS.map((b) => (
							<button
								key={b}
								type="button"
								onClick={() => setBpp(b)}
								className={cn(
									"rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
									bpp === b
										? "bg-foreground text-background"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								{b} bpp
							</button>
						))}
					</div>
				</div>

				{/* Orientation toggle */}
				<div className="inline-flex items-center gap-0.5 rounded-lg border bg-background p-0.5">
					<button
						type="button"
						onClick={() => handleOrientationChange(false)}
						className={cn(
							"inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
							!isPortrait
								? "bg-foreground text-background"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						<Monitor className="h-3.5 w-3.5" />
						Landscape
					</button>
					<button
						type="button"
						onClick={() => handleOrientationChange(true)}
						className={cn(
							"inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
							isPortrait
								? "bg-foreground text-background"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						<Smartphone className="h-3.5 w-3.5" />
						Portrait
					</button>
				</div>
			</div>

			{/* Stage */}
			<div className="flex items-center justify-center bg-[radial-gradient(circle_at_50%_0%,theme(colors.muted/40),transparent_70%)] px-6 py-8">
				<div
					className={cn(
						"w-full",
						isPortrait ? "max-w-[360px]" : "max-w-[720px]",
					)}
				>
					<DeviceFrame size="lg" portrait={isPortrait}>
						<div className="absolute inset-0">{active?.node}</div>
					</DeviceFrame>
				</div>
			</div>

			{/* Info bar */}
			<div className="border-t bg-muted/20 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
				<span>
					{format === "bmp" ? `${portraitW}×${portraitH} · ${bpp} bpp` : ""}
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
