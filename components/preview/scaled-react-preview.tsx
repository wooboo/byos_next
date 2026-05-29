interface ScaledReactPreviewProps {
	src: string;
	title: string;
	width: number;
	height: number;
}

export function ScaledReactPreview({
	src,
	title,
	width,
	height,
}: ScaledReactPreviewProps) {
	return (
		<div
			className="absolute inset-0 overflow-hidden bg-white"
			style={{ containerType: "size" }}
		>
			<iframe
				title={title}
				src={src}
				className="block border-0 bg-white"
				style={{
					width: `${width}px`,
					height: `${height}px`,
					transform: `scale(calc(100cqw / ${width}))`,
					transformOrigin: "top left",
				}}
			/>
		</div>
	);
}
