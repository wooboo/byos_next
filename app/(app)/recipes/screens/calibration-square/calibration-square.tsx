import { PreSatori } from "@/utils/pre-satori";

export default function CalibrationSquare({
	width = 800,
	height = 480,
}: {
	width?: number;
	height?: number;
}) {
	return (
		<PreSatori width={width} height={height}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					width: "100%",
					height: "100%",
					backgroundColor: "#000",
				}}
			>
				{/* Single 200×200 white square */}
				<div
					style={{
						width: 200,
						height: 200,
						backgroundColor: "#fff",
					}}
				/>
			</div>
		</PreSatori>
	);
}
