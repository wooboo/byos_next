import { PreSatori } from "@/utils/pre-satori";
import type { DayData } from "./getData";

const BASE_W = 800;
function sc(w: number) {
	const s = w / BASE_W;
	return {
		f: (n: number) => Math.round(n * s),
		p: (n: number) => Math.round(n * s),
		b: (n: number) => Math.max(1, Math.round(n * s)),
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

const MONTHS_PL = [
	"stycznia",
	"lutego",
	"marca",
	"kwietnia",
	"maja",
	"czerwca",
	"lipca",
	"sierpnia",
	"września",
	"października",
	"listopada",
	"grudnia",
];

function fmtTime(d: Date): string {
	const h = d.getHours().toString().padStart(2, "0");
	const m = d.getMinutes().toString().padStart(2, "0");
	return `${h}:${m}`;
}

export default function CalendarDaily({
	date,
	dayName,
	events = [],
	width = 800,
	height = 480,
}: DayData & { width?: number; height?: number }) {
	const s = sc(width);
	const dateStr = `${dayName}, ${date.getDate()} ${MONTHS_PL[date.getMonth()]} ${date.getFullYear()}`;

	return (
		<PreSatori useDoubling={true} width={width} height={height}>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					width: "100%",
					height: "100%",
					backgroundColor: "#fff",
				}}
			>
				{/* Header */}
				<div
					style={{
						display: "flex",
						flexDirection: "row",
						justifyContent: "space-between",
						alignItems: "center",
						backgroundColor: "#000",
						color: "#fff",
						padding: s.p(10),
						flexShrink: 0,
					}}
				>
					<span style={t(s, 18, 700)}>{dateStr}</span>
					<span style={t(s, 13, 400)}>{events.length} wydarzeń</span>
				</div>

				{/* Event list */}
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						flex: "1 1 0",
						padding: s.p(8),
						gap: s.p(6),
						overflow: "hidden",
						minHeight: 0,
					}}
				>
					{events.length === 0 ? (
						<div
							style={{
								display: "flex",
								flex: "1 1 0",
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<span style={t(s, 14, 400, { color: "#999" })}>
								Brak wydarzeń
							</span>
						</div>
					) : (
						events.map((ev, i) => {
							const timeStr = ev.isAllDay
								? "cały dzień"
								: `${fmtTime(ev.start)} – ${fmtTime(ev.end)}`;
							return (
								<div
									key={i}
									style={{
										display: "flex",
										flexDirection: "row",
										alignItems: "flex-start",
										gap: s.p(8),
										borderLeftWidth: s.b(4),
										borderLeftStyle: "solid",
										borderLeftColor: "#000",
										paddingLeft: s.p(8),
									}}
								>
									<div
										style={{
											display: "flex",
											flexDirection: "column",
											flex: "1 1 0",
											minWidth: 0,
										}}
									>
										<span style={t(s, 15, 700)}>{ev.summary}</span>
										<span style={t(s, 12, 400, { color: "#666" })}>
											{timeStr}
										</span>
										{ev.location && (
											<span style={t(s, 11, 400, { color: "#999" })}>
												{ev.location}
											</span>
										)}
									</div>
								</div>
							);
						})
					)}
				</div>
			</div>
		</PreSatori>
	);
}
