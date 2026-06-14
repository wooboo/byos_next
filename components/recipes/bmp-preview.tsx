"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

interface BmpPreviewProps {
	slug: string;
	width: number;
	height: number;
	bpp: number;
	bitmapUrl?: string;
}

export function getBmpPreviewRequestUrl({
	slug,
	width,
	height,
	bpp,
	bitmapUrl,
}: BmpPreviewProps) {
	const url = bitmapUrl ?? `/api/bitmap/${slug}.bmp`;
	const separator = url.includes("?") ? "&" : "?";

	return `${url}${separator}width=${width}&height=${height}&grayscale=${bpp}`;
}

export async function fetchBmpPreviewObjectUrl({
	requestUrl,
	fetcher = fetch,
	createObjectUrl = URL.createObjectURL,
}: {
	requestUrl: string;
	fetcher?: typeof fetch;
	createObjectUrl?: typeof URL.createObjectURL;
}) {
	const response = await fetcher(requestUrl);
	if (!response.ok) throw new Error(`HTTP ${response.status}`);

	const blob = await response.blob();
	return createObjectUrl(blob);
}

export function BmpPreviewContent({
	loading,
	error,
	src,
	width,
	height,
}: {
	loading: boolean;
	error: boolean;
	src: string;
	width: number;
	height: number;
}) {
	if (loading) {
		return (
			<div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-neutral-500">
				<span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
				Rendering…
			</div>
		);
	}

	if (error || !src) {
		return (
			<div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-500">
				Failed to render
			</div>
		);
	}

	return (
		<Image
			src={src}
			alt="BMP preview"
			width={width}
			height={height}
			className="absolute inset-0 h-full w-full object-cover"
			style={{ imageRendering: "pixelated" }}
			unoptimized
		/>
	);
}

export function startBmpPreviewRequest({
	requestUrl,
	setSrc,
	setLoading,
	setError,
	fetchPreview = fetchBmpPreviewObjectUrl,
	revokeObjectUrl = URL.revokeObjectURL,
}: {
	requestUrl: string;
	setSrc: (value: string) => void;
	setLoading: (value: boolean) => void;
	setError: (value: boolean) => void;
	fetchPreview?: typeof fetchBmpPreviewObjectUrl;
	revokeObjectUrl?: typeof URL.revokeObjectURL;
}) {
	let cancelled = false;
	let objectUrl = "";

	setLoading(true);
	setError(false);

	void fetchPreview({ requestUrl })
		.then((nextObjectUrl) => {
			if (cancelled) return;
			objectUrl = nextObjectUrl;
			setSrc(objectUrl);
			setLoading(false);
		})
		.catch(() => {
			if (!cancelled) {
				setError(true);
				setLoading(false);
			}
		});

	return () => {
		cancelled = true;
		if (objectUrl) revokeObjectUrl(objectUrl);
	};
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
	const [src, setSrc] = useState("");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);

	useEffect(() => {
		const requestUrl = getBmpPreviewRequestUrl({
			slug,
			width,
			height,
			bpp,
			bitmapUrl,
		});

		return startBmpPreviewRequest({
			requestUrl,
			setSrc,
			setLoading,
			setError,
		});
	}, [slug, width, height, bpp, bitmapUrl]);

	return (
		<BmpPreviewContent
			loading={loading}
			error={error}
			src={src}
			width={width}
			height={height}
		/>
	);
}
