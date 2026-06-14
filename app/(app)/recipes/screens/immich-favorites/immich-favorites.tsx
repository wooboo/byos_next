import { PreSatori } from "@/utils/pre-satori";

interface ImmichFavoritesProps {
	imageDataUrl?: string;
	width?: number;
	height?: number;
	disableDoubling?: boolean;
}

export default function ImmichFavorites({
	imageDataUrl = "",
	width = 800,
	height = 480,
	disableDoubling = false,
}: ImmichFavoritesProps) {
	if (!imageDataUrl) {
		return (
			<PreSatori width={width} height={height} useDoubling={!disableDoubling}>
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						width: "100%",
						height: "100%",
						backgroundColor: "#fff",
						alignItems: "center",
						justifyContent: "center",
						fontFamily: "inter",
					}}
				>
					<span style={{ fontSize: 16, color: "#999" }}>
						Brak zdjęć w ulubionych
					</span>
				</div>
			</PreSatori>
		);
	}

	return (
		<PreSatori width={width} height={height} useDoubling={!disableDoubling}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					width: "100%",
					height: "100%",
					backgroundColor: "#fff",
					position: "relative",
					overflow: "hidden",
				}}
			>
				{/* biome-ignore lint/performance/noImgElement: Satori-compatible recipe rendering needs a plain img with a data URL. */}
				<img
					src={imageDataUrl}
					alt=""
					width={width}
					height={height}
					style={{
						display: "block",
						position: "absolute",
						inset: 0,
						width: "100%",
						height: "100%",
						objectFit: "contain",
					}}
				/>
			</div>
		</PreSatori>
	);
}
