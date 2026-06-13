import { type CalendarEvent, fetchCalendarEvents } from "@/lib/calendar/ics";
import {
	eventsForDate,
	groupEventsByCalendarDate,
	isWeekendDate,
	startOfLocalDay,
} from "../calendar-data";

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

function monthRange(year: number, month: number) {
	const firstDay = new Date(year, month, 1);
	const lastDay = new Date(year, month + 1, 0);
	const startPad = (firstDay.getDay() + 6) % 7;
	const endPad = 6 - ((lastDay.getDay() + 6) % 7);

	return {
		rangeStart: new Date(year, month, 1 - startPad),
		rangeEnd: new Date(year, month + 1, endPad),
	};
}

function buildCalendarDay(
	date: Date,
	month: number,
	today: Date,
	eventsByDate: Map<string, CalendarEvent[]>,
): CalendarData["days"][0][0] {
	return {
		day: date.getMonth() === month ? date.getDate() : null,
		date: new Date(date),
		isToday: date.getTime() === today.getTime(),
		isWeekend: isWeekendDate(date),
		events: eventsForDate(eventsByDate, date),
	};
}

function buildCalendarWeeks(
	rangeStart: Date,
	rangeEnd: Date,
	month: number,
	today: Date,
	eventsByDate: Map<string, CalendarEvent[]>,
): CalendarData["days"] {
	const weeks: CalendarData["days"] = [];
	const current = new Date(rangeStart);

	while (current <= rangeEnd) {
		const week: CalendarData["days"][0] = [];
		for (let d = 0; d < 7; d++) {
			week.push(buildCalendarDay(current, month, today, eventsByDate));
			current.setDate(current.getDate() + 1);
		}
		weeks.push(week);
	}

	return weeks;
}

export default async function getData(
	params?: Record<string, unknown>,
): Promise<CalendarData> {
	const icsUrl = (params?.icsUrl as string) || "";

	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth();

	const { rangeStart, rangeEnd } = monthRange(year, month);
	const events = icsUrl
		? await fetchCalendarEvents(icsUrl, rangeStart, rangeEnd)
		: [];
	const eventsByDate = groupEventsByCalendarDate(events);
	const today = startOfLocalDay(now);
	const weeks = buildCalendarWeeks(
		rangeStart,
		rangeEnd,
		month,
		today,
		eventsByDate,
	);

	return {
		year,
		month,
		monthName: MONTHS_PL[month],
		days: weeks,
	};
}
