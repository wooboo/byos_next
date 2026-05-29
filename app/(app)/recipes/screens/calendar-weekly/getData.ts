import { type CalendarEvent, fetchCalendarEvents } from "@/lib/calendar/ics";

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

export default async function getData(
	params?: Record<string, unknown>,
): Promise<WeekData> {
	const icsUrl = (params?.icsUrl as string) || "";
	const now = new Date();

	// Find Monday of current week
	const day = now.getDay();
	const monday = new Date(now);
	monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
	monday.setHours(0, 0, 0, 0);

	const sunday = new Date(monday);
	sunday.setDate(monday.getDate() + 7);

	const events = icsUrl
		? await fetchCalendarEvents(icsUrl, monday, sunday)
		: [];

	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const days: WeekData["days"] = [];

	for (let i = 0; i < 7; i++) {
		const date = new Date(monday);
		date.setDate(monday.getDate() + i);
		const isToday = date.getTime() === today.getTime();

		const dayEvents = events.filter((e) => {
			const es = new Date(e.start);
			return (
				es.getFullYear() === date.getFullYear() &&
				es.getMonth() === date.getMonth() &&
				es.getDate() === date.getDate()
			);
		});

		days.push({
			name: DAY_NAMES[i],
			date: new Date(date),
			isToday,
			isWeekend: i >= 5,
			events: dayEvents,
		});
	}

	return { days };
}
