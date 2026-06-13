import { PreSatori } from "@/utils/pre-satori";

interface ImmichFavoritesProps {
	imageDataUrl?: string;
	width?: number;
	height?: number;
}

export default function ImmichFavorites({
	imageDataUrl = "",
	width = 800,
	height = 480,
}: ImmichFavoritesProps) {
	if (!imageDataUrl) {
		return (
			<PreSatori width={width} height={height} useDoubling={true}>
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
		<PreSatori width={width} height={height} useDoubling={true}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					width: "100%",
					height: "100%",
					backgroundColor: "#fff",
				}}
			>
				{/* biome-ignore lint/performance/noImgElement: Satori-compatible recipe rendering needs a plain img with a data URL. */}
				<img
					src={imageDataUrl}
					alt=""
					style={{
						maxWidth: "100%",
						maxHeight: "100%",
						objectFit: "contain",
					}}
				/>
			</div>
		</PreSatori>
	);
}
