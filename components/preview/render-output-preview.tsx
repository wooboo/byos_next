import Image from "next/image";

type EncodedRender = {
	toString(encoding: "base64"): string;
};

export type RenderOutputFormat = "bitmap" | "png";
type RenderOutputs = Partial<Record<RenderOutputFormat, EncodedRender | null>>;

export function EmptyRenderState({ children }: { children: React.ReactNode }) {
	return (
		<div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-500">
			{children}
		</div>
	);
}

export function RenderLoadingState({ label }: { label: string }) {
	return (
		<div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-neutral-500">
			<span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
			{label}
		</div>
	);
}

export function ScaledRenderPreview({
	imageWidth,
	imageHeight,
	children,
}: {
	imageWidth: number;
	imageHeight: number;
	children: React.ReactNode;
}) {
	return (
		<div
			className="absolute inset-0"
			style={{ containerType: "inline-size" } as React.CSSProperties}
		>
			<div
				style={{
					width: `${imageWidth}px`,
					height: `${imageHeight}px`,
					transform: `scale(calc(100cqi / ${imageWidth}px))`,
					transformOrigin: "top left",
				}}
			>
				{children}
			</div>
		</div>
	);
}

export function RenderOutputImage({
	format,
	image,
	title,
	imageWidth,
	imageHeight,
}: {
	format: RenderOutputFormat;
	image: EncodedRender | null | undefined;
	title: string;
	imageWidth: number;
	imageHeight: number;
}) {
	if (!image) {
		return (
			<EmptyRenderState>
				Failed to generate {format === "bitmap" ? "bitmap" : "PNG"}
			</EmptyRenderState>
		);
	}

	const imageType = format === "bitmap" ? "bmp" : "png";
	const label = format === "bitmap" ? "BMP" : "PNG";

	return (
		<Image
			width={imageWidth}
			height={imageHeight}
			src={`data:image/${imageType};base64,${image.toString("base64")}`}
			style={{ imageRendering: "pixelated" }}
			alt={`${title} ${label} render`}
			className="absolute inset-0 h-full w-full object-cover"
		/>
	);
}

export function RenderOutputForFormat({
	format,
	renders,
	title,
	imageWidth,
	imageHeight,
}: {
	format: RenderOutputFormat;
	renders: RenderOutputs;
	title: string;
	imageWidth: number;
	imageHeight: number;
}) {
	return (
		<RenderOutputImage
			format={format}
			image={renders[format]}
			title={title}
			imageWidth={imageWidth}
			imageHeight={imageHeight}
		/>
	);
}
