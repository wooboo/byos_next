import { PreSatori } from "@/utils/pre-satori";
import type { CalendarData } from "./getData";

const DAY_NAMES = ["PN", "WT", "ŚR", "CZ", "PT", "SO", "ND"];

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
	color = "#333",
) {
	return {
		fontFamily: "inter",
		fontSize: s.f(size),
		fontWeight: weight,
		lineHeight: 1.15,
		color,
	};
}

export default function CalendarMonthly({
	year = 2026,
	month = 0,
	monthName = "",
	days = [],
	width = 800,
	height = 480,
}: CalendarData & { width?: number; height?: number }) {
	const s = sc(width);
	const colW = `${100 / 7}%`;

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
						alignItems: "center",
						backgroundColor: "#000",
						color: "#fff",
						paddingLeft: s.p(10),
						paddingRight: s.p(10),
						paddingTop: s.p(5),
						paddingBottom: s.p(5),
						flexShrink: 0,
					}}
				>
					<span style={t(s, 20, 700, "#fff")}>
						{monthName} {year}
					</span>
				</div>

				{/* Day name headers */}
				<div
					style={{
						display: "flex",
						flexDirection: "row",
						borderBottomWidth: s.b(2),
						borderBottomStyle: "solid",
						borderBottomColor: "#000",
						flexShrink: 0,
					}}
				>
					{DAY_NAMES.map((d, i) => (
						<div
							key={d}
							style={{
								width: colW,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								padding: s.p(2),
								backgroundColor: i >= 5 ? "#f0f0f0" : "#fff",
							}}
						>
							<span style={t(s, 12, 700, i >= 5 ? "#888" : "#333")}>{d}</span>
						</div>
					))}
				</div>

				{/* Week rows */}
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						flex: "1 1 0",
						minHeight: 0,
					}}
				>
					{days.map((week, wi) => (
						<div
							key={wi}
							style={{
								display: "flex",
								flexDirection: "row",
								flex: "1 1 0",
								borderBottomWidth: s.b(1),
								borderBottomStyle: "solid",
								borderBottomColor: "#ccc",
							}}
						>
							{week.map((day, di) => (
								<div
									key={di}
									style={{
										width: colW,
										display: "flex",
										flexDirection: "column",
										padding: s.p(2),
										overflow: "hidden",
										borderRightWidth: s.b(1),
										borderRightStyle: "solid",
										borderRightColor: "#ccc",
										backgroundColor: day.isToday
											? "#e8e8e8"
											: day.isWeekend
												? "#f5f5f5"
												: "#fff",
									}}
								>
									{/* Day number + today dot */}
									<div
										style={{
											display: "flex",
											flexDirection: "row",
											alignItems: "center",
											gap: s.p(2),
										}}
									>
										{day.isToday && (
											<div
												style={{
													width: s.f(7),
													height: s.f(7),
													borderRadius: s.f(4),
													backgroundColor: "#000",
													flexShrink: 0,
												}}
											/>
										)}
										{day.day !== null && (
											<span style={t(s, 15, day.isToday ? 700 : 500, "#333")}>
												{day.day}
											</span>
										)}
									</div>
									{/* Events */}
									<div
										style={{
											display: "flex",
											flexDirection: "column",
											flex: "1 1 0",
											gap: s.p(1),
											minHeight: 0,
											overflow: "hidden",
											marginTop: s.p(1),
										}}
									>
										{day.events.slice(0, 3).map((ev, ei) => (
											<span key={ei} style={t(s, 12, 600, "#333")}>
												{ev.summary.length > 20
													? ev.summary.slice(0, 19) + "…"
													: ev.summary}
											</span>
										))}
									</div>
								</div>
							))}
						</div>
					))}
				</div>
			</div>
		</PreSatori>
	);
}
