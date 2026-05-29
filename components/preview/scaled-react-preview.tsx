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
	const previewSrc = `${src}${src.includes("?") ? "&" : "?"}mode=${mode}`;

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
				title={title}
				src={previewSrc}
				className="block border-0 bg-white"
				style={{
					width: `${width}px`,
					height: `${height}px`,
					transform: isFit
						? `scale(min(calc(100cqw / ${width}px), calc(100cqh / ${height}px)))`
						: undefined,
					transformOrigin: "top left",
				}}
			/>
		</div>
	);
}
