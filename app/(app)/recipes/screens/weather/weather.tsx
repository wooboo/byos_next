import { PreSatori } from "@/utils/pre-satori";
import {
	CloudIcon,
	FogIcon,
	humidityIcon,
	pressureIcon,
	RainIcon,
	SnowIcon,
	SunIcon,
	sunriseIcon,
	sunsetIcon,
	ThunderIcon,
	tempDown,
	tempIcon,
	tempUp,
	windIcon,
} from "./icons";

interface WeatherProps {
	temperature?: string;
	feelsLike?: string;
	humidity?: string;
	windSpeed?: string;
	description?: string;
	location?: string;
	lastUpdated?: string;
	highTemp?: string;
	lowTemp?: string;
	pressure?: string;
	sunset?: string;
	sunrise?: string;
	width?: number;
	height?: number;
}

// ─── Layout ──────────────────────────────────────────────────────────────
// Keep one canonical weather layout. Larger displays (TRMNL X) should render
// the same composition at higher resolution instead of reflowing/re-scaling
// individual pieces from the physical width.
const BASE_W = 800;
const BASE_H = 480;
function sc() {
	return {
		f: (n: number) => Math.round(n),
		p: (n: number) => Math.round(n),
		b: (n: number) => Math.max(1, Math.round(n)),
		g: (n: number) => Math.round(n),
	};
}
function t(
	s: ReturnType<typeof sc>,
	size: number,
	weight = 400,
	more: Record<string, unknown> = {},
) {
	return {
		fontFamily: "inter",
		fontSize: s.f(size),
		fontWeight: weight,
		lineHeight: 1.15,
		...more,
	};
}
const fr = { display: "flex", flexDirection: "row" } as const;
const fc = { display: "flex", flexDirection: "column" } as const;

// ─── Component ───────────────────────────────────────────────────────────
export default function Weather({
	temperature = "N/A",
	feelsLike = "N/A",
	humidity = "N/A",
	windSpeed = "N/A",
	description = "N/A",
	location = "N/A",
	lastUpdated = "",
	highTemp = "N/A",
	lowTemp = "N/A",
	pressure = "N/A",
	sunset = "N/A",
	sunrise = "N/A",
	width = 800,
	height = 480,
}: WeatherProps) {
	const s = sc();
	const layoutScale = Math.min(width / BASE_W, height / BASE_H);
	const offsetX = Math.round((width - BASE_W * layoutScale) / 2);
	const offsetY = Math.round((height - BASE_H * layoutScale) / 2);

	const stats = [
		{ label: "Feels Like", value: `${feelsLike}°`, Icon: tempIcon },
		{ label: "Humidity", value: `${humidity}%`, Icon: humidityIcon },
		{ label: "Wind", value: `${windSpeed} km/h`, Icon: windIcon },
		{ label: "Pressure", value: `${pressure} hPa`, Icon: pressureIcon },
		{ label: "Sunrise", value: sunrise, Icon: sunriseIcon },
		{ label: "Sunset", value: sunset, Icon: sunsetIcon },
	];

	const d = description.toLowerCase();
	let MainIcon = CloudIcon;
	if (d.includes("rain") || d.includes("drizzle")) MainIcon = RainIcon;
	else if (d.includes("snow")) MainIcon = SnowIcon;
	else if (d.includes("clear") || d.includes("sun")) MainIcon = SunIcon;
	else if (d.includes("fog") || d.includes("mist")) MainIcon = FogIcon;
	else if (d.includes("thunder")) MainIcon = ThunderIcon;

	const isPortrait = height > width;

	if (isPortrait) {
		const portraitPadding = Math.max(10, Math.round(width * 0.035));
		const cardGap = Math.max(5, Math.round(height * 0.01));
		const iconSize = Math.max(70, Math.round(width * 0.22));
		const statIconSize = Math.max(22, Math.round(width * 0.065));

		return (
			<PreSatori useDoubling={true} width={width} height={height}>
				<div
					style={{
						...fc,
						width: "100%",
						height: "100%",
						backgroundColor: "#fff",
						overflow: "hidden",
						padding: portraitPadding,
						fontFamily: "inter",
						gap: cardGap,
					}}
				>
					<div
						style={{
							...fc,
							alignItems: "center",
							justifyContent: "center",
							borderWidth: 2,
							borderStyle: "solid",
							borderColor: "#000",
							borderRadius: 12,
							padding: portraitPadding,
							flexShrink: 0,
							gap: 4,
						}}
					>
						<div style={{ ...fr, alignItems: "baseline", gap: 4 }}>
							<span
								style={t(s, Math.round(width * 0.18), 800, { lineHeight: 1 })}
							>
								{temperature}
							</span>
							<span
								style={t(s, Math.round(width * 0.055), 500, { lineHeight: 1 })}
							>
								°C
							</span>
						</div>
						<MainIcon size={iconSize} />
						<div style={{ ...fr, gap: Math.max(16, Math.round(width * 0.08)) }}>
							<span style={{ display: "flex", alignItems: "center", gap: 4 }}>
								{tempUp({ size: Math.round(width * 0.055) })}
								<span style={t(s, Math.round(width * 0.045), 700)}>
									{highTemp}°
								</span>
							</span>
							<span style={{ display: "flex", alignItems: "center", gap: 4 }}>
								{tempDown({ size: Math.round(width * 0.055) })}
								<span style={t(s, Math.round(width * 0.045), 700)}>
									{lowTemp}°
								</span>
							</span>
						</div>
						<span style={t(s, Math.round(width * 0.055), 700)}>
							{description}
						</span>
					</div>

					<div style={{ ...fc, flex: "1 1 0", minHeight: 0, gap: cardGap }}>
						{stats.map((stat) => (
							<div
								key={stat.label}
								style={{
									...fr,
									alignItems: "center",
									borderRadius: 9,
									borderWidth: 2,
									borderStyle: "solid",
									borderColor: "#000",
									padding: `${Math.max(5, Math.round(height * 0.008))}px ${Math.max(8, Math.round(width * 0.025))}px`,
									gap: Math.max(8, Math.round(width * 0.025)),
									flex: "1 1 0",
									minHeight: 0,
								}}
							>
								<stat.Icon size={statIconSize} />
								<div style={{ ...fc, justifyContent: "center", minWidth: 0 }}>
									<span
										style={t(s, Math.round(width * 0.034), 600, {
											color: "#444",
										})}
									>
										{stat.label}
									</span>
									<span style={t(s, Math.round(width * 0.045), 800)}>
										{stat.value}
									</span>
								</div>
							</div>
						))}
					</div>

					<div
						style={{
							...fr,
							justifyContent: "space-between",
							alignItems: "center",
							backgroundColor: "#000",
							color: "#fff",
							padding: `${Math.max(6, Math.round(height * 0.012))}px ${Math.max(8, Math.round(width * 0.025))}px`,
							borderRadius: 9,
							flexShrink: 0,
							gap: 8,
						}}
					>
						<span style={t(s, Math.round(width * 0.034), 700)}>{location}</span>
						{lastUpdated && (
							<span style={t(s, Math.round(width * 0.028), 500)}>
								Updated: {lastUpdated}
							</span>
						)}
					</div>
				</div>
			</PreSatori>
		);
	}

	return (
		<PreSatori useDoubling={true} width={width} height={height}>
			<div
				style={{
					display: "flex",
					width: "100%",
					height: "100%",
					backgroundColor: "#fff",
					overflow: "hidden",
				}}
			>
				<div
					style={{
						...fc,
						width: BASE_W,
						height: BASE_H,
						backgroundColor: "#fff",
						transform: `translate(${offsetX}px, ${offsetY}px) scale(${layoutScale})`,
						transformOrigin: "top left",
					}}
				>
					{/* ── TOP ROW ── */}
					<div
						style={{
							...fr,
							alignItems: "center",
							justifyContent: "space-between",
							padding: s.p(6),
							flexShrink: 0,
							gap: s.g(8),
						}}
					>
						<div
							style={{ display: "flex", alignItems: "baseline", gap: s.g(4) }}
						>
							<span style={t(s, 56, 700, { lineHeight: 1 })}>
								{temperature}
							</span>
							<span style={t(s, 26, 400, { lineHeight: 1 })}>°C</span>
						</div>
						<div style={{ ...fc, alignItems: "center", gap: s.g(4) }}>
							<MainIcon size={s.f(BASE_W * 0.14)} />
							<div style={{ ...fr, gap: s.g(14) }}>
								<span
									style={{ display: "flex", alignItems: "center", gap: s.g(4) }}
								>
									{tempUp({ size: s.f(24) })}
									<span style={t(s, 18, 600)}>{highTemp}°</span>
								</span>
								<span
									style={{ display: "flex", alignItems: "center", gap: s.g(4) }}
								>
									{tempDown({ size: s.f(24) })}
									<span style={t(s, 18, 600)}>{lowTemp}°</span>
								</span>
							</div>
						</div>
					</div>

					{/* ── STAT CARDS: fill remaining space ── */}
					<div
						style={{
							...fc,
							flex: "1 1 0",
							justifyContent: "center",
							padding: s.p(4),
							minHeight: 0,
						}}
					>
						<div
							style={{
								...fr,
								flexWrap: "wrap",
								gap: s.g(6),
								alignContent: "stretch",
								flex: "1 1 0",
							}}
						>
							{stats.map((stat) => (
								<div
									key={stat.label}
									style={{
										...fr,
										alignItems: "center",
										borderRadius: s.p(8),
										borderWidth: s.b(2),
										borderStyle: "solid",
										borderColor: "#000",
										padding: s.p(6),
										gap: s.g(8),
										flex: "1 1 calc(50% - 6px)",
										minWidth: s.p(200),
									}}
								>
									<stat.Icon size={s.f(30)} />
									<div style={{ ...fc, justifyContent: "center", minWidth: 0 }}>
										<span style={t(s, 15, 600, { color: "#444" })}>
											{stat.label}
										</span>
										<span style={t(s, 19, 700)}>{stat.value}</span>
									</div>
								</div>
							))}
						</div>
					</div>

					{/* ── FOOTER ── */}
					<div
						style={{
							...fr,
							justifyContent: "space-between",
							alignItems: "center",
							backgroundColor: "#000",
							color: "#fff",
							padding: s.p(10),
							borderRadius: s.p(8),
							margin: s.p(4),
							flexShrink: 0,
						}}
					>
						<span style={t(s, 14, 600)}>{location}</span>
						{lastUpdated && (
							<span style={t(s, 13, 400)}>Updated: {lastUpdated}</span>
						)}
					</div>
				</div>
			</div>
		</PreSatori>
	);
}
