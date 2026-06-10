import { type CalendarEvent, fetchCalendarEvents } from "@/lib/calendar/ics";

export interface CalendarData {
	year: number;
	month: number; // 0-based
	monthName: string;
	days: {
		day: number | null; // null = outside current month
		date: Date;
		isToday: boolean;
		isWeekend: boolean;
		events: CalendarEvent[];
	}[][]; // weeks × days
}

const MONTHS_PL = [
	"styczeń",
	"luty",
	"marzec",
	"kwiecień",
	"maj",
	"czerwiec",
	"lipiec",
	"sierpień",
	"wrzesień",
	"październik",
	"listopad",
	"grudzień",
];

const DAY_NAMES = ["PN", "WT", "ŚR", "CZ", "PT", "SO", "ND"];

export default async function getData(
	params?: Record<string, unknown>,
): Promise<CalendarData> {
	const icsUrl = (params?.icsUrl as string) || "";

	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth();

	// Calculate range: full month + padding days
	const firstDay = new Date(year, month, 1);
	const lastDay = new Date(year, month + 1, 0);

	// Extend to full weeks (Monday = 1, Sunday = 7 → 0 in JS)
	const startPad = (firstDay.getDay() + 6) % 7; // days from Monday
	const endPad = 6 - ((lastDay.getDay() + 6) % 7); // days to Sunday

	const rangeStart = new Date(year, month, 1 - startPad);
	const rangeEnd = new Date(year, month + 1, endPad);

	const events = icsUrl
		? await fetchCalendarEvents(icsUrl, rangeStart, rangeEnd)
		: [];

	// Build calendar grid
	const weeks: CalendarData["days"] = [];
	const current = new Date(rangeStart);
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

	while (current <= rangeEnd) {
		const week: CalendarData["days"][0] = [];
		for (let d = 0; d < 7; d++) {
			const date = new Date(current);
			const inMonth = date.getMonth() === month;
			const isToday = date.getTime() === today.getTime();
			const dayOfWeek = date.getDay();
			const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

			const dayEvents = events.filter((e) => {
				const es = new Date(e.start);
				return (
					es.getFullYear() === date.getFullYear() &&
					es.getMonth() === date.getMonth() &&
					es.getDate() === date.getDate()
				);
			});

			week.push({
				day: inMonth ? date.getDate() : null,
				date: new Date(date),
				isToday,
				isWeekend,
				events: dayEvents,
			});

			current.setDate(current.getDate() + 1);
		}
		weeks.push(week);
	}

	return {
		year,
		month,
		monthName: MONTHS_PL[month],
		days: weeks,
	};
}
