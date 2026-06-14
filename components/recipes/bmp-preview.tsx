"use client";

import { useState } from "react";

interface BmpPreviewProps {
	slug: string;
	width: number;
	height: number;
	bpp: number;
	bitmapUrl?: string;
}

interface ImageEndpointPreviewProps {
	alt: string;
	height: number;
	imageRendering?: React.CSSProperties["imageRendering"];
	requestUrl: string;
	width: number;
}

export function getBmpPreviewRequestUrl({
	slug,
	width,
	height,
	bpp,
	bitmapUrl,
}: BmpPreviewProps) {
	const url = bitmapUrl ?? `/api/bitmap/${slug}/default.bmp`;
	const separator = url.includes("?") ? "&" : "?";

	return `${url}${separator}width=${width}&height=${height}&bpp=${bpp}`;
}

export function ImageEndpointPreviewContent({
	alt,
	error,
	loading,
	src,
	width,
	height,
	imageRendering,
	onError,
	onLoad,
}: {
	alt: string;
	error: boolean;
	loading: boolean;
	src: string;
	width: number;
	height: number;
	imageRendering?: React.CSSProperties["imageRendering"];
	onError?: () => void;
	onLoad?: () => void;
}) {
	if (error || !src) {
		return (
			<div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-500">
				Failed to render
			</div>
		);
	}

	return (
		<>
			{loading && (
				<div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-background/70 text-sm text-muted-foreground backdrop-blur-[1px]">
					<span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
					Rendering…
				</div>
			)}
			{/* biome-ignore lint/performance/noImgElement: Render previews must use the exact API URL and support BMP responses. */}
			<img
				src={src}
				alt={alt}
				width={width}
				height={height}
				className="absolute inset-0 h-full w-full object-contain"
				style={imageRendering ? { imageRendering } : undefined}
				onError={onError}
				onLoad={onLoad}
			/>
		</>
	);
}

export const BmpPreviewContent = (
	props: Omit<
		React.ComponentProps<typeof ImageEndpointPreviewContent>,
		"alt" | "imageRendering"
	>,
) => (
	<ImageEndpointPreviewContent
		{...props}
		alt="BMP preview"
		imageRendering="pixelated"
	/>
);

export function ImageEndpointPreview({
	alt,
	height,
	imageRendering,
	requestUrl,
	width,
}: ImageEndpointPreviewProps) {
	return (
		<ImageEndpointPreviewWithState
			key={requestUrl}
			alt={alt}
			height={height}
			imageRendering={imageRendering}
			requestUrl={requestUrl}
			width={width}
		/>
	);
}

function ImageEndpointPreviewWithState({
	alt,
	height,
	imageRendering,
	requestUrl,
	width,
}: ImageEndpointPreviewProps) {
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(true);

	return (
		<ImageEndpointPreviewContent
			alt={alt}
			error={error}
			loading={loading}
			src={requestUrl}
			width={width}
			height={height}
			imageRendering={imageRendering}
			onError={() => {
				setError(true);
				setLoading(false);
			}}
			onLoad={() => setLoading(false)}
		/>
	);
}

/**
 * Fetches and displays a BMP preview from the API with given size/bpp params.
 * Re-fetches whenever params change.
 */
export function BmpPreview({
	slug,
	width,
	height,
	bpp,
	bitmapUrl,
}: BmpPreviewProps) {
	return (
		<ImageEndpointPreview
			alt="BMP preview"
			requestUrl={getBmpPreviewRequestUrl({
				slug,
				width,
				height,
				bpp,
				bitmapUrl,
			})}
			width={width}
			height={height}
			imageRendering="pixelated"
		/>
	);
}
