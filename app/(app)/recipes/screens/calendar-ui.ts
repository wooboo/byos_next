export type CalendarScale = {
	f: (n: number) => number;
	p: (n: number) => number;
	b: (n: number) => number;
};

export const BASE_CALENDAR_WIDTH = 800;

export function createCalendarScale(width: number): CalendarScale {
	const scale = width / BASE_CALENDAR_WIDTH;
	return {
		f: (n: number) => Math.round(n * scale),
		p: (n: number) => Math.round(n * scale),
		b: (n: number) => Math.max(1, Math.round(n * scale)),
	};
}

export function calendarTextStyle(
	scale: CalendarScale,
	size: number,
	weight = 400,
	colorOrMore: string | Record<string, unknown> = "#333",
) {
	const base = {
		fontFamily: "inter",
		fontSize: scale.f(size),
		fontWeight: weight,
		lineHeight: 1.15,
	};

	return typeof colorOrMore === "string"
		? { ...base, color: colorOrMore }
		: { ...base, ...colorOrMore };
}
