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
		let cancelled = false;
		let objectUrl = "";
		setLoading(true);
		setError(false);

		const url = bitmapUrl ?? `/api/bitmap/${slug}.bmp`;
		const separator = url.includes("?") ? "&" : "?";
		const requestUrl = `${url}${separator}width=${width}&height=${height}&grayscale=${bpp}`;

		fetch(requestUrl)
			.then(async (res) => {
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const blob = await res.blob();
				if (cancelled) return;
				objectUrl = URL.createObjectURL(blob);
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
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	}, [slug, width, height, bpp, bitmapUrl]);

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
