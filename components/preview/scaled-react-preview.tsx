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

	return (
		<div
			className={cn(
				"absolute inset-0 bg-white",
				isFit ? "overflow-hidden" : "overflow-auto",
			)}
			style={{ containerType: "size" }}
		>
			<iframe
				title={title}
				src={src}
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
