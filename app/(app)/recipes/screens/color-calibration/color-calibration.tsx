import type { CSSProperties } from "react";
import { PreSatori } from "@/utils/pre-satori";

type ColorCalibrationParams = {
	pattern?: unknown;
	showLabels?: unknown;
};

type ColorCalibrationProps = {
	width?: number;
	height?: number;
	params?: ColorCalibrationParams;
};

type CalibrationColor = {
	index?: number;
	name: string;
	hex: string;
	label: string;
	textColor?: string;
};

const DEVICE_PALETTE: CalibrationColor[] = [
	{
		index: 0,
		name: "black",
		hex: "#000000",
		label: "0 black",
		textColor: "#fff",
	},
	{
		index: 1,
		name: "white",
		hex: "#ffffff",
		label: "1 white",
		textColor: "#000",
	},
	{
		index: 2,
		name: "yellow",
		hex: "#fff338",
		label: "2 yellow",
		textColor: "#000",
	},
	{ index: 3, name: "red", hex: "#bf0000", label: "3 red", textColor: "#fff" },
	{
		index: 5,
		name: "blue",
		hex: "#6440ff",
		label: "5 blue",
		textColor: "#fff",
	},
	{
		index: 6,
		name: "green",
		hex: "#438a1c",
		label: "6 green",
		textColor: "#fff",
	},
];

const HIGHLIGHT_SAMPLES: CalibrationColor[] = [
	{ name: "wall white", hex: "#ffffff", label: "wall 255" },
	{ name: "warm white", hex: "#f7f6ed", label: "wall 247" },
	{ name: "soft white", hex: "#efecde", label: "wall 239" },
	{ name: "bright neutral", hex: "#e1e0d3", label: "wall 225" },
	{ name: "neutral", hex: "#d7d4c8", label: "wall 215" },
	{ name: "gray", hex: "#c9c9c9", label: "gray 201" },
	{ name: "mid gray", hex: "#b6b6b6", label: "gray 182" },
	{ name: "dark gray", hex: "#999999", label: "gray 153" },
];

const PHOTO_TONE_SAMPLES: CalibrationColor[] = [
	{ name: "skin", hex: "#f0c7a8", label: "skin" },
	{ name: "wood", hex: "#b77945", label: "wood" },
	{ name: "sky", hex: "#8fbbe8", label: "sky" },
	{ name: "grass", hex: "#5f9b42", label: "grass" },
	{ name: "brick", hex: "#a64335", label: "brick" },
	{ name: "shadow", hex: "#46424a", label: "shadow" },
];

const GRADIENTS = [
	{ label: "white-black", from: "#ffffff", to: "#000000" },
	{ label: "wall-shadow", from: "#ffffff", to: "#999999" },
	{ label: "warm-wall", from: "#ffffff", to: "#d7d4c8" },
	{ label: "white-yellow", from: "#ffffff", to: "#fff338" },
	{ label: "white-red", from: "#ffffff", to: "#bf0000" },
	{ label: "white-blue", from: "#ffffff", to: "#6440ff" },
	{ label: "white-green", from: "#ffffff", to: "#438a1c" },
	{ label: "sky", from: "#ffffff", to: "#8fbbe8" },
	{ label: "skin", from: "#ffffff", to: "#f0c7a8" },
	{ label: "grass", from: "#ffffff", to: "#5f9b42" },
	{ label: "red-yellow", from: "#bf0000", to: "#fff338" },
	{ label: "blue-green", from: "#6440ff", to: "#438a1c" },
] as const;
type GradientDefinition = (typeof GRADIENTS)[number];

const MIX_PAIRS: Array<{
	label: string;
	first: CalibrationColor;
	second: CalibrationColor;
}> = [
	{ label: "white/black", first: DEVICE_PALETTE[1], second: DEVICE_PALETTE[0] },
	{
		label: "white/yellow",
		first: DEVICE_PALETTE[1],
		second: DEVICE_PALETTE[2],
	},
	{ label: "white/red", first: DEVICE_PALETTE[1], second: DEVICE_PALETTE[3] },
	{ label: "white/blue", first: DEVICE_PALETTE[1], second: DEVICE_PALETTE[4] },
	{ label: "white/green", first: DEVICE_PALETTE[1], second: DEVICE_PALETTE[5] },
	{ label: "yellow/red", first: DEVICE_PALETTE[2], second: DEVICE_PALETTE[3] },
];

const MIX_MATRIX_PAIRS: Array<{
	label: string;
	first: CalibrationColor;
	second: CalibrationColor;
}> = [
	...MIX_PAIRS,
	{
		label: "yellow/green",
		first: DEVICE_PALETTE[2],
		second: DEVICE_PALETTE[5],
	},
	{ label: "red/blue", first: DEVICE_PALETTE[3], second: DEVICE_PALETTE[4] },
	{ label: "blue/green", first: DEVICE_PALETTE[4], second: DEVICE_PALETTE[5] },
	{ label: "black/red", first: DEVICE_PALETTE[0], second: DEVICE_PALETTE[3] },
	{ label: "black/blue", first: DEVICE_PALETTE[0], second: DEVICE_PALETTE[4] },
	{ label: "black/green", first: DEVICE_PALETTE[0], second: DEVICE_PALETTE[5] },
];

const PATTERN_NAMES = new Set([
	"overview",
	"palette",
	"highlights",
	"mixes",
	"gradients",
]);

const normalizePattern = (value: unknown) => {
	if (typeof value !== "string") return "overview";
	const normalized = value.trim().toLowerCase();
	return PATTERN_NAMES.has(normalized) ? normalized : "overview";
};

const labelsEnabled = (value: unknown) =>
	value !== false && value !== "false" && value !== "0" && value !== "no";

const hexToRgb = (hex: string): [number, number, number] => [
	Number.parseInt(hex.slice(1, 3), 16),
	Number.parseInt(hex.slice(3, 5), 16),
	Number.parseInt(hex.slice(5, 7), 16),
];

const rgbToHex = ([red, green, blue]: [number, number, number]) =>
	`#${[red, green, blue]
		.map((channel) => channel.toString(16).padStart(2, "0"))
		.join("")}`;

const mixHex = (from: string, to: string, ratio: number) => {
	const fromRgb = hexToRgb(from);
	const toRgb = hexToRgb(to);
	return rgbToHex([
		Math.round(fromRgb[0] + (toRgb[0] - fromRgb[0]) * ratio),
		Math.round(fromRgb[1] + (toRgb[1] - fromRgb[1]) * ratio),
		Math.round(fromRgb[2] + (toRgb[2] - fromRgb[2]) * ratio),
	]);
};

const readableTextColor = (hex: string) => {
	const [red, green, blue] = hexToRgb(hex);
	const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;
	return luminance >= 150 ? "#000" : "#fff";
};

const rootStyle = (width: number, height: number): CSSProperties => ({
	display: "flex",
	flexDirection: "column",
	width,
	height,
	backgroundColor: "#fff",
	color: "#000",
	fontFamily: "monospace",
	overflow: "hidden",
});

const labelStyle = (
	fontSize: number,
	textColor: string,
	align: "center" | "left" = "center",
): CSSProperties => ({
	display: "flex",
	flexDirection: "column",
	alignItems: align === "center" ? "center" : "flex-start",
	justifyContent: "center",
	color: textColor,
	fontSize,
	fontWeight: 700,
	lineHeight: 1.1,
	textAlign: align,
});

function Header({ fontSize, title }: { fontSize: number; title: string }) {
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				width: "100%",
				height: Math.round(fontSize * 2.4),
				padding: `0 ${Math.round(fontSize * 0.8)}px`,
				backgroundColor: "#fff",
				color: "#000",
				borderBottom: "2px solid #000",
				boxSizing: "border-box",
				fontSize,
				fontWeight: 700,
			}}
		>
			<span>{title}</span>
			<span>native RGB - ED2208</span>
		</div>
	);
}

function ColorStrip({
	colors,
	height,
	showLabels,
	fontSize,
}: {
	colors: CalibrationColor[];
	height: number | string;
	showLabels: boolean;
	fontSize: number;
}) {
	return (
		<div style={{ display: "flex", width: "100%", height }}>
			{colors.map((color) => (
				<div
					key={`${color.label}-${color.hex}`}
					style={{
						display: "flex",
						flex: 1,
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: color.hex,
						borderRight: "1px solid #000",
						boxSizing: "border-box",
					}}
				>
					{showLabels ? (
						<div
							style={labelStyle(
								fontSize,
								color.textColor ?? readableTextColor(color.hex),
							)}
						>
							<span>{color.label}</span>
							<span>{color.hex.toUpperCase()}</span>
						</div>
					) : null}
				</div>
			))}
		</div>
	);
}

function CheckerTile({
	first,
	second,
	label,
	showLabels,
	fontSize,
}: {
	first: CalibrationColor;
	second: CalibrationColor;
	label: string;
	showLabels: boolean;
	fontSize: number;
}) {
	const gridSize = 8;
	const cells = Array.from({ length: gridSize * gridSize }, (_, index) => {
		const x = index % gridSize;
		const y = Math.floor(index / gridSize);
		return (x + y) % 2 === 0 ? first.hex : second.hex;
	});

	return (
		<div
			style={{
				display: "flex",
				flex: 1,
				flexDirection: "column",
				minWidth: 0,
				borderRight: "1px solid #000",
				boxSizing: "border-box",
			}}
		>
			<div
				style={{
					display: "flex",
					flex: 1,
					flexWrap: "wrap",
					width: "100%",
					minHeight: 0,
				}}
			>
				{cells.map((hex, index) => (
					<div
						key={`${label}-${index}`}
						style={{
							width: `${100 / gridSize}%`,
							height: `${100 / gridSize}%`,
							backgroundColor: hex,
						}}
					/>
				))}
			</div>
			{showLabels ? (
				<div
					style={{
						...labelStyle(Math.max(9, Math.round(fontSize * 0.8)), "#000"),
						height: Math.round(fontSize * 1.8),
						backgroundColor: "#fff",
						borderTop: "1px solid #000",
					}}
				>
					{label}
				</div>
			) : null}
		</div>
	);
}

function MixStrip({
	pairs,
	height,
	showLabels,
	fontSize,
}: {
	pairs: typeof MIX_PAIRS;
	height: number | string;
	showLabels: boolean;
	fontSize: number;
}) {
	return (
		<div style={{ display: "flex", width: "100%", height }}>
			{pairs.map((pair) => (
				<CheckerTile
					key={pair.label}
					first={pair.first}
					second={pair.second}
					label={pair.label}
					showLabels={showLabels}
					fontSize={fontSize}
				/>
			))}
		</div>
	);
}

function GradientRow({
	from,
	to,
	label,
	showLabels,
	fontSize,
	steps = 40,
}: {
	from: string;
	to: string;
	label: string;
	showLabels: boolean;
	fontSize: number;
	steps?: number;
}) {
	const colors = Array.from({ length: steps }, (_, index) =>
		mixHex(from, to, steps === 1 ? 0 : index / (steps - 1)),
	);

	return (
		<div
			style={{
				display: "flex",
				position: "relative",
				width: "100%",
				flex: 1,
				minHeight: 0,
				borderBottom: "1px solid #000",
				boxSizing: "border-box",
			}}
		>
			{colors.map((hex, index) => (
				<div
					key={`${label}-${hex}-${index}`}
					style={{
						flex: 1,
						backgroundColor: hex,
					}}
				/>
			))}
			{showLabels ? (
				<div
					style={{
						...labelStyle(Math.max(9, Math.round(fontSize * 0.75)), "#000"),
						position: "absolute",
						left: Math.round(fontSize * 0.4),
						top: 0,
						bottom: 0,
						justifyContent: "center",
						textShadow: "1px 0 #fff, -1px 0 #fff, 0 1px #fff, 0 -1px #fff",
					}}
				>
					{label}
				</div>
			) : null}
		</div>
	);
}

function GradientPanel({
	height,
	showLabels,
	fontSize,
	gradients = GRADIENTS,
	steps,
}: {
	height: number | string;
	showLabels: boolean;
	fontSize: number;
	gradients?: readonly GradientDefinition[];
	steps?: number;
}) {
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				width: "100%",
				height,
				minHeight: 0,
			}}
		>
			{gradients.map((gradient) => (
				<GradientRow
					key={gradient.label}
					from={gradient.from}
					to={gradient.to}
					label={gradient.label}
					showLabels={showLabels}
					fontSize={fontSize}
					steps={steps}
				/>
			))}
		</div>
	);
}

function Overview({
	fontSize,
	showLabels,
}: {
	fontSize: number;
	showLabels: boolean;
}) {
	return (
		<>
			{showLabels ? (
				<Header fontSize={fontSize} title="Color calibration" />
			) : null}
			<ColorStrip
				colors={DEVICE_PALETTE}
				height={showLabels ? "26%" : "32%"}
				showLabels={showLabels}
				fontSize={fontSize}
			/>
			<ColorStrip
				colors={HIGHLIGHT_SAMPLES}
				height="18%"
				showLabels={showLabels}
				fontSize={Math.max(9, Math.round(fontSize * 0.75))}
			/>
			<ColorStrip
				colors={PHOTO_TONE_SAMPLES}
				height="18%"
				showLabels={showLabels}
				fontSize={Math.max(9, Math.round(fontSize * 0.8))}
			/>
			<GradientPanel
				height="14%"
				showLabels={showLabels}
				fontSize={fontSize}
				gradients={GRADIENTS.slice(0, 3)}
				steps={32}
			/>
			<MixStrip
				pairs={MIX_PAIRS}
				height={showLabels ? "16%" : "18%"}
				showLabels={showLabels}
				fontSize={fontSize}
			/>
		</>
	);
}

function MixMatrix({
	fontSize,
	showLabels,
}: {
	fontSize: number;
	showLabels: boolean;
}) {
	const firstRow = MIX_MATRIX_PAIRS.slice(0, 6);
	const secondRow = MIX_MATRIX_PAIRS.slice(6);

	return (
		<>
			{showLabels ? (
				<Header fontSize={fontSize} title="Color mix matrix" />
			) : null}
			<MixStrip
				pairs={firstRow}
				height="50%"
				showLabels={showLabels}
				fontSize={fontSize}
			/>
			<MixStrip
				pairs={secondRow}
				height="50%"
				showLabels={showLabels}
				fontSize={fontSize}
			/>
		</>
	);
}

export default function ColorCalibration({
	width = 800,
	height = 480,
	params,
}: ColorCalibrationProps) {
	const pattern = normalizePattern(params?.pattern);
	const showLabels = labelsEnabled(params?.showLabels);
	const fontSize = Math.max(10, Math.round(Math.min(width / 44, height / 28)));

	return (
		<PreSatori width={width} height={height}>
			<div style={rootStyle(width, height)}>
				{pattern === "palette" ? (
					<>
						{showLabels ? (
							<Header fontSize={fontSize} title="Native palette" />
						) : null}
						<ColorStrip
							colors={DEVICE_PALETTE}
							height="100%"
							showLabels={showLabels}
							fontSize={fontSize}
						/>
					</>
				) : null}
				{pattern === "highlights" ? (
					<>
						{showLabels ? (
							<Header fontSize={fontSize} title="Highlight calibration" />
						) : null}
						<ColorStrip
							colors={HIGHLIGHT_SAMPLES}
							height="50%"
							showLabels={showLabels}
							fontSize={fontSize}
						/>
						<ColorStrip
							colors={PHOTO_TONE_SAMPLES}
							height="50%"
							showLabels={showLabels}
							fontSize={fontSize}
						/>
					</>
				) : null}
				{pattern === "mixes" ? (
					<MixMatrix fontSize={fontSize} showLabels={showLabels} />
				) : null}
				{pattern === "gradients" ? (
					<>
						{showLabels ? (
							<Header fontSize={fontSize} title="Gradient calibration" />
						) : null}
						<GradientPanel
							height="100%"
							showLabels={showLabels}
							fontSize={fontSize}
							steps={64}
						/>
					</>
				) : null}
				{pattern === "overview" ? (
					<Overview fontSize={fontSize} showLabels={showLabels} />
				) : null}
			</div>
		</PreSatori>
	);
}
