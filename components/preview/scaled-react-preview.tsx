"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { ReactPreviewMode } from "./screen-preview-controls";

interface ScaledReactPreviewProps {
	src: string;
	title: string;
	width: number;
	height: number;
	mode?: ReactPreviewMode;
}

export function ScaledReactPreview({
	src,
	title,
	width,
	height,
	mode = "fit",
}: ScaledReactPreviewProps) {
	const isFit = mode === "fit";
	const previewSrc = `${src}${src.includes("?") ? "&" : "?"}mode=scroll`;
	const [contentSize, setContentSize] = useState({ width, height });
	const frameWidth = isFit ? Math.max(width, contentSize.width) : width;
	const frameHeight = isFit ? Math.max(height, contentSize.height) : height;

	useEffect(() => {
		setContentSize({ width, height });
	}, [width, height]);

	const measureContent = useCallback(
		(node: HTMLIFrameElement | null) => {
			if (!node || !isFit) return;

			const measure = () => {
				const doc = node.contentDocument;
				if (!doc) return;

				const body = doc.body;
				const root = doc.documentElement;
				const rects = Array.from(body.querySelectorAll("*"), (element) =>
					element.getBoundingClientRect(),
				);
				const visualWidth = Math.max(
					0,
					...rects.map((rect) => rect.left + rect.width),
				);
				const visualHeight = Math.max(
					0,
					...rects.map((rect) => rect.top + rect.height),
				);
				setContentSize({
					width: Math.ceil(
						Math.max(
							width,
							body?.scrollWidth ?? 0,
							root.scrollWidth,
							visualWidth,
						),
					),
					height: Math.ceil(
						Math.max(
							height,
							body?.scrollHeight ?? 0,
							root.scrollHeight,
							visualHeight,
						),
					),
				});
			};

			node.addEventListener("load", measure, { once: true });
			window.setTimeout(measure, 250);
			window.setTimeout(measure, 1000);
		},
		[height, isFit, width],
	);

	return (
		<div
			className={cn(
				"absolute inset-0 bg-white [scrollbar-color:theme(colors.muted-foreground)_theme(colors.muted)] [scrollbar-width:thin]",
				"[&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/70 [&::-webkit-scrollbar-track]:bg-muted",
				isFit ? "overflow-hidden" : "overflow-scroll",
			)}
			style={{ containerType: "size" }}
		>
			<iframe
				ref={measureContent}
				title={title}
				src={previewSrc}
				className="block border-0 bg-white"
				style={{
					width: `${frameWidth}px`,
					height: `${frameHeight}px`,
					transform: isFit
						? `scale(min(calc(100cqw / ${frameWidth}px), calc(100cqh / ${frameHeight}px)))`
						: undefined,
					transformOrigin: "top left",
				}}
			/>
		</div>
	);
}
