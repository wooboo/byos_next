import { PreSatori } from "@/utils/pre-satori";
import type { ChildData, Period, Subjects, WeekSchedule } from "./getData";

// ─── Constants ───────────────────────────────────────────────────────────

const DAY_KEYS = [
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
] as const;
const DAY_ABBR = ["PN", "WT", "ŚR", "CZ", "PT"] as const;

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
] as const;

const BASE_WIDTH = 800;
const COL_W = `${100 / 8}%`;
const TEXT_COLOR = "#000000";
const ULA_BG = "#dfdfdf";
const JERZYK_BG = "#c8c8c8";

// ─── Scaling helpers ─────────────────────────────────────────────────────

function makeScale(width: number) {
	const s = width / BASE_WIDTH;
	return {
		font: (size: number) => Math.round(size * s),
		px: (size: number) => Math.round(size * s),
		border: (size: number) => Math.max(1, Math.round(size * s)),
		gap: (size: number) => Math.round(size * s),
	};
}

type Scale = ReturnType<typeof makeScale>;

function text(
	sc: Scale,
	size: number,
	weight = 400,
	more: Record<string, unknown> = {},
) {
	return {
		fontFamily: "inter",
		fontSize: sc.font(size),
		fontWeight: weight,
		lineHeight: 1,
		...more,
	};
}

const flexRow = { display: "flex", flexDirection: "row" } as const;
const flexCol = { display: "flex", flexDirection: "column" } as const;

// ─── Sub-components ──────────────────────────────────────────────────────

function TopBar({ dateStr, sc }: { dateStr: string; sc: Scale }) {
	return (
		<div
			style={{
				...flexRow,
				justifyContent: "space-between",
				alignItems: "center",
				backgroundColor: "#000",
				color: "#fff",
				paddingLeft: sc.px(16),
				paddingRight: sc.px(16),
				paddingTop: sc.px(6),
				paddingBottom: sc.px(6),
				flexShrink: 0,
			}}
		>
			<span style={text(sc, 20, 700, { lineHeight: 1.1 })}>PLAN LEKCJI</span>
			<span style={text(sc, 13)}>{dateStr}</span>
		</div>
	);
}

function PeriodHeader({ periods, sc }: { periods: Period[]; sc: Scale }) {
	return (
		<div style={{ ...flexCol, flexShrink: 0 }}>
			<div
				style={{
					...flexRow,
					borderBottomWidth: sc.border(1),
					borderBottomStyle: "solid",
					borderBottomColor: "#9ca3af",
				}}
			>
				<div style={{ width: sc.px(44), flexShrink: 0 }} />
				{periods.map((p) => (
					<div
						key={p.num}
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							width: COL_W,
							paddingTop: sc.px(3),
							paddingBottom: sc.px(2),
						}}
					>
						<span style={text(sc, 17, 700, { color: "#1f2937" })}>{p.num}</span>
					</div>
				))}
			</div>
			<div
				style={{
					...flexRow,
					borderBottomWidth: sc.border(2),
					borderBottomStyle: "solid",
					borderBottomColor: "#000",
				}}
			>
				<div style={{ width: sc.px(44), flexShrink: 0 }} />
				{periods.map((p) => (
					<div
						key={p.num}
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							width: COL_W,
							borderRightWidth: sc.border(1),
							borderRightStyle: "solid",
							borderRightColor: "#e5e7eb",
							paddingTop: sc.px(2),
							paddingBottom: sc.px(3),
						}}
					>
						<span style={text(sc, 15, 600, { color: "#4b5563" })}>
							{p.start}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}

function DayRow({
	label,
	topSlots,
	bottomSlots,
	subjects,
	topBg,
	bottomBg,
	sc,
}: {
	label: string;
	topSlots: (string | null)[];
	bottomSlots: (string | null)[];
	subjects: Subjects;
	topBg: string;
	bottomBg: string;
	sc: Scale;
}) {
	return (
		<div
			style={{
				...flexRow,
				alignItems: "stretch",
				borderBottomWidth: sc.border(1),
				borderBottomStyle: "solid",
				borderBottomColor: "#d1d5db",
				flex: "1 1 0",
				minHeight: 0,
			}}
		>
			<div
				style={{
					width: sc.px(44),
					flexShrink: 0,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: "#f3f4f6",
					borderRightWidth: sc.border(1),
					borderRightStyle: "solid",
					borderRightColor: "#d1d5db",
				}}
			>
				<span style={text(sc, 14, 700, { color: "#374151" })}>{label}</span>
			</div>

			{topSlots.map((_, i) => {
				const topSubj = topSlots[i];
				const bottomSubj = bottomSlots[i];
				const hasBoth = topSubj !== null && bottomSubj !== null;

				return (
					<div
						key={i}
						style={{
							...flexCol,
							width: COL_W,
							borderRightWidth: sc.border(1),
							borderRightStyle: "solid",
							borderRightColor: "#e5e7eb",
						}}
					>
						{/* Top child */}
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								flex: "1 1 0",
								minHeight: 0,
								backgroundColor: topSubj ? topBg : "#fff",
								borderBottomWidth: hasBoth ? sc.border(2) : 0,
								borderBottomStyle: "solid",
								borderBottomColor: "#d1d5db",
							}}
						>
							{topSubj && (
								<span
									style={text(sc, 15, 700, {
										color: TEXT_COLOR,
										lineHeight: 1.1,
										textAlign: "center",
									})}
								>
									{subjects[topSubj] ?? topSubj}
								</span>
							)}
						</div>

						{/* Bottom child */}
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								flex: "1 1 0",
								minHeight: 0,
								backgroundColor: bottomSubj ? bottomBg : "#fff",
							}}
						>
							{bottomSubj && (
								<span
									style={text(sc, 15, 600, {
										color: TEXT_COLOR,
										lineHeight: 1.1,
										textAlign: "center",
									})}
								>
									{subjects[bottomSubj] ?? bottomSubj}
								</span>
							)}
						</div>
					</div>
				);
			})}
		</div>
	);
}

// ─── Main component ──────────────────────────────────────────────────────

export default function SchoolSchedule({
	periods = [],
	subjects = {},
	children = {},
	width = 800,
	height = 480,
}: {
	periods?: Period[];
	subjects?: Subjects;
	children?: Record<string, ChildData>;
	width?: number;
	height?: number;
}) {
	const sc = makeScale(width);
	const now = new Date();
	const dateStr = `${now.getDate()} ${MONTHS_PL[now.getMonth()]} ${now.getFullYear()}`;

	const childEntries = Object.entries(children);
	const top = childEntries[0];
	const bottom = childEntries.length > 1 ? childEntries[1] : null;

	return (
		<PreSatori useDoubling={true} width={width} height={height}>
			<div
				style={{
					...flexCol,
					width: "100%",
					height: "100%",
					backgroundColor: "#fff",
				}}
			>
				<TopBar dateStr={dateStr} sc={sc} />
				<PeriodHeader periods={periods} sc={sc} />

				<div style={{ ...flexCol, flex: "1 1 0", minHeight: 0 }}>
					{DAY_KEYS.map((key, i) => (
						<DayRow
							key={key}
							label={DAY_ABBR[i]}
							topSlots={top?.[1].schedule[key] ?? []}
							bottomSlots={bottom?.[1].schedule[key] ?? []}
							subjects={subjects}
							topBg={ULA_BG}
							bottomBg={JERZYK_BG}
							sc={sc}
						/>
					))}
				</div>

				{/* Legend */}
				{top && (
					<div
						style={{
							...flexRow,
							alignItems: "center",
							justifyContent: "center",
							gap: sc.gap(32),
							paddingTop: sc.px(4),
							paddingBottom: sc.px(4),
							borderTopWidth: sc.border(1),
							borderTopStyle: "solid",
							borderTopColor: "#d1d5db",
							flexShrink: 0,
							backgroundColor: "#fafafa",
						}}
					>
						<div
							style={{ display: "flex", alignItems: "center", gap: sc.gap(8) }}
						>
							<div
								style={{
									width: sc.px(20),
									height: sc.px(16),
									borderRadius: sc.px(3),
									backgroundColor: ULA_BG,
									borderWidth: sc.border(1),
									borderStyle: "solid",
									borderColor: "#ccc",
								}}
							/>
							<span style={text(sc, 14, 700, { color: "#333" })}>
								{top[1].name}
							</span>
						</div>
						{bottom && (
							<div
								style={{
									display: "flex",
									alignItems: "center",
									gap: sc.gap(8),
								}}
							>
								<div
									style={{
										width: sc.px(20),
										height: sc.px(16),
										borderRadius: sc.px(3),
										backgroundColor: JERZYK_BG,
										borderWidth: sc.border(1),
										borderStyle: "solid",
										borderColor: "#ccc",
									}}
								/>
								<span style={text(sc, 14, 600, { color: "#555" })}>
									{bottom[1].name}
								</span>
							</div>
						)}
					</div>
				)}
			</div>
		</PreSatori>
	);
}
