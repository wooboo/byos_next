import { type CalendarEvent, fetchCalendarEvents } from "@/lib/calendar/ics";
import {
	eventsForDate,
	groupEventsByCalendarDate,
	startOfLocalDay,
} from "../calendar-data";

export interface WeekData {
	days: {
		name: string;
		date: Date;
		isToday: boolean;
		isWeekend: boolean;
		events: CalendarEvent[];
	}[];
}

const DAY_NAMES = [
	"poniedziałek",
	"wtorek",
	"środa",
	"czwartek",
	"piątek",
	"sobota",
	"niedziela",
];

function currentWeekRange(now: Date) {
	const day = now.getDay();
	const monday = new Date(now);
	monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
	monday.setHours(0, 0, 0, 0);

	const sunday = new Date(monday);
	sunday.setDate(monday.getDate() + 7);

	return { monday, sunday };
}

function buildWeekDay(
	monday: Date,
	index: number,
	today: Date,
	eventsByDate: Map<string, CalendarEvent[]>,
): WeekData["days"][0] {
	const date = new Date(monday);
	date.setDate(monday.getDate() + index);

	return {
		name: DAY_NAMES[index],
		date: new Date(date),
		isToday: date.getTime() === today.getTime(),
		isWeekend: index >= 5,
		events: eventsForDate(eventsByDate, date),
	};
}

function buildWeekDays(
	monday: Date,
	today: Date,
	eventsByDate: Map<string, CalendarEvent[]>,
): WeekData["days"] {
	return DAY_NAMES.map((_, index) =>
		buildWeekDay(monday, index, today, eventsByDate),
	);
}

export default async function getData(
	params?: Record<string, unknown>,
): Promise<WeekData> {
	const icsUrl = (params?.icsUrl as string) || "";
	const now = new Date();

	const { monday, sunday } = currentWeekRange(now);
	const events = icsUrl
		? await fetchCalendarEvents(icsUrl, monday, sunday)
		: [];
	const eventsByDate = groupEventsByCalendarDate(events);

	const today = startOfLocalDay(now);
	const days = buildWeekDays(monday, today, eventsByDate);

	return { days };
}
