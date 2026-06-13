import { PreSatori } from "@/utils/pre-satori";
import {
	createCalendarScale as sc,
	calendarTextStyle as t,
} from "../calendar-ui";
import type { WeekData } from "./getData";

const DAY_ABBRS = ["PN", "WT", "ŚR", "CZ", "PT", "SO", "ND"];
const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

function fmtTime(d: Date): string {
	return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export default function CalendarWeekly({
	days = [],
	width = 800,
	height = 480,
}: WeekData & { width?: number; height?: number }) {
	const s = sc(width);
	const colW = `${100 / 7}%`;

	// Separate all-day events from timed events
	const allDayEvents = days.flatMap((d, di) =>
		d.events.filter((e) => e.isAllDay).map((e) => ({ ...e, dayIdx: di })),
	);
	const hasAllDay = allDayEvents.length > 0;

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
				{/* Day headers */}
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
					{days.map((day, i) => (
						<div
							key={i}
							style={{
								width: colW,
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								justifyContent: "center",
								padding: s.p(4),
								borderRightWidth: i < 6 ? s.b(1) : 0,
								borderRightStyle: "solid",
								borderRightColor: "#e5e7eb",
								backgroundColor: day.isToday
									? "#000"
									: day.isWeekend
										? "#f5f5f5"
										: "#fff",
							}}
						>
							<span style={t(s, 13, 600, day.isToday ? "#fff" : "#999")}>
								{DAY_ABBRS[i]}
							</span>
							<span
								style={t(
									s,
									18,
									700,
									day.isToday ? "#fff" : day.isWeekend ? "#999" : "#333",
								)}
							>
								{day.date.getDate()}
							</span>
						</div>
					))}
				</div>

				{/* All-day events row */}
				{hasAllDay && (
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							borderBottomWidth: s.b(1),
							borderBottomStyle: "solid",
							borderBottomColor: "#ccc",
							flexShrink: 0,
						}}
					>
						{days.map((day, di) => {
							const adEvts = day.events.filter((e) => e.isAllDay);
							return (
								<div
									key={di}
									style={{
										width: colW,
										display: "flex",
										flexDirection: "column",
										padding: s.p(2),
										gap: s.p(1),
									}}
								>
									{adEvts.map((ev, ei) => (
										<div
											key={ei}
											style={{
												backgroundColor: "#e0e0e0",
												borderRadius: s.p(2),
												padding: s.p(2),
											}}
										>
											<span style={t(s, 12, 600, "#333")}>{ev.summary}</span>
										</div>
									))}
								</div>
							);
						})}
					</div>
				)}

				{/* Timed events — only show hours that have events */}
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						flex: "1 1 0",
						minHeight: 0,
					}}
				>
					{HOURS.map((hour) => {
						const hasEvents = days.some((d) =>
							d.events.some((e) => !e.isAllDay && e.start.getHours() === hour),
						);
						if (!hasEvents) return null;

						return (
							<div
								key={hour}
								style={{
									display: "flex",
									flexDirection: "row",
									flex: "1 1 0",
									minHeight: 0,
									borderBottomWidth: s.b(1),
									borderBottomStyle: "solid",
									borderBottomColor: "#e5e7eb",
								}}
							>
								<div
									style={{
										width: s.p(36),
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										flexShrink: 0,
										backgroundColor: "#f5f5f5",
										borderRightWidth: s.b(1),
										borderRightStyle: "solid",
										borderRightColor: "#ccc",
									}}
								>
									<span style={t(s, 12, 600, "#888")}>{hour}:00</span>
								</div>
								{days.map((day, di) => {
									const hourEvents = day.events.filter(
										(e) => !e.isAllDay && e.start.getHours() === hour,
									);
									return (
										<div
											key={di}
											style={{
												width: colW,
												borderRightWidth: di < 6 ? s.b(1) : 0,
												borderRightStyle: "solid",
												borderRightColor: "#e5e7eb",
												padding: s.p(1),
												backgroundColor: day.isToday
													? "#fafafa"
													: day.isWeekend
														? "#f9f9f9"
														: "#fff",
												display: "flex",
												flexDirection: "column",
												gap: s.p(1),
												overflow: "hidden",
											}}
										>
											{hourEvents.map((ev, ei) => (
												<div
													key={ei}
													style={{
														backgroundColor: day.isToday ? "#333" : "#e8e8e8",
														borderRadius: s.p(2),
														padding: s.p(2),
													}}
												>
													<span
														style={t(s, 12, 600, day.isToday ? "#fff" : "#333")}
													>
														{fmtTime(ev.start)} {ev.summary}
													</span>
												</div>
											))}
										</div>
									);
								})}
							</div>
						);
					})}
				</div>
			</div>
		</PreSatori>
	);
}
